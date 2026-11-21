import { notifyAdminActivityRefresh } from "@/lib/admin-activity-bus";
import { ARTICLE_CATEGORY_OPTIONS } from "@/lib/rubriques";

/**
 * Côté navigateur : URL publique (NEXT_PUBLIC_*).
 * Côté serveur (SSR Docker) : préférer API_INTERNAL_URL (ex. http://api:3001)
 * pour éviter le hairpin NAT vers api.fintechmedias.com.
 */
const API_URL =
  (typeof window === "undefined"
    ? process.env.API_INTERNAL_URL ||
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? "http://localhost:3001";

/** Après une mutation admin réussie, le rail d’activités se rafraîchit. */
function maybeNotifyAdminActivity(path: string, method?: string) {
  const m = (method ?? "GET").toUpperCase();
  if (m === "GET" || m === "HEAD") return;
  if (path.startsWith("/admin/activity")) return;
  if (
    path === "/auth/admin/login" ||
    path === "/auth/admin/logout" ||
    path === "/auth/admin/refresh"
  ) {
    return;
  }
  if (path.startsWith("/admin/") || path.startsWith("/auth/admin/")) {
    notifyAdminActivityRefresh();
  }
}

export type Subscriber = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  countryCode: string | null;
  address: string | null;
  subscriberCode: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: Subscriber;
};

function unwrapSubscriber(payload: AuthSession | Subscriber | null) {
  if (!payload) return null;
  if ("user" in payload && payload.user) return payload.user;
  return payload as Subscriber;
}

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

export type AdminStaffMember = AdminUser & {
  isActive: boolean;
  updatedAt: string;
  avatarUrl: string | null;
};

export type AdminStaffSummary = {
  total: number;
  active: number;
  suspended: number;
};

export type AdminStaffListResponse = {
  items: AdminStaffMember[];
  total: number;
  take: number;
  skip: number;
  summary: AdminStaffSummary;
};

export const ADMIN_ROLES = [
  "SUPERADMIN",
  "ADMIN",
  "EDITOR",
  "REDACTEUR",
] as const;

export type AdminRoleName = (typeof ADMIN_ROLES)[number];

type ApiErrorBody = {
  message?: string | string[];
  statusCode?: number;
};

type ApiFetchInit = RequestInit & { __retried?: boolean };

/** Évite une boucle de refresh concurrente. */
let adminRefreshInFlight: Promise<boolean> | null = null;
let subscriberRefreshInFlight: Promise<boolean> | null = null;

function isAuthRefreshExempt(path: string): boolean {
  return (
    path === "/auth/login" ||
    path === "/auth/register" ||
    path === "/auth/refresh" ||
    path === "/auth/logout" ||
    path === "/auth/google" ||
    path === "/auth/forgot-password" ||
    path === "/auth/reset-password" ||
    path === "/auth/verify-email" ||
    path === "/auth/admin/login" ||
    path === "/auth/admin/refresh" ||
    path === "/auth/admin/logout" ||
    path.startsWith("/auth/request-") ||
    path.startsWith("/auth/confirm-")
  );
}

function isAdminApiPath(path: string): boolean {
  return path.startsWith("/admin/") || path.startsWith("/auth/admin/");
}

async function rawRefresh(path: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function refreshAdminSession(): Promise<boolean> {
  if (!adminRefreshInFlight) {
    adminRefreshInFlight = rawRefresh("/auth/admin/refresh").finally(() => {
      adminRefreshInFlight = null;
    });
  }
  return adminRefreshInFlight;
}

function refreshSubscriberSession(): Promise<boolean> {
  if (!subscriberRefreshInFlight) {
    subscriberRefreshInFlight = rawRefresh("/auth/refresh").finally(() => {
      subscriberRefreshInFlight = null;
    });
  }
  return subscriberRefreshInFlight;
}

async function parseApiErrorText(status: number, raw: string): Promise<string> {
  try {
    const body = JSON.parse(raw) as ApiErrorBody;
    if (Array.isArray(body.message)) {
      return body.message.join(", ");
    }
    if (typeof body.message === "string") {
      return body.message;
    }
  } catch {
    /* ignore */
  }
  if (status === 401) {
    return "Session expirée — reconnectez-vous";
  }
  return "Une erreur est survenue";
}

async function parseApiError(res: Response): Promise<string> {
  try {
    return await parseApiErrorText(res.status, await res.text());
  } catch {
    if (res.status === 401) {
      return "Session expirée — reconnectez-vous";
    }
    return "Une erreur est survenue";
  }
}

async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const retried = Boolean(init?.__retried);
  const { __retried: _, ...fetchInit } = init ?? {};
  const hasExplicitCache =
    fetchInit.cache != null ||
    (fetchInit as RequestInit & { next?: unknown }).next != null;

  const res = await fetch(`${API_URL}/api${path}`, {
    ...fetchInit,
    // SSR : ne pas garder un HTML figé avec le fallback démo
    ...(typeof window === "undefined" && !hasExplicitCache
      ? { cache: "no-store" as RequestCache }
      : {}),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(fetchInit.headers ?? {}),
    },
  });

  if (
    res.status === 401 &&
    !retried &&
    !isAuthRefreshExempt(path)
  ) {
    const refreshed = isAdminApiPath(path)
      ? await refreshAdminSession()
      : await refreshSubscriberSession();
    if (refreshed) {
      return apiFetch<T>(path, { ...fetchInit, __retried: true });
    }
  }

  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }

  maybeNotifyAdminActivity(path, fetchInit.method);

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

async function apiFetchForm<T>(
  path: string,
  body: FormData,
  retried = false,
  onProgress?: (percent: number) => void,
): Promise<T> {
  if (!onProgress || typeof XMLHttpRequest === "undefined") {
    const res = await fetch(`${API_URL}/api${path}`, {
      method: "POST",
      credentials: "include",
      body,
    });

    if (res.status === 401 && !retried && !isAuthRefreshExempt(path)) {
      const refreshed = isAdminApiPath(path)
        ? await refreshAdminSession()
        : await refreshSubscriberSession();
      if (refreshed) {
        return apiFetchForm<T>(path, body, true, onProgress);
      }
    }

    if (!res.ok) {
      throw new Error(await parseApiError(res));
    }

    maybeNotifyAdminActivity(path, "POST");

    return res.json() as Promise<T>;
  }

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api${path}`, true);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.min(
        100,
        Math.round((event.loaded / event.total) * 100),
      );
      onProgress(percent);
    };

    xhr.onload = () => {
      void (async () => {
        if (
          xhr.status === 401 &&
          !retried &&
          !isAuthRefreshExempt(path)
        ) {
          const refreshed = isAdminApiPath(path)
            ? await refreshAdminSession()
            : await refreshSubscriberSession();
          if (refreshed) {
            try {
              resolve(await apiFetchForm<T>(path, body, true, onProgress));
            } catch (err) {
              reject(err);
            }
            return;
          }
        }

        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(await parseApiErrorText(xhr.status, xhr.responseText)));
          return;
        }

        maybeNotifyAdminActivity(path, "POST");
        onProgress(100);
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new Error("Réponse invalide"));
        }
      })();
    };

    xhr.onerror = () => {
      reject(new Error("Échec réseau pendant l’envoi"));
    };

    xhr.send(body);
  });
}

export const authApi = {
  register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    turnstileToken?: string;
  }) {
    return apiFetch<AuthSession>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }).then(unwrapSubscriber) as Promise<Subscriber>;
  },

  login(input: {
    email: string;
    password: string;
    turnstileToken?: string;
  }) {
    return apiFetch<AuthSession>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }).then(unwrapSubscriber) as Promise<Subscriber>;
  },

  loginWithGoogle(credential: string, turnstileToken?: string) {
    return apiFetch<AuthSession>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential, turnstileToken }),
    }).then(unwrapSubscriber) as Promise<Subscriber>;
  },

  me() {
    return apiFetch<Subscriber | null>("/auth/me");
  },

  updateProfile(input: {
    name: string;
    email: string;
    phone?: string;
    country?: string;
    countryCode?: string;
    address?: string;
  }) {
    return apiFetch<Subscriber>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  uploadAvatar(file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<Subscriber>("/auth/me/avatar", body);
  },

  changePassword(input: { currentPassword: string; newPassword: string }) {
    return apiFetch<{ ok: boolean; message: string }>("/auth/me/password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  refresh() {
    return apiFetch<AuthSession | Subscriber | null>("/auth/refresh", {
      method: "POST",
    }).then(unwrapSubscriber);
  },

  logout() {
    return apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
  },

  verifyEmail(token: string) {
    return apiFetch<{ ok: boolean; message: string }>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  resendVerification() {
    return apiFetch<{ ok: boolean; message: string }>(
      "/auth/resend-verification",
      { method: "POST" },
    );
  },

  forgotPassword(email: string, turnstileToken?: string) {
    return apiFetch<{ ok: boolean; message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email, turnstileToken }),
    });
  },

  resetPassword(email: string, otp: string, password: string) {
    return apiFetch<{ ok: boolean; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, otp, password }),
    });
  },
};

export type LibraryMagazine = {
  id: string;
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  publishedAt?: string | null;
  accessType?: "FREE" | "PAID";
  readPath: string | null;
};

export type LibraryResponse = {
  status: "active" | "expired" | "pending" | "none";
  expiresAt: string | null;
  planName?: string | null;
  magazines: LibraryMagazine[];
};

export const libraryApi = {
  me() {
    return apiFetch<LibraryResponse>("/library/me");
  },

  notifications(params?: {
    days?: number;
    q?: string;
    type?: string;
    unreadOnly?: boolean;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.days != null) qs.set("days", String(params.days));
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.type) qs.set("type", params.type);
    if (params?.unreadOnly) qs.set("unread", "1");
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<NotificationsResponse>(`/library/notifications${suffix}`);
  },

  notificationsUnreadCount(days = 3) {
    return apiFetch<NotificationsUnreadResponse>(
      `/library/notifications/unread-count?days=${days}`,
    );
  },

  markNotificationRead(notificationId: string) {
    return apiFetch<NotificationReadResponse>("/library/notifications/read", {
      method: "POST",
      body: JSON.stringify({ notificationId }),
    });
  },

  markNotificationsSeen(days = 3) {
    return apiFetch<NotificationsSeenResponse>(
      `/library/notifications/seen?days=${days}`,
      { method: "POST" },
    );
  },

  payments(params?: {
    take?: number;
    skip?: number;
    q?: string;
    status?: string;
    provider?: string;
    purpose?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.status) qs.set("status", params.status);
    if (params?.provider) qs.set("provider", params.provider);
    if (params?.purpose) qs.set("purpose", params.purpose);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<PaymentsHistoryResponse>(`/library/payments${suffix}`);
  },

  purchases() {
    return apiFetch<PurchasesHistoryResponse>("/library/purchases");
  },
};

export type NotificationKind =
  | "ARTICLE"
  | "MAGAZINE"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "SUBSCRIPTION_EXPIRING"
  | "PURCHASE_READY";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  href: string;
  coverUrl: string | null;
  createdAt: string;
  unread: boolean;
};

export type NotificationsResponse = {
  items: NotificationItem[];
  total: number;
  take: number;
  skip: number;
  days: number;
  unreadCount: number;
  unreadOnly: boolean;
};

export type NotificationsUnreadResponse = {
  unreadCount: number;
  days: number;
};

export type NotificationsSeenResponse = {
  seenAt: string;
  unreadCount: number;
};

export type NotificationReadResponse = {
  ok: boolean;
  notificationId?: string;
  unreadCount: number;
};

export type PaymentHistoryItem = {
  id: string;
  provider: string;
  amountCents: number;
  currency: string;
  status: string;
  purpose: string;
  providerRef: string | null;
  planName?: string | null;
  magazineTitle?: string | null;
  magazineIssue?: string | null;
  metadata?: Record<string, unknown> | null;
  label: string;
  createdAt: string;
  updatedAt?: string;
};

export type PaymentsHistoryResponse = {
  payments: PaymentHistoryItem[];
  total: number;
  take: number;
  skip: number;
};

export type PurchaseHistoryItem = {
  id: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  magazine: {
    id: string;
    title: string;
    issueNumber: string | null;
    coverUrl: string | null;
    publishedAt: string | null;
    readPath: string | null;
  };
};

export type PurchasesHistoryResponse = {
  purchases: PurchaseHistoryItem[];
};

export const adminAuthApi = {
  login(input: {
    email: string;
    password: string;
    turnstileToken?: string;
  }) {
    return apiFetch<AdminUser>("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  me() {
    return apiFetch<AdminUser>("/auth/admin/me");
  },

  refresh() {
    return apiFetch<AdminUser>("/auth/admin/refresh", { method: "POST" });
  },

  logout() {
    return apiFetch<{ ok: boolean }>("/auth/admin/logout", { method: "POST" });
  },

  updateProfile(input: { name: string; title?: string; phone?: string }) {
    return apiFetch<AdminUser>("/auth/admin/me", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  changePassword(input: { currentPassword: string; newPassword: string }) {
    return apiFetch<{ ok: boolean }>("/auth/admin/me/password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  uploadAvatar(file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminUser>("/auth/admin/me/avatar", body);
  },
};

export const adminStaffApi = {
  list(params?: {
    q?: string;
    active?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.active) qs.set("active", params.active);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminStaffListResponse>(`/admin/staff${suffix}`);
  },

  create(input: {
    email: string;
    name: string;
    password: string;
    role: AdminRoleName;
    title?: string;
  }) {
    return apiFetch<AdminStaffMember>("/admin/staff", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(
    id: string,
    input: {
      name?: string;
      role?: AdminRoleName;
      title?: string;
      isActive?: boolean;
      password?: string;
    },
  ) {
    return apiFetch<AdminStaffMember>(`/admin/staff/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type AdminDashboardStats = {
  subscribersCount: number;
  magazinesCount: number;
  publishedMagazines: number;
  activeSubscriptions: number;
  successPayments: number;
  pendingPayments: number;
  articlesCount: number;
  volumePaidCents: number;
  volume14Cents: number;
  payments14Count: number;
  charts: {
    volumeByDay: Array<{ date: string; volumeCents: number; count: number }>;
    purposeBreakdown: Array<{
      purpose: string;
      count: number;
      volumeCents: number;
    }>;
  };
  recentPayments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    purpose: string;
    provider: string;
    providerRef: string | null;
    createdAt: string;
    subscriberName: string;
    subscriberEmail: string;
  }>;
  recentSubscribers: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    isActive: boolean;
  }>;
};

export const adminDashboardApi = {
  stats() {
    return apiFetch<AdminDashboardStats>("/admin/stats");
  },
};

export type MonitoringCheckStatus = "up" | "down" | "degraded" | "unknown";

export type MonitoringServiceCheck = {
  id: string;
  label: string;
  status: MonitoringCheckStatus;
  latencyMs: number | null;
  detail: string | null;
};

export type MonitoringPagesSnapshot = {
  pending: number;
  processing: number;
  ready: number;
  failed: number;
  queues: {
    urgent: Record<string, number>;
    bulk: Record<string, number>;
  };
  stuck: {
    id: string;
    title: string;
    pagesStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
    generatedPageCount: number;
    pagesError: string | null;
    updatedAt: string;
  }[];
  recentFailed: {
    id: string;
    title: string;
    pagesError: string | null;
    updatedAt: string;
  }[];
};

export type MonitoringSnapshot = {
  overall: MonitoringCheckStatus;
  checkedAt: string;
  services: MonitoringServiceCheck[];
  pages: MonitoringPagesSnapshot;
  alertsEnabled: boolean;
};

export const adminMonitoringApi = {
  get() {
    return apiFetch<MonitoringSnapshot>("/admin/monitoring");
  },
  triggerAlert() {
    return apiFetch<{ sent: boolean; reason: string }>(
      "/admin/monitoring/alert",
      { method: "POST" },
    );
  },
};

export type AdminActivityActorType = "ADMIN" | "SUBSCRIBER" | "SYSTEM";

export type AdminActivityItem = {
  id: string;
  actorType: AdminActivityActorType;
  action: string;
  actionLabel: string;
  entity: string | null;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
  createdAt: string;
  admin?: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl: string | null;
  } | null;
  subscriber?: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
};

export type AdminActivityListResponse = {
  items: AdminActivityItem[];
  total: number;
  take: number;
  skip: number;
};

export const adminActivityApi = {
  list(params?: {
    take?: number;
    skip?: number;
    q?: string;
    actorType?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.actorType) qs.set("actorType", params.actorType);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminActivityListResponse>(`/admin/activity${suffix}`);
  },

  recent(take = 8) {
    return apiFetch<{ items: AdminActivityItem[] }>(
      `/admin/activity/recent?take=${take}`,
    );
  },

  get(id: string) {
    return apiFetch<AdminActivityItem>(`/admin/activity/${id}`);
  },
};

export type SubscriptionStatusName = "ACTIVE" | "EXPIRED" | "CANCELLED";
export type PaymentStatusName =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED";

export type AdminSubscription = {
  id: string;
  legacyId: number | null;
  status: SubscriptionStatusName;
  paymentStatus: PaymentStatusName;
  transactionRef: string | null;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  isLive: boolean;
  subscriber: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    isActive: boolean;
    avatarUrl: string | null;
  };
  plan: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
    durationDays: number;
  };
};

export type AdminSubscriptionSummary = {
  activeNow: number;
  pendingPayment: number;
  expired: number;
  cancelled: number;
  total: number;
};

export type AdminSubscriptionListResponse = {
  items: AdminSubscription[];
  total: number;
  take: number;
  skip: number;
  summary: AdminSubscriptionSummary;
};

export type AdminSubscriptionUpdateInput = {
  status?: SubscriptionStatusName;
  paymentStatus?: PaymentStatusName;
  startsAt?: string;
  expiresAt?: string;
  extendDays?: number;
};

export const adminSubscriptionsApi = {
  list(params?: {
    q?: string;
    status?: string;
    paymentStatus?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.status) qs.set("status", params.status);
    if (params?.paymentStatus) qs.set("paymentStatus", params.paymentStatus);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminSubscriptionListResponse>(
      `/admin/subscriptions${suffix}`,
    );
  },

  get(id: string) {
    return apiFetch<AdminSubscription>(`/admin/subscriptions/${id}`);
  },

  update(id: string, input: AdminSubscriptionUpdateInput) {
    return apiFetch<AdminSubscription>(`/admin/subscriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type AdminPaymentItem = {
  id: string;
  provider: string;
  providerRef: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatusName;
  purpose: "SUBSCRIPTION" | "PURCHASE" | string;
  metadata: Record<string, unknown> | null;
  label: string;
  createdAt: string;
  updatedAt: string;
  subscriber: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    phone?: string | null;
  };
  plan: {
    id: string;
    name: string;
    priceCents?: number;
    currency?: string;
    durationDays?: number;
  } | null;
  magazine: {
    id: string;
    title: string;
    issueNumber: string | null;
  } | null;
};

export type AdminPaymentSummary = {
  total: number;
  success: number;
  pending: number;
  failed: number;
  refunded: number;
  volumePaidCents: number;
};

export type AdminPaymentListResponse = {
  items: AdminPaymentItem[];
  total: number;
  take: number;
  skip: number;
  summary: AdminPaymentSummary;
};

export const adminPaymentsApi = {
  list(params?: {
    q?: string;
    status?: string;
    provider?: string;
    purpose?: string;
    from?: string;
    to?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.status) qs.set("status", params.status);
    if (params?.provider) qs.set("provider", params.provider);
    if (params?.purpose) qs.set("purpose", params.purpose);
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminPaymentListResponse>(`/admin/payments${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminPaymentItem>(`/admin/payments/${id}`);
  },

  updateStatus(
    id: string,
    input: { status: PaymentStatusName; note?: string; otp: string },
  ) {
    return apiFetch<AdminPaymentItem>(`/admin/payments/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  requestStatusOtp(
    id: string,
    input: { status: PaymentStatusName; note?: string },
  ) {
    return apiFetch<{
      ok: boolean;
      expiresInSec: number;
      maskedEmail: string;
    }>(`/admin/payments/${id}/otp`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export type AdminSubscriberSubscription = {
  id: string;
  status: SubscriptionStatusName;
  paymentStatus: PaymentStatusName;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  isLive: boolean;
  plan: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
    durationDays: number;
  };
};

export type AdminSubscriber = {
  id: string;
  legacyId: number | null;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  countryCode: string | null;
  address: string | null;
  subscriberCode: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hasLiveSubscription: boolean;
  liveSubscription: Omit<AdminSubscriberSubscription, "createdAt"> | null;
  subscriptions: AdminSubscriberSubscription[];
};

export type AdminSubscriberSummary = {
  total: number;
  active: number;
  inactive: number;
  verified: number;
  withLiveSub: number;
};

export type AdminSubscriberListResponse = {
  items: AdminSubscriber[];
  total: number;
  take: number;
  skip: number;
  summary: AdminSubscriberSummary;
};

export type AdminSubscriberUpdateInput = {
  name?: string;
  email?: string;
  phone?: string | null;
  country?: string | null;
  countryCode?: string | null;
  address?: string | null;
  isActive?: boolean;
};

export const adminSubscribersApi = {
  list(params?: {
    q?: string;
    active?: string;
    verified?: string;
    subscription?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.active) qs.set("active", params.active);
    if (params?.verified) qs.set("verified", params.verified);
    if (params?.subscription) qs.set("subscription", params.subscription);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminSubscriberListResponse>(
      `/admin/subscribers${suffix}`,
    );
  },

  get(id: string) {
    return apiFetch<AdminSubscriber>(`/admin/subscribers/${id}`);
  },

  update(id: string, input: AdminSubscriberUpdateInput) {
    return apiFetch<AdminSubscriber>(`/admin/subscribers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type NewsletterSubscribeResult = {
  ok: true;
  alreadySubscribed: boolean;
  message: string;
};

export const newsletterPublicApi = {
  subscribe(body: { email: string; acceptedTerms: boolean; source?: string }) {
    return apiFetch<NewsletterSubscribeResult>("/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  unsubscribe(token: string) {
    const qs = new URLSearchParams({ token });
    return apiFetch<{
      ok: true;
      alreadyUnsubscribed: boolean;
      message: string;
    }>(`/newsletter/unsubscribe?${qs}`, { method: "POST" });
  },
};

export const contactPublicApi = {
  send(body: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    return apiFetch<{ ok: true; message: string }>("/contact", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

export type AdminNewsletterItem = {
  id: string;
  email: string;
  isActive: boolean;
  source: string | null;
  acceptedTerms: boolean;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminNewsletterListResponse = {
  items: AdminNewsletterItem[];
  total: number;
  take: number;
  skip: number;
  summary: {
    total: number;
    active: number;
    outbox?: {
      dailyLimit: number;
      sentToday: number;
      remainingToday: number;
      pending: number;
      failed: number;
      sendingEnabled?: boolean;
    };
  };
};

export const adminNewsletterApi = {
  list(params?: {
    q?: string;
    active?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.active) qs.set("active", params.active);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminNewsletterListResponse>(
      `/admin/newsletter${suffix}`,
    );
  },

  setActive(id: string, isActive: boolean) {
    return apiFetch<{
      id: string;
      email: string;
      isActive: boolean;
      unsubscribedAt: string | null;
      updatedAt: string;
    }>(`/admin/newsletter/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
  },

  setSendingEnabled(enabled: boolean) {
    return apiFetch<{ sendingEnabled: boolean; message: string }>(
      "/admin/newsletter/sending",
      {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      },
    );
  },

  sendTest() {
    return apiFetch<{ ok: true; to: string; message: string }>(
      "/admin/newsletter/test",
      { method: "POST" },
    );
  },

  preview() {
    return apiFetch<{
      subject: string;
      html: string;
      articleTitle: string;
    }>("/admin/newsletter/preview");
  },

  listSends(params?: {
    q?: string;
    status?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.status) qs.set("status", params.status);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminNewsletterSendsResponse>(
      `/admin/newsletter/sends${suffix}`,
    );
  },
};

export type AdminNewsletterSendStatus =
  | "PENDING"
  | "SENDING"
  | "SENT"
  | "SKIPPED"
  | "FAILED";

export type AdminNewsletterSendItem = {
  id: string;
  email: string;
  status: AdminNewsletterSendStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  article: { id: string; title: string; slug: string };
};

export type AdminNewsletterSendsResponse = {
  items: AdminNewsletterSendItem[];
  total: number;
  take: number;
  skip: number;
  summary: {
    pending: number;
    sending: number;
    sent: number;
    skipped: number;
    failed: number;
    outbox: {
      dailyLimit: number;
      sentToday: number;
      remainingToday: number;
      pending: number;
      failed: number;
      sendingEnabled?: boolean;
    };
  };
};

export type SocialNetwork =
  | "facebook"
  | "twitter"
  | "instagram"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "whatsapp"
  | "telegram"
  | "threads"
  | "other";

export type SiteSocialLink = {
  id: string;
  network: SocialNetwork;
  label: string;
  url: string;
};

export type SiteSocialSettings = {
  links: SiteSocialLink[];
  updatedAt: string;
};

export type SiteContactSettings = {
  address: string;
  email: string;
  phone: string;
  updatedAt: string;
};

export const settingsPublicApi = {
  social() {
    return apiFetch<SiteSocialSettings>("/settings/social");
  },
  contact() {
    return apiFetch<SiteContactSettings>("/settings/contact");
  },
};

export const adminSettingsApi = {
  getSocial() {
    return apiFetch<SiteSocialSettings>("/admin/settings/social");
  },

  updateSocial(body: { links: SiteSocialLink[] }) {
    return apiFetch<SiteSocialSettings>("/admin/settings/social", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  getContact() {
    return apiFetch<SiteContactSettings>("/admin/settings/contact");
  },

  updateContact(body: { address: string; email: string; phone: string }) {
    return apiFetch<SiteContactSettings>("/admin/settings/contact", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
};

export type AdminContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export type AdminContactListResponse = {
  items: AdminContactMessage[];
  total: number;
  take: number;
  skip: number;
  summary: { total: number; unread: number };
};

export const adminContactApi = {
  list(params?: {
    q?: string;
    read?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.read) qs.set("read", params.read);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminContactListResponse>(`/admin/contact${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminContactMessage>(
      `/admin/contact/${encodeURIComponent(id)}`,
    );
  },

  setRead(id: string, isRead: boolean) {
    return apiFetch<AdminContactMessage>(
      `/admin/contact/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ isRead }),
      },
    );
  },
};

export type AdminPlan = {
  id: string;
  legacyId: number | null;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  durationDays: number;
  isActive: boolean;
  subscriptionsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminPlanInput = {
  name: string;
  description?: string | null;
  priceCents: number;
  currency?: string;
  durationDays: number;
  isActive?: boolean;
};

export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  durationDays: number;
};

export type PublicPayment = {
  id: string;
  provider: "STRIPE" | "FLEXPAIE" | "LEGACY";
  providerRef: string | null;
  amountCents: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "REFUNDED";
  purpose: "SUBSCRIPTION" | "PURCHASE";
  planId: string | null;
  plan: {
    id: string;
    name: string;
    durationDays: number;
    priceCents: number;
    currency: string;
  } | null;
  magazineId?: string | null;
  magazine?: {
    id: string;
    title: string;
    issueNumber: string | null;
    coverUrl?: string | null;
    theme?: { bgColor: string; accentColor: string } | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export const plansApi = {
  list() {
    return apiFetch<{ items: PublicPlan[] }>("/plans");
  },
};

export const magazinesPublicApi = {
  list(takeOrOpts: number | { take?: number; skip?: number } = 12) {
    const take =
      typeof takeOrOpts === "number" ? takeOrOpts : (takeOrOpts.take ?? 12);
    const skip = typeof takeOrOpts === "number" ? 0 : (takeOrOpts.skip ?? 0);
    const qs = new URLSearchParams();
    qs.set("take", String(take));
    if (skip > 0) qs.set("skip", String(skip));
    return apiFetch<{
      items: PublicMagazineCard[];
      total: number;
      take: number;
      skip: number;
    }>(`/magazines?${qs}`);
  },

  latest() {
    return apiFetch<{
      id: string;
      title: string;
      issueNumber: string | null;
      coverUrl: string | null;
      publishedAt: string | null;
      theme: { bgColor: string; accentColor: string };
    } | null>("/magazines/latest");
  },

  get(id: string) {
    return apiFetch<PublicMagazineDetail>(
      `/magazines/${encodeURIComponent(id)}`,
    );
  },

  preview(id: string, opts?: { refresh?: boolean }) {
    const qs = opts?.refresh ? "?refresh=1" : "";
    return apiFetch<MagazineReadSession>(
      `/magazines/${encodeURIComponent(id)}/preview${qs}`,
    );
  },

  read(id: string, opts?: { refresh?: boolean }) {
    const qs = opts?.refresh ? "?refresh=1" : "";
    return apiFetch<MagazineReadSession>(
      `/magazines/${encodeURIComponent(id)}/read${qs}`,
    );
  },
};

export type PublicMagazineCard = {
  id: string;
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  priceCents: number | null;
  currency: string;
  accessType?: "FREE" | "PAID";
  dateLabel: string;
};

export type PublicMagazineDetail = PublicMagazineCard & {
  description: string | null;
  theme: { bgColor: string; accentColor: string };
  highlights: Array<{ label: string; text: string }>;
  relatedArticles?: Array<{
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    coverUrl: string | null;
    category: string | null;
    publishedAt: string | null;
  }>;
};

export type PublicArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  category: string | null;
  categoryLabel: string;
  categoryTone: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  publishedAt: string | null;
  dateLabel: string;
  viewCount: number;
  videoHlsUrl?: string | null;
  videoPosterUrl?: string | null;
  videoStatus?: "NONE" | "PENDING" | "PROCESSING" | "READY" | "FAILED";
  sponsor?: AdminArticleSponsor | null;
};

export type PublicCategoryFeed = {
  category: string;
  label: string;
  tone: string;
  items: PublicArticleCard[];
  mostRead?: PublicArticleCard[];
  total: number;
  take: number;
  skip: number;
};

export type PublicHomeArticles = {
  featured: PublicArticleCard[];
  topGrid: PublicArticleCard[];
  actualites?: PublicArticleCard[];
  interview?: PublicArticleCard[];
  economie?: PublicArticleCard[];
  politique?: PublicArticleCard[];
  international?: PublicArticleCard[];
  portrait?: PublicArticleCard[];
  entreprise?: PublicArticleCard[];
  ecosystemePme: PublicArticleCard[];
  filInfo: PublicArticleCard[];
  entreprendre: PublicArticleCard[];
  rencontreAvec: PublicArticleCard[];
  expert: PublicArticleCard[];
  femme: PublicArticleCard[];
  innovation: PublicArticleCard[];
  plusVus: PublicArticleCard[];
  aNePasManquer: PublicArticleCard[];
};

export const articlesPublicApi = {
  home() {
    return apiFetch<PublicHomeArticles>("/articles/home");
  },

  byLegacyId(legacyId: string) {
    return apiFetch<{ slug: string }>(
      `/articles/legacy/${encodeURIComponent(legacyId)}`,
    );
  },

  recent(take = 3) {
    return apiFetch<{ items: PublicArticleCard[] }>(
      `/articles/recent?take=${encodeURIComponent(String(take))}`,
    );
  },

  random(take = 10) {
    return apiFetch<{ items: PublicArticleCard[] }>(
      `/articles/random?take=${encodeURIComponent(String(take))}`,
    );
  },

  related(slug: string, take = 6) {
    const qs = new URLSearchParams();
    qs.set("slug", slug);
    qs.set("take", String(take));
    return apiFetch<{ items: PublicArticleCard[] }>(
      `/articles/related?${qs}`,
    );
  },

  search(q: string, take = 10, category?: string, skip = 0) {
    const qs = new URLSearchParams();
    qs.set("q", q);
    qs.set("take", String(take));
    if (skip > 0) qs.set("skip", String(skip));
    if (category) qs.set("category", category);
    return apiFetch<{
      items: PublicArticleCard[];
      total: number;
      q: string;
      category: string | null;
      take: number;
      skip: number;
    }>(`/articles/search?${qs}`);
  },

  mostRead(take = 5) {
    return apiFetch<{ items: PublicArticleCard[] }>(
      `/articles/most-read?take=${encodeURIComponent(String(take))}`,
    );
  },

  feed(opts?: { take?: number; skip?: number }) {
    const qs = new URLSearchParams();
    qs.set("take", String(opts?.take ?? 12));
    if (opts?.skip != null) qs.set("skip", String(opts.skip));
    return apiFetch<PublicCategoryFeed>(`/articles/feed?${qs}`);
  },

  byCategory(
    slug: string,
    opts?: { take?: number; skip?: number },
  ) {
    const qs = new URLSearchParams();
    qs.set("take", String(opts?.take ?? 12));
    if (opts?.skip != null) qs.set("skip", String(opts.skip));
    return apiFetch<PublicCategoryFeed>(
      `/articles/category/${encodeURIComponent(slug)}?${qs}`,
    );
  },

  bySlug(slug: string) {
    return apiFetch<AdminArticle>(
      `/articles/${encodeURIComponent(slug)}`,
    );
  },
};

export type PublicAd = {
  id: number;
  title: string;
  imageUrl: string;
  href: string;
  format: string;
};

export const adsPublicApi = {
  pick(format: string, emplacement: string, exclude: number[] = []) {
    const qs = new URLSearchParams();
    qs.set("format", format);
    qs.set("emplacement", emplacement);
    if (exclude.length > 0) qs.set("exclude", exclude.join(","));
    return apiFetch<{ ad: PublicAd | null }>(`/ads?${qs}`);
  },
};

export type PublicHomeVideo = {
  id: string;
  youtubeId: string;
  title: string;
  subtitle: string;
  websiteUrl: string | null;
  embedUrl: string;
};

export const homeVideoPublicApi = {
  active() {
    return apiFetch<{ video: PublicHomeVideo | null }>("/home-video");
  },
};

export type AdminHomeVideo = PublicHomeVideo & {
  legacyId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminHomeVideoInput = {
  youtubeId: string;
  title: string;
  subtitle?: string;
  websiteUrl?: string | null;
  isActive?: boolean;
};

export const adminHomeVideosApi = {
  list() {
    return apiFetch<{ items: AdminHomeVideo[]; total: number }>(
      "/admin/home-videos",
    );
  },
  create(input: AdminHomeVideoInput) {
    return apiFetch<AdminHomeVideo>("/admin/home-videos", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(id: string, input: Partial<AdminHomeVideoInput>) {
    return apiFetch<AdminHomeVideo>(`/admin/home-videos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  toggle(id: string) {
    return apiFetch<AdminHomeVideo>(`/admin/home-videos/${id}/toggle`, {
      method: "PATCH",
    });
  },
  remove(id: string) {
    return apiFetch<{ ok: boolean }>(`/admin/home-videos/${id}`, {
      method: "DELETE",
    });
  },
};

export type MagazineReadSession = {
  id: string;
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  accessType: string;
  canRead: boolean;
  preview?: boolean;
  maxPages?: number | null;
  theme?: { bgColor: string; accentColor: string };
  code: string | null;
  message: string | null;
  accessVia: "free" | "subscription" | "purchase" | "preview" | null;
  viewer: "pdf" | "pages" | null;
  readerUrl: string | null;
  downloadUrl: string | null;
  pagesStatus?: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  /** ISO — expiration des URLs signées des pages WebP. */
  pagesUrlExpiresAt?: string | null;
  pages?:
    | {
        pageNumber: number;
        url: string;
        thumbUrl: string | null;
        width: number;
        height: number;
      }[]
    | null;
};

export const paymentsApi = {
  createFlexpaie(planId: string, phone: string) {
    return apiFetch<{
      paymentId: string;
      reference: string;
      orderNumber: string | null;
      message: string;
    }>("/payments/flexpaie/create", {
      method: "POST",
      body: JSON.stringify({ planId, phone }),
    });
  },

  createFlexpaiePurchase(magazineId: string, phone: string) {
    return apiFetch<{
      paymentId: string;
      reference: string;
      orderNumber: string | null;
      message: string;
    }>("/payments/flexpaie/purchase", {
      method: "POST",
      body: JSON.stringify({ magazineId, phone }),
    });
  },

  get(id: string) {
    return apiFetch<PublicPayment>(`/payments/${id}`);
  },

  check(id: string) {
    return apiFetch<PublicPayment>(`/payments/${id}/check`, {
      method: "POST",
    });
  },
};

export const adminPlansApi = {
  list(params?: { active?: string }) {
    const qs = new URLSearchParams();
    if (params?.active) qs.set("active", params.active);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<{ items: AdminPlan[]; total: number }>(
      `/admin/plans${suffix}`,
    );
  },

  create(input: AdminPlanInput) {
    return apiFetch<AdminPlan>("/admin/plans", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminPlanInput>) {
    return apiFetch<AdminPlan>(`/admin/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type MagazineAccessType = "FREE" | "PAID";

export type MagazinePagesStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "FAILED";

export type AdminMagazine = {
  id: string;
  legacyId: number | null;
  title: string;
  description: string | null;
  issueNumber: string | null;
  accessType: MagazineAccessType;
  priceCents: number | null;
  currency: string;
  theme: { bgColor: string; accentColor: string };
  coverKey: string | null;
  coverUrl: string | null;
  pdfKey: string | null;
  previewKey: string | null;
  downloadKey: string | null;
  downloadUrl?: string | null;
  pagesStatus: MagazinePagesStatus;
  pagesCount: number | null;
  pagesError: string | null;
  /** Pages WebP déjà en base (utile pendant PROCESSING). */
  generatedPageCount: number;
  viewCount: number;
  isPublished: boolean;
  isActive: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminMagazineInput = {
  title: string;
  description?: string | null;
  issueNumber?: string | null;
  accessType: MagazineAccessType;
  priceCents?: number | null;
  currency?: string;
  theme?: { bgColor: string; accentColor: string } | null;
  coverKey?: string | null;
  pdfKey?: string | null;
  previewKey?: string | null;
  downloadKey?: string | null;
  isPublished?: boolean;
  isActive?: boolean;
};

export type AdminMagazineListResponse = {
  items: AdminMagazine[];
  total: number;
  take: number;
  skip: number;
};

export const adminMagazinesApi = {
  list(params?: {
    q?: string;
    published?: string;
    active?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.published) qs.set("published", params.published);
    if (params?.active) qs.set("active", params.active);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminMagazineListResponse>(`/admin/magazines${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminMagazine>(`/admin/magazines/${id}`);
  },

  create(input: AdminMagazineInput) {
    return apiFetch<AdminMagazine>("/admin/magazines", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminMagazineInput>) {
    return apiFetch<AdminMagazine>(`/admin/magazines/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  uploadCover(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminMagazine>(`/admin/magazines/${id}/cover`, body);
  },

  /** @deprecated Prefer uploadPdfDirect (presigned R2). */
  uploadPdf(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminMagazine>(`/admin/magazines/${id}/pdf`, body);
  },

  presignPdf(
    id: string,
    input: { filename: string; size: number; contentType?: string },
  ) {
    return apiFetch<{
      key: string;
      uploadUrl: string;
      headers: Record<string, string>;
      expiresIn: number;
      maxSize: number;
    }>(`/admin/magazines/${id}/pdf/presign`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  completePdf(id: string, input: { key: string; size: number }) {
    return apiFetch<AdminMagazine>(`/admin/magazines/${id}/pdf/complete`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Upload PDF direct → R2 (presigned PUT), puis confirme côté API.
   * Pas de passage du fichier par Nest.
   */
  async uploadPdfDirect(
    id: string,
    file: File,
    opts?: {
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    },
  ) {
    if (file.size > 350_000_000) {
      throw new Error("Le PDF dépasse 350 Mo");
    }

    const signed = await this.presignPdf(id, {
      filename: file.name,
      size: file.size,
      contentType: file.type || "application/pdf",
    });

    await putFileToPresignedUrl(file, signed.uploadUrl, signed.headers, {
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });

    return this.completePdf(id, { key: signed.key, size: file.size });
  },

  /** Démarre / reprend la génération WebP (sans purge). */
  ensurePages(id: string) {
    return apiFetch<AdminMagazine>(`/admin/magazines/${id}/pages/ensure`, {
      method: "POST",
    });
  },

  /** Purge + régénère toutes les pages. */
  reprocessPages(id: string) {
    return apiFetch<AdminMagazine>(`/admin/magazines/${id}/pages/reprocess`, {
      method: "POST",
    });
  },
};

function putFileToPresignedUrl(
  file: File,
  uploadUrl: string,
  headers: Record<string, string>,
  opts?: {
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);

    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !opts?.onProgress) return;
      const percent = Math.min(
        100,
        Math.round((event.loaded / event.total) * 100),
      );
      opts.onProgress(percent);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts?.onProgress?.(100);
        resolve();
        return;
      }
      reject(
        new Error(
          `Échec upload R2 (${xhr.status}${xhr.statusText ? ` ${xhr.statusText}` : ""})`,
        ),
      );
    };

    xhr.onerror = () => {
      reject(
        new Error(
          "Échec réseau vers R2 (CORS bucket ? lancez configure-r2-cors)",
        ),
      );
    };

    xhr.onabort = () => {
      reject(new Error("Upload PDF annulé"));
    };

    if (opts?.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(file);
  });
}

export const ARTICLE_CATEGORIES = ARTICLE_CATEGORY_OPTIONS;
export type ArticleCategoryValue =
  (typeof ARTICLE_CATEGORIES)[number]["value"];

export type AdminArticleBlock = {
  id: string | null;
  position: number;
  title: string | null;
  coverKey: string | null;
  coverCaption: string | null;
  coverUrl: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminArticleMagazine = {
  id: string;
  title: string;
  issueNumber: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  isActive: boolean;
  theme?: { bgColor: string; accentColor: string };
};

export type AdminSponsor = {
  id: string;
  name: string;
  logoKey: string | null;
  logoUrl: string | null;
  url: string | null;
  articlesCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminSponsorInput = {
  name: string;
  url?: string | null;
};

export type AdminSponsorListResponse = {
  items: AdminSponsor[];
  total: number;
  take: number;
  skip: number;
};

export type AdValidationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type AdPaymentStatus = "FREE" | "PAID" | "PENDING";
export type AdDiffusionStatus = "ACTIVE" | "INACTIVE" | "ENDED";

export type AdminAd = {
  id: string;
  legacyId: number | null;
  title: string;
  format: string;
  placement: string | null;
  dimensions: string;
  imageUrl: string | null;
  targetUrl: string;
  startsOn: string;
  endsOn: string;
  impressions: number;
  views: number;
  clicks: number;
  amountPaid: number;
  paymentStatus: AdPaymentStatus;
  validationStatus: AdValidationStatus;
  refusalReason: string | null;
  diffusionStatus: AdDiffusionStatus;
  isLocked: boolean;
  createdByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminAdInput = {
  title: string;
  placement: string;
  targetUrl: string;
  startsOn: string;
  endsOn: string;
  isLocked?: boolean;
};

export type AdminAdListResponse = {
  items: AdminAd[];
  total: number;
  take: number;
  skip: number;
  summary: {
    pending: number;
    approved: number;
    active: number;
    revenue: number;
  };
};

export type AdminAdRate = {
  id: string;
  format: string;
  dimensions: string;
  price7Days: number;
  price15Days: number;
  price30Days: number;
  isActive: boolean;
};

export const adminAdsApi = {
  list(params?: {
    q?: string;
    validation?: string;
    payment?: string;
    diffusion?: string;
    placement?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.validation) qs.set("validation", params.validation);
    if (params?.payment) qs.set("payment", params.payment);
    if (params?.diffusion) qs.set("diffusion", params.diffusion);
    if (params?.placement) qs.set("placement", params.placement);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminAdListResponse>(`/admin/ads${suffix}`);
  },

  create(input: AdminAdInput) {
    return apiFetch<AdminAd>("/admin/ads", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminAdInput>) {
    return apiFetch<AdminAd>(`/admin/ads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  uploadImage(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminAd>(`/admin/ads/${id}/image`, body);
  },

  validate(id: string) {
    return apiFetch<AdminAd>(`/admin/ads/${id}/validate`, {
      method: "POST",
      body: "{}",
    });
  },

  refuse(id: string, reason: string) {
    return apiFetch<AdminAd>(`/admin/ads/${id}/refuse`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  activate(id: string) {
    return apiFetch<AdminAd>(`/admin/ads/${id}/activate`, {
      method: "POST",
      body: "{}",
    });
  },

  deactivate(id: string) {
    return apiFetch<AdminAd>(`/admin/ads/${id}/deactivate`, {
      method: "POST",
      body: "{}",
    });
  },

  remove(id: string) {
    return apiFetch<{ ok: boolean }>(`/admin/ads/${id}`, { method: "DELETE" });
  },

  rates() {
    return apiFetch<{ items: AdminAdRate[] }>("/admin/ads/rates");
  },

  updateRate(
    id: string,
    input: Partial<Pick<AdminAdRate, "price7Days" | "price15Days" | "price30Days" | "isActive">>,
  ) {
    return apiFetch<AdminAdRate>(`/admin/ads/rates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type AdminArticleSponsor = {
  id: string;
  name: string;
  logoUrl: string | null;
  url: string | null;
};

export type AdminAuthor = {
  id: string;
  name: string;
  title: string | null;
  avatarKey: string | null;
  avatarUrl: string | null;
  adminUserId: string | null;
  articlesCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminAuthorInput = {
  name: string;
  title?: string | null;
};

export type AdminAuthorListResponse = {
  items: AdminAuthor[];
  total: number;
  take: number;
  skip: number;
};

export type AdminArticleAuthor = {
  id: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
  adminUserId: string | null;
};

export type AdminArticle = {
  id: string;
  legacyId: number | null;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverKey: string | null;
  coverCaption: string | null;
  coverUrl: string | null;
  category: string | null;
  viewCount: number;
  isPublished: boolean;
  isFeatured: boolean;
  featuredAt?: string | null;
  magazineId: string | null;
  magazine: AdminArticleMagazine | null;
  sponsorId?: string | null;
  sponsor?: AdminArticleSponsor | null;
  authorId: string | null;
  author: { id: string; name: string; email: string; avatarUrl?: string | null } | null;
  bylineAuthorId?: string | null;
  bylineAuthor?: AdminArticleAuthor | null;
  commentsCount: number;
  blocks: AdminArticleBlock[];
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  videoSourceKey?: string | null;
  videoHlsKey?: string | null;
  videoHlsUrl?: string | null;
  videoPosterKey?: string | null;
  videoPosterUrl?: string | null;
  videoStatus?: "NONE" | "PENDING" | "PROCESSING" | "READY" | "FAILED";
  videoError?: string | null;
  videoDurationSec?: number | null;
  youtubeUrl?: string | null;
  tags?: string[];
  readingMinutes?: number;
  isPaid?: boolean;
  priceCents?: number | null;
  locked?: boolean;
  previous?: { slug: string; title: string; coverUrl: string | null } | null;
  next?: { slug: string; title: string; coverUrl: string | null } | null;
};

export type AdminArticleBlockInput = {
  id?: string;
  title?: string | null;
  coverCaption?: string | null;
  content?: string;
  position?: number;
};

export type AdminArticleInput = {
  title: string;
  slug?: string;
  content?: string;
  excerpt?: string | null;
  category?: string | null;
  coverCaption?: string | null;
  isPublished?: boolean;
  isFeatured?: boolean;
  publishedAt?: string | null;
  magazineId?: string | null;
  sponsorId?: string | null;
  bylineAuthorId?: string | null;
  blocks?: AdminArticleBlockInput[];
};

export type AdminArticleSummary = {
  total: number;
  published: number;
  drafts: number;
  featured: number;
};

export type AdminArticleListResponse = {
  items: AdminArticle[];
  total: number;
  take: number;
  skip: number;
  summary: AdminArticleSummary;
};

export const adminSponsorsApi = {
  list(params?: { q?: string; take?: number; skip?: number }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminSponsorListResponse>(`/admin/sponsors${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminSponsor>(`/admin/sponsors/${id}`);
  },

  create(input: AdminSponsorInput) {
    return apiFetch<AdminSponsor>("/admin/sponsors", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminSponsorInput>) {
    return apiFetch<AdminSponsor>(`/admin/sponsors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  uploadLogo(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminSponsor>(`/admin/sponsors/${id}/logo`, body);
  },

  remove(id: string) {
    return apiFetch<{ ok: boolean }>(`/admin/sponsors/${id}`, {
      method: "DELETE",
    });
  },
};

export const adminAuthorsApi = {
  list(params?: { q?: string; take?: number; skip?: number }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminAuthorListResponse>(`/admin/authors${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminAuthor>(`/admin/authors/${id}`);
  },

  create(input: AdminAuthorInput) {
    return apiFetch<AdminAuthor>("/admin/authors", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminAuthorInput>) {
    return apiFetch<AdminAuthor>(`/admin/authors/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  uploadAvatar(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminAuthor>(`/admin/authors/${id}/avatar`, body);
  },

  remove(id: string) {
    return apiFetch<{ ok: boolean }>(`/admin/authors/${id}`, {
      method: "DELETE",
    });
  },
};

export const adminArticlesApi = {
  list(params?: {
    q?: string;
    published?: string;
    category?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.published) qs.set("published", params.published);
    if (params?.category) qs.set("category", params.category);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminArticleListResponse>(`/admin/articles${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminArticle>(`/admin/articles/${id}`);
  },

  create(input: AdminArticleInput) {
    return apiFetch<AdminArticle>("/admin/articles", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminArticleInput>) {
    return apiFetch<AdminArticle>(`/admin/articles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove(id: string) {
    return apiFetch<{ ok: true }>(`/admin/articles/${id}`, {
      method: "DELETE",
    });
  },

  uploadCover(
    id: string,
    file: File,
    opts?: { onProgress?: (percent: number) => void },
  ) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminArticle>(
      `/admin/articles/${id}/cover`,
      body,
      false,
      opts?.onProgress,
    );
  },

  uploadBlockCover(
    articleId: string,
    blockId: string,
    file: File,
    opts?: { onProgress?: (percent: number) => void },
  ) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminArticle>(
      `/admin/articles/${articleId}/blocks/${blockId}/cover`,
      body,
      false,
      opts?.onProgress,
    );
  },

  presignVideo(
    id: string,
    input: { filename: string; size: number; contentType?: string },
  ) {
    return apiFetch<{
      key: string;
      uploadUrl: string;
      headers: Record<string, string>;
      expiresIn: number;
      maxSize: number;
    }>(`/admin/articles/${id}/video/presign`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  completeVideo(id: string, input: { key: string; size: number }) {
    return apiFetch<AdminArticle>(`/admin/articles/${id}/video/complete`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  reprocessVideo(id: string) {
    return apiFetch<AdminArticle>(`/admin/articles/${id}/video/reprocess`, {
      method: "POST",
    });
  },

  clearVideo(id: string) {
    return apiFetch<AdminArticle>(`/admin/articles/${id}/video`, {
      method: "DELETE",
    });
  },

  async uploadVideoDirect(
    id: string,
    file: File,
    opts?: {
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    },
  ) {
    if (file.size > 500_000_000) {
      throw new Error("La vidéo dépasse 500 Mo");
    }

    const signed = await this.presignVideo(id, {
      filename: file.name,
      size: file.size,
      contentType: file.type || "video/mp4",
    });

    await putFileToPresignedUrl(file, signed.uploadUrl, signed.headers, {
      onProgress: opts?.onProgress,
      signal: opts?.signal,
    });

    return this.completeVideo(id, { key: signed.key, size: file.size });
  },
};

// ─── Événements (informatifs) ───────────────────────────────────────────────

export type EventTypeName =
  | "CONFERENCE"
  | "SUMMIT"
  | "MEETUP"
  | "WEBINAR"
  | "WORKSHOP"
  | "OTHER";
export type EventFormatName = "IN_PERSON" | "ONLINE" | "HYBRID";
export type EventStatusName = "DRAFT" | "PUBLISHED";

export type EventPrice = { currency: string; amount: number };

export type EventTicketTier = {
  id: string;
  name: string;
  description: string | null;
  prices: EventPrice[];
};

export type EventProgrammeItem = {
  day: string | null;
  time: string;
  endTime: string | null;
  title: string;
  description: string | null;
  speakers: string[];
};

export type EventSpeaker = {
  id: string;
  name: string;
  role: string | null;
  organization: string | null;
  photoKey: string | null;
  photoUrl: string | null;
  bio: string | null;
};

export type EventCoOrganizer = {
  id: string;
  name: string;
  logoKey: string | null;
  logoUrl: string | null;
  /** Couleur de fond détectée sur le logo (#rrggbb) */
  logoBg?: string | null;
  url: string | null;
};

export type EventSponsorItem = {
  id: string;
  name: string;
  url: string | null;
  logoUrl: string | null;
  tier: string | null;
};

export type PublicEventCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  type: EventTypeName;
  format: EventFormatName;
  startsAt: string;
  endsAt: string | null;
  city: string | null;
  country: string | null;
  venueName: string | null;
  coverUrl: string | null;
  hasTicketing: boolean;
  isFree: boolean;
  minPrices: EventPrice[];
  hasFreeTier: boolean;
  sponsorsCount: number;
};

export type PublicEventDetail = PublicEventCard & {
  description: string | null;
  organizer: string | null;
  organizerLogoUrl: string | null;
  organizerLogoBg?: string | null;
  coOrganizers: EventCoOrganizer[];
  venueAddress: string | null;
  mapUrl: string | null;
  onlineUrl: string | null;
  ticketUrl: string | null;
  /** Couleur de la charte (#RRGGBB) ou null = couleur du site. */
  themeColor: string | null;
  programme: EventProgrammeItem[];
  speakers: EventSpeaker[];
  ticketTiers: EventTicketTier[];
  sponsors: EventSponsorItem[];
};

export type PublicEventListResponse = {
  items: PublicEventCard[];
  total: number;
  take: number;
  skip: number;
  cities: string[];
};

export type EventListParams = {
  when?: "upcoming" | "past";
  city?: string;
  format?: EventFormatName;
  type?: EventTypeName;
  take?: number;
  skip?: number;
  /** Jour précis YYYY-MM-DD (Kinshasa) — remplace `when`. */
  date?: string;
};

export type EventDaysParams = {
  from: string;
  to: string;
  city?: string;
  format?: EventFormatName;
};

export const eventsPublicApi = {
  list(params: EventListParams = {}) {
    const qs = new URLSearchParams();
    if (params.when) qs.set("when", params.when);
    if (params.city?.trim()) qs.set("city", params.city.trim());
    if (params.format) qs.set("format", params.format);
    if (params.type) qs.set("type", params.type);
    if (params.take != null) qs.set("take", String(params.take));
    if (params.skip != null) qs.set("skip", String(params.skip));
    if (params.date) qs.set("date", params.date);
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<PublicEventListResponse>(`/events${suffix}`);
  },

  /** Jours (YYYY-MM-DD) ayant au moins un événement sur la plage. */
  days(params: EventDaysParams) {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    if (params.city?.trim()) qs.set("city", params.city.trim());
    if (params.format) qs.set("format", params.format);
    return apiFetch<{ days: string[] }>(`/events/days?${qs}`);
  },

  bySlug(slug: string) {
    return apiFetch<PublicEventDetail>(`/events/${encodeURIComponent(slug)}`);
  },

  trackView(slug: string) {
    return apiFetch<{ ok: true }>(
      `/events/${encodeURIComponent(slug)}/view`,
      { method: "POST" },
    );
  },

  ticketClick(slug: string) {
    return apiFetch<{ ok: true; ticketUrl: string }>(
      `/events/${encodeURIComponent(slug)}/ticket-click`,
      { method: "POST" },
    );
  },
};

export type AdminEvent = PublicEventDetail & {
  status: EventStatusName;
  coverKey: string | null;
  organizerLogoKey: string | null;
  viewCount: number;
  ticketClicks: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminEventInput = {
  title: string;
  slug?: string;
  summary?: string | null;
  description?: string | null;
  type?: EventTypeName;
  format?: EventFormatName;
  status?: EventStatusName;
  startsAt: string;
  endsAt?: string | null;
  organizer?: string | null;
  organizerLogoKey?: string | null;
  organizerLogoBg?: string | null;
  coOrganizers?: Omit<EventCoOrganizer, "logoUrl">[];
  city?: string | null;
  country?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  mapUrl?: string | null;
  onlineUrl?: string | null;
  ticketUrl?: string | null;
  themeColor?: string | null;
  programme?: Omit<EventProgrammeItem, never>[];
  speakers?: Omit<EventSpeaker, "photoUrl">[];
  ticketTiers?: EventTicketTier[];
  sponsors?: { sponsorId: string; tier?: string | null }[];
};

export type AdminEventListResponse = {
  items: AdminEvent[];
  total: number;
  take: number;
  skip: number;
  summary: { total: number; published: number; drafts: number; upcoming: number };
};

export type AdminEventStats = {
  totals: {
    views: number;
    ticketClicks: number;
    views30d: number;
    ticketClicks30d: number;
  };
  series: { day: string; views: number; ticketClicks: number }[];
  events: {
    id: string;
    title: string;
    slug: string;
    status: EventStatusName;
    startsAt: string;
    city: string | null;
    views: number;
    ticketClicks: number;
    hasTicketing: boolean;
    clickRate: number;
  }[];
};

export const adminEventsApi = {
  list(params?: {
    q?: string;
    status?: EventStatusName | "";
    when?: "upcoming" | "past" | "";
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.status) qs.set("status", params.status);
    if (params?.when) qs.set("when", params.when);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminEventListResponse>(`/admin/events${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminEvent>(`/admin/events/${id}`);
  },

  create(input: AdminEventInput) {
    return apiFetch<AdminEvent>("/admin/events", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminEventInput>) {
    return apiFetch<AdminEvent>(`/admin/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove(id: string) {
    return apiFetch<{ ok: boolean }>(`/admin/events/${id}`, {
      method: "DELETE",
    });
  },

  uploadCover(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminEvent>(`/admin/events/${id}/cover`, body);
  },

  uploadImage(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<{ key: string; url: string | null; bg?: string | null }>(
      `/admin/events/${id}/image`,
      body,
    );
  },

  stats(eventId?: string) {
    const suffix = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
    return apiFetch<AdminEventStats>(`/admin/events/stats${suffix}`);
  },
};

// ─── Offres d’emploi (Jobs) ─────────────────────────────────────────────────

export type JobContractTypeName =
  | "CDI"
  | "CDD"
  | "INTERNSHIP"
  | "FREELANCE"
  | "CONSULTANCY"
  | "APPRENTICESHIP"
  | "VOLUNTEER"
  | "OTHER";
export type JobWorkModeName = "ON_SITE" | "REMOTE" | "HYBRID";
export type JobStatusName = "DRAFT" | "PUBLISHED";

export type PublicJobCard = {
  id: string;
  slug: string;
  title: string;
  companyName: string;
  companyLogoUrl: string | null;
  /** Secteur de l’entreprise (annuaire) */
  companySector?: JobCompanySectorName | null;
  /** Couleur de fond détectée sur la bordure du logo (#rrggbb) */
  companyLogoBg?: string | null;
  contractType: JobContractTypeName;
  workMode: JobWorkModeName;
  locations: string[];
  /** Fin de journée (Kinshasa) de la date limite, ou null = sans limite */
  deadline: string | null;
  isOpen: boolean;
  publishedAt: string | null;
  excerpt: string | null;
};

export type PublicJobDetail = PublicJobCard & {
  companyUrl: string | null;
  description: string | null;
  applyUrl: string | null;
  applyEmail: string | null;
  updatedAt: string;
  related?: PublicJobCard[];
};

/** Entrée de l’annuaire des entreprises fintech qui recrutent. */
export type JobCompanySectorName =
  | "PAYMENTS"
  | "BANKING"
  | "MICROFINANCE"
  | "LENDING"
  | "INSURTECH"
  | "WEALTH"
  | "CRYPTO"
  | "INFRASTRUCTURE"
  | "REGTECH"
  | "OTHER";

export type PublicJobCompany = {
  slug: string;
  name: string;
  logoUrl: string | null;
  logoBg?: string | null;
  url: string | null;
  sector: JobCompanySectorName | null;
  headquarters: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  openJobs: number;
};

export type PublicJobListResponse = {
  items: PublicJobCard[];
  total: number;
  take: number;
  skip: number;
  locations: string[];
  /** Nombre d’offres par valeur (période courante, hors autres filtres) */
  facets?: {
    contract: Partial<Record<JobContractTypeName, number>>;
    mode: Partial<Record<JobWorkModeName, number>>;
  };
};

export type JobListParams = {
  when?: "open" | "closed";
  q?: string;
  location?: string;
  /** Plusieurs valeurs possibles (cases à cocher) */
  contract?: JobContractTypeName[];
  mode?: JobWorkModeName[];
  sector?: JobCompanySectorName[];
  sort?: "recent" | "deadline";
  take?: number;
  skip?: number;
};

export const jobsPublicApi = {
  companies() {
    return apiFetch<{ items: PublicJobCompany[]; total: number }>(
      "/jobs/companies",
    );
  },

  list(params: JobListParams = {}) {
    const qs = new URLSearchParams();
    if (params.when) qs.set("when", params.when);
    if (params.q?.trim()) qs.set("q", params.q.trim());
    if (params.location?.trim()) qs.set("location", params.location.trim());
    if (params.contract?.length) qs.set("contract", params.contract.join(","));
    if (params.mode?.length) qs.set("mode", params.mode.join(","));
    if (params.sector?.length) qs.set("sector", params.sector.join(","));
    if (params.sort && params.sort !== "recent") qs.set("sort", params.sort);
    if (params.take != null) qs.set("take", String(params.take));
    if (params.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<PublicJobListResponse>(`/jobs${suffix}`);
  },

  bySlug(slug: string) {
    return apiFetch<PublicJobDetail>(`/jobs/${encodeURIComponent(slug)}`);
  },

  trackView(slug: string) {
    return apiFetch<{ ok: true }>(`/jobs/${encodeURIComponent(slug)}/view`, {
      method: "POST",
    });
  },

  applyClick(slug: string) {
    return apiFetch<{ ok: true }>(
      `/jobs/${encodeURIComponent(slug)}/apply-click`,
      { method: "POST" },
    );
  },
};

export type AdminJob = PublicJobDetail & {
  status: JobStatusName;
  companyLogoKey: string | null;
  viewCount: number;
  applyClicks: number;
  createdAt: string;
};

export type AdminJobInput = {
  title: string;
  slug?: string;
  companyName: string;
  companyLogoKey?: string | null;
  companyUrl?: string | null;
  /** Fiche annuaire (enregistrés sur l’entreprise) */
  companySector?: JobCompanySectorName | null;
  companyHeadquarters?: string | null;
  companyAppStoreUrl?: string | null;
  companyPlayStoreUrl?: string | null;
  contractType?: JobContractTypeName;
  workMode?: JobWorkModeName;
  status?: JobStatusName;
  locations?: string[];
  /** YYYY-MM-DD (jour à Kinshasa) */
  deadline?: string | null;
  description?: string | null;
  applyUrl?: string | null;
  applyEmail?: string | null;
};

export type AdminJobListResponse = {
  items: AdminJob[];
  total: number;
  take: number;
  skip: number;
  summary: { total: number; published: number; drafts: number; open: number };
};

export type AdminJobCompany = {
  id: string;
  slug: string;
  name: string;
  logoKey: string | null;
  logoUrl: string | null;
  logoBg?: string | null;
  url: string | null;
  sector: JobCompanySectorName | null;
  headquarters: string | null;
  appStoreUrl: string | null;
  playStoreUrl: string | null;
  /** Nombre d’offres (liste admin) */
  jobs?: number;
};

export type AdminJobCompanyInput = {
  name?: string;
  logoKey?: string | null;
  url?: string | null;
  sector?: JobCompanySectorName | null;
  headquarters?: string | null;
  appStoreUrl?: string | null;
  playStoreUrl?: string | null;
};

export const adminJobsApi = {
  list(params?: {
    q?: string;
    status?: JobStatusName | "";
    when?: "open" | "closed" | "";
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.q?.trim()) qs.set("q", params.q.trim());
    if (params?.status) qs.set("status", params.status);
    if (params?.when) qs.set("when", params.when);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminJobListResponse>(`/admin/jobs${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminJob>(`/admin/jobs/${id}`);
  },

  companies() {
    return apiFetch<{ items: AdminJobCompany[] }>("/admin/jobs/companies");
  },

  updateCompany(id: string, input: AdminJobCompanyInput) {
    return apiFetch<AdminJobCompany>(`/admin/jobs/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  uploadCompanyLogo(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminJobCompany>(
      `/admin/jobs/companies/${id}/logo`,
      body,
    );
  },

  create(input: AdminJobInput) {
    return apiFetch<AdminJob>("/admin/jobs", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: Partial<AdminJobInput>) {
    return apiFetch<AdminJob>(`/admin/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove(id: string) {
    return apiFetch<{ ok: boolean }>(`/admin/jobs/${id}`, { method: "DELETE" });
  },

  uploadLogo(id: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminJob>(`/admin/jobs/${id}/logo`, body);
  },
};

// ---------------------------------------------------------------- Statuts

export type AdminStatusState =
  | "draft"
  | "awaiting_payment"
  | "pending"
  | "rejected"
  | "active"
  | "expired";

export type AdminStatusSource = "ADMIN" | "SUBSCRIBER";
export type AdminStatusBilling = "NONE" | "PASS" | "SINGLE";
export type AdminStatusPaymentState = "FREE" | "PENDING" | "PAID";
export type AdminStatusModeration = "PENDING" | "APPROVED" | "REJECTED";
export type StatusOfferKind = "SINGLE" | "PASS";

export type AdminStatusImageFit = "COVER" | "FIT";

export type AdminStatusArticle = {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  coverUrl: string | null;
};

/** Diapo d’un statut : image, vidéo, texte et/ou article lié */
export type AdminStatusSlide = {
  id: string;
  position: number;
  mediaType: "IMAGE" | "VIDEO" | null;
  mediaUrl: string | null;
  posterUrl: string | null;
  imageFit: AdminStatusImageFit;
  caption: string | null;
  linkUrl: string | null;
  articleId: string | null;
  article: AdminStatusArticle | null;
  durationSec: number;
};

/** Statut = une bulle dans l’app, avec une ou plusieurs diapos */
export type AdminStatus = {
  id: string;
  /** Titre sous la bulle ; null = déduit des diapos */
  title: string | null;
  state: AdminStatusState;
  slides: AdminStatusSlide[];
  /** Position dans la rangée de bulles (0 = nouveau, en tête) */
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string;
  viewCount: number;
  author: { id: string; name: string } | null;
  source: AdminStatusSource;
  /** Abonné auteur (statuts payants) */
  subscriber: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
  billing: AdminStatusBilling;
  paymentState: AdminStatusPaymentState;
  paymentId: string | null;
  passId: string | null;
  offer: {
    id: string;
    kind: StatusOfferKind;
    label: string;
    priceCents: number;
    currency: string;
    statusLifetimeHours: number;
  } | null;
  moderation: AdminStatusModeration;
  refusalReason: string | null;
  moderatedAt: string | null;
  moderatedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminStatusInput = {
  title?: string | null;
  ttlHours?: number;
  isPublished?: boolean;
  expiresAt?: string;
};

export type AdminStatusSlideInput = {
  caption?: string | null;
  linkUrl?: string | null;
  articleId?: string | null;
  durationSec?: number;
  imageFit?: AdminStatusImageFit;
  clearMedia?: boolean;
};

export type AdminStatusListResponse = {
  items: AdminStatus[];
  total: number;
  take: number;
  skip: number;
  /** Statuts abonnés en attente de validation (badge) */
  pendingCount: number;
};

export const adminStatusesApi = {
  list(params?: {
    state?: string;
    source?: string;
    take?: number;
    skip?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.state) qs.set("state", params.state);
    if (params?.source) qs.set("source", params.source);
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<AdminStatusListResponse>(`/admin/statuses${suffix}`);
  },

  get(id: string) {
    return apiFetch<AdminStatus>(`/admin/statuses/${id}`);
  },

  create(input: AdminStatusInput) {
    return apiFetch<AdminStatus>("/admin/statuses", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: AdminStatusInput) {
    return apiFetch<AdminStatus>(`/admin/statuses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  move(id: string, direction: "up" | "down") {
    return apiFetch<{ ok: boolean }>(`/admin/statuses/${id}/move`, {
      method: "POST",
      body: JSON.stringify({ direction }),
    });
  },

  /** Regroupe `id` dans `targetId` : ses diapos passent à la suite. */
  merge(id: string, targetId: string) {
    return apiFetch<AdminStatus>(`/admin/statuses/${id}/merge`, {
      method: "POST",
      body: JSON.stringify({ targetId }),
    });
  },

  remove(id: string) {
    return apiFetch<{ ok: boolean }>(`/admin/statuses/${id}`, {
      method: "DELETE",
    });
  },

  /** Valide un statut abonné : il passe en ligne */
  approve(id: string, ttlHours?: number) {
    return apiFetch<AdminStatus>(`/admin/statuses/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(ttlHours ? { ttlHours } : {}),
    });
  },

  reject(id: string, reason: string) {
    return apiFetch<AdminStatus>(`/admin/statuses/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  createSlide(statusId: string, input: AdminStatusSlideInput) {
    return apiFetch<AdminStatusSlide>(`/admin/statuses/${statusId}/slides`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updateSlide(slideId: string, input: AdminStatusSlideInput) {
    return apiFetch<AdminStatusSlide>(`/admin/statuses/slides/${slideId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  removeSlide(slideId: string) {
    return apiFetch<{ ok: boolean }>(`/admin/statuses/slides/${slideId}`, {
      method: "DELETE",
    });
  },

  reorderSlides(statusId: string, ids: string[]) {
    return apiFetch<AdminStatus>(`/admin/statuses/${statusId}/slides/order`, {
      method: "PUT",
      body: JSON.stringify({ ids }),
    });
  },

  uploadSlideImage(
    slideId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminStatusSlide>(
      `/admin/statuses/slides/${slideId}/image`,
      body,
      false,
      onProgress,
    );
  },

  uploadSlidePoster(slideId: string, file: File) {
    const body = new FormData();
    body.append("file", file);
    return apiFetchForm<AdminStatusSlide>(
      `/admin/statuses/slides/${slideId}/poster`,
      body,
    );
  },

  async uploadSlideVideo(
    slideId: string,
    file: File,
    opts?: { onProgress?: (percent: number) => void; signal?: AbortSignal },
  ) {
    const signed = await apiFetch<{
      key: string;
      uploadUrl: string;
      headers: Record<string, string>;
    }>(`/admin/statuses/slides/${slideId}/video/presign`, {
      method: "POST",
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        contentType: file.type || "video/mp4",
      }),
    });
    await putFileToPresignedUrl(file, signed.uploadUrl, signed.headers, opts);
    return apiFetch<AdminStatusSlide>(
      `/admin/statuses/slides/${slideId}/video/complete`,
      {
        method: "POST",
        body: JSON.stringify({ key: signed.key }),
      },
    );
  },
};

export type AdminStatusOffer = {
  id: string;
  kind: StatusOfferKind;
  label: string;
  description: string | null;
  priceCents: number;
  currency: string;
  statusLifetimeHours: number;
  quota: number | null;
  periodDays: number | null;
  isActive: boolean;
  sortOrder: number;
  statusCount?: number;
  passCount?: number;
};

export type AdminStatusOfferInput = {
  kind?: StatusOfferKind;
  label?: string;
  description?: string | null;
  priceCents?: number;
  currency?: string;
  statusLifetimeHours?: number;
  quota?: number | null;
  periodDays?: number | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type AdminStatusPass = {
  id: string;
  offer: { id: string; label: string } | null;
  paymentState: AdminStatusPaymentState;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  quota: number | null;
  usedCount: number;
  remaining: number | null;
  createdAt: string;
  subscriber: { id: string; name: string; email: string };
};

export const adminStatusOffersApi = {
  list() {
    return apiFetch<{ items: AdminStatusOffer[] }>("/admin/status-offers");
  },

  create(input: AdminStatusOfferInput) {
    return apiFetch<AdminStatusOffer>("/admin/status-offers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: string, input: AdminStatusOfferInput) {
    return apiFetch<AdminStatusOffer>(`/admin/status-offers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  remove(id: string) {
    return apiFetch<{ ok: boolean; deactivated: boolean }>(
      `/admin/status-offers/${id}`,
      { method: "DELETE" },
    );
  },

  passes(params?: { take?: number; skip?: number }) {
    const qs = new URLSearchParams();
    if (params?.take != null) qs.set("take", String(params.take));
    if (params?.skip != null) qs.set("skip", String(params.skip));
    const suffix = qs.toString() ? `?${qs}` : "";
    return apiFetch<{
      items: AdminStatusPass[];
      total: number;
      take: number;
      skip: number;
    }>(`/admin/status-offers/passes${suffix}`);
  },
};

