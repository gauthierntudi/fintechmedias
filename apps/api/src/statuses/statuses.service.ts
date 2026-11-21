import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityActorType,
  PaymentPurpose,
  Prisma,
  StatusBilling,
  StatusMediaType,
  StatusModeration,
  StatusOfferKind,
  StatusPaymentState,
  StatusSource,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { ActivityService } from '../activity/activity.service';
import {
  ArticlesService,
  PUBLIC_CARD_SELECT,
} from '../articles/articles.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  deleteR2Keys,
  headR2Object,
  presignR2PutObject,
  putR2Object,
} from '../storage/r2';
import {
  ApproveStatusDto,
  CompleteStatusVideoDto,
  CreateStatusDto,
  CreateStatusSlideDto,
  PresignStatusVideoDto,
  STATUS_MAX_SLIDES,
  STATUS_VIDEO_MAX_BYTES,
  UpdateStatusDto,
  UpdateStatusSlideDto,
} from './dto/admin-status.dto';
import {
  CreateMyStatusDto,
  SUBSCRIBER_MAX_SLIDES,
  SubmitMyStatusDto,
} from './dto/my-status.dto';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

/** Qui agit : un membre de l’équipe (admin) ou un abonné (ses propres statuts). */
export type StatusActor =
  { kind: 'admin'; id: string } | { kind: 'subscriber'; id: string };

const HOUR_MS = 3_600_000;
const DEFAULT_TTL_HOURS = 24;
const IMAGE_MAX_BYTES = 10_000_000;

/** Ordre des bulles : position choisie, puis les plus récents d’abord */
const STATUS_DISPLAY_ORDER: Prisma.StatusOrderByWithRelationInput[] = [
  { sortOrder: 'asc' },
  { publishedAt: 'desc' },
  { createdAt: 'desc' },
];

const SLIDE_ORDER: Prisma.StatusSlideOrderByWithRelationInput[] = [
  { position: 'asc' },
  { createdAt: 'asc' },
];

const ADMIN_SLIDE_SELECT = {
  id: true,
  statusId: true,
  position: true,
  mediaType: true,
  mediaKey: true,
  posterKey: true,
  imageFit: true,
  caption: true,
  linkUrl: true,
  articleId: true,
  durationSec: true,
  article: {
    select: {
      id: true,
      title: true,
      slug: true,
      isPublished: true,
      coverKey: true,
    },
  },
} satisfies Prisma.StatusSlideSelect;

const ADMIN_STATUS_SELECT = {
  id: true,
  source: true,
  title: true,
  sortOrder: true,
  isPublished: true,
  publishedAt: true,
  expiresAt: true,
  viewCount: true,
  billing: true,
  paymentState: true,
  paymentId: true,
  passId: true,
  offerId: true,
  moderation: true,
  refusalReason: true,
  moderatedAt: true,
  subscriberId: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true } },
  subscriber: {
    select: { id: true, name: true, email: true, avatarKey: true },
  },
  moderatedBy: { select: { id: true, name: true } },
  offer: {
    select: {
      id: true,
      kind: true,
      label: true,
      priceCents: true,
      currency: true,
      statusLifetimeHours: true,
    },
  },
  slides: { orderBy: SLIDE_ORDER, select: ADMIN_SLIDE_SELECT },
} satisfies Prisma.StatusSelect;

const PUBLIC_STATUS_SELECT = {
  id: true,
  source: true,
  title: true,
  publishedAt: true,
  expiresAt: true,
  subscriber: { select: { name: true, avatarKey: true } },
  slides: {
    orderBy: SLIDE_ORDER,
    select: {
      id: true,
      mediaType: true,
      mediaKey: true,
      posterKey: true,
      imageFit: true,
      caption: true,
      linkUrl: true,
      durationSec: true,
      article: {
        select: { ...PUBLIC_CARD_SELECT, isPublished: true },
      },
    },
  },
} satisfies Prisma.StatusSelect;

type AdminStatusRow = Prisma.StatusGetPayload<{
  select: typeof ADMIN_STATUS_SELECT;
}>;
type AdminSlideRow = Prisma.StatusSlideGetPayload<{
  select: typeof ADMIN_SLIDE_SELECT;
}>;

export type StatusState =
  'draft' | 'awaiting_payment' | 'pending' | 'rejected' | 'active' | 'expired';

const NO_CONTENT_MESSAGE =
  'Ajoutez au moins une diapo avec un média, un texte ou un article lié avant de publier';

const SUBSCRIBER_DRAFT: Prisma.StatusWhereInput = {
  source: StatusSource.SUBSCRIBER,
  billing: StatusBilling.NONE,
};

/** Statut abonné publiable : validé et payé (ou couvert par un forfait). */
const PAID_STATES: StatusPaymentState[] = [
  StatusPaymentState.FREE,
  StatusPaymentState.PAID,
];

@Injectable()
export class StatusesService {
  private readonly logger = new Logger(StatusesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
    private readonly articles: ArticlesService,
    private readonly payments: PaymentsService,
  ) {}

  // ---------------------------------------------------------------- public

  async listPublic() {
    const now = new Date();
    const rows = await this.prisma.status.findMany({
      where: {
        isPublished: true,
        moderation: StatusModeration.APPROVED,
        paymentState: { in: PAID_STATES },
        publishedAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: STATUS_DISPLAY_ORDER,
      take: 50,
      select: PUBLIC_STATUS_SELECT,
    });

    const items = rows
      .map((row) => {
        const slides = row.slides
          .map((slide) => {
            const article =
              slide.article && slide.article.isPublished
                ? this.articles.toPublicCard(slide.article)
                : null;
            const mediaUrl = this.resolveMediaUrl(slide.mediaKey);
            const caption = slide.caption?.trim() || null;
            if (!mediaUrl && !article && !caption) return null;
            return {
              id: slide.id,
              mediaType: mediaUrl ? slide.mediaType : null,
              mediaUrl,
              posterUrl: this.resolveMediaUrl(slide.posterKey),
              imageFit: slide.imageFit,
              caption,
              linkUrl: slide.linkUrl,
              durationSec: slide.durationSec,
              article,
            };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);
        const first = slides[0];
        if (!first) return null;
        const sponsored = row.source === StatusSource.SUBSCRIBER;
        return {
          // Compatibilité : les anciennes versions lisent la 1re diapo à plat
          ...first,
          id: row.id,
          title:
            row.title?.trim() ||
            (sponsored ? row.subscriber?.name?.trim() || null : null),
          source: row.source,
          sponsored,
          author:
            sponsored && row.subscriber
              ? {
                  name: row.subscriber.name,
                  avatarUrl: this.resolveMediaUrl(row.subscriber.avatarKey),
                }
              : null,
          publishedAt: (row.publishedAt ?? now).toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          slides,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return { items };
  }

  async registerView(id: string) {
    await this.prisma.status.updateMany({
      where: { id, isPublished: true },
      data: { viewCount: { increment: 1 } },
    });
    return { ok: true as const };
  }

  // ----------------------------------------------------------------- admin

  async list(
    filters: {
      state?: string;
      source?: string;
      take?: number;
      skip?: number;
    } = {},
  ) {
    const take = Math.min(Math.max(filters.take ?? 50, 1), 200);
    const skip = Math.max(filters.skip ?? 0, 0);
    const now = new Date();

    const and: Prisma.StatusWhereInput[] = [];
    switch (filters.state) {
      case 'draft':
        and.push({
          isPublished: false,
          OR: [
            { source: StatusSource.ADMIN },
            { moderation: StatusModeration.APPROVED },
          ],
        });
        break;
      case 'active':
        and.push({
          isPublished: true,
          moderation: StatusModeration.APPROVED,
          expiresAt: { gt: now },
        });
        break;
      case 'expired':
        and.push({
          isPublished: true,
          moderation: StatusModeration.APPROVED,
          expiresAt: { lte: now },
        });
        break;
      case 'pending':
        and.push(this.pendingWhere());
        break;
      case 'awaiting_payment':
        and.push({
          source: StatusSource.SUBSCRIBER,
          billing: StatusBilling.SINGLE,
          paymentState: StatusPaymentState.PENDING,
          moderation: StatusModeration.PENDING,
        });
        break;
      case 'rejected':
        and.push({ moderation: StatusModeration.REJECTED });
        break;
      default:
        // Les brouillons d’abonnés (non soumis) ne concernent pas l’équipe
        and.push({ NOT: SUBSCRIBER_DRAFT });
    }
    if (filters.source === 'ADMIN' || filters.source === 'SUBSCRIBER') {
      and.push({ source: filters.source });
    }
    const where: Prisma.StatusWhereInput = { AND: and };

    const [items, total, pendingCount] = await Promise.all([
      this.prisma.status.findMany({
        where,
        // « En ligne » : même ordre que l’app ; sinon les plus récents
        orderBy:
          filters.state === 'active'
            ? STATUS_DISPLAY_ORDER
            : { createdAt: 'desc' },
        take,
        skip,
        select: ADMIN_STATUS_SELECT,
      }),
      this.prisma.status.count({ where }),
      this.prisma.status.count({ where: this.pendingWhere() }),
    ]);

    return {
      items: items.map((row) => this.toAdmin(row)),
      total,
      take,
      skip,
      pendingCount,
    };
  }

  /**
   * Échange un statut en ligne avec son voisin, puis renumérote toute la
   * rangée (1…n). Les nouveaux statuts (0) arrivent en tête.
   */
  async move(id: string, direction: 'up' | 'down', actorId: string) {
    const now = new Date();
    const active = await this.prisma.status.findMany({
      where: {
        isPublished: true,
        moderation: StatusModeration.APPROVED,
        expiresAt: { gt: now },
      },
      orderBy: STATUS_DISPLAY_ORDER,
      select: { id: true },
    });
    const index = active.findIndex((row) => row.id === id);
    if (index < 0) {
      throw new BadRequestException(
        'Seuls les statuts en ligne peuvent être réordonnés',
      );
    }
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target >= 0 && target < active.length) {
      const ids = active.map((row) => row.id);
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await this.prisma.$transaction(
        ids.map((rowId, i) =>
          this.prisma.status.update({
            where: { id: rowId },
            data: { sortOrder: i + 1 },
          }),
        ),
      );
      this.log({ kind: 'admin', id: actorId }, 'status_reordered', id, {
        direction,
        position: target + 1,
      });
    }
    return { ok: true };
  }

  async getById(id: string) {
    return this.toAdmin(await this.findStatus(id));
  }

  /** Crée un statut équipe en brouillon : les diapos s’ajoutent ensuite. */
  async create(dto: CreateStatusDto, actorId: string) {
    if (dto.isPublished) throw new BadRequestException(NO_CONTENT_MESSAGE);
    const now = new Date();
    const ttl = dto.ttlHours ?? DEFAULT_TTL_HOURS;

    const created = await this.prisma.status.create({
      data: {
        source: StatusSource.ADMIN,
        title: dto.title ?? null,
        isPublished: false,
        expiresAt: new Date(now.getTime() + ttl * HOUR_MS),
        authorId: actorId,
      },
      select: ADMIN_STATUS_SELECT,
    });

    this.log({ kind: 'admin', id: actorId }, 'status_created', created.id);
    return this.toAdmin(created);
  }

  async update(id: string, dto: UpdateStatusDto, actorId: string) {
    const existing = await this.findStatus(id);
    const data: Prisma.StatusUpdateInput = {};
    const now = new Date();

    if (dto.title !== undefined) data.title = dto.title ?? null;
    if (dto.expiresAt !== undefined) data.expiresAt = new Date(dto.expiresAt);
    if (dto.ttlHours !== undefined) {
      data.expiresAt = new Date(now.getTime() + dto.ttlHours * HOUR_MS);
    }

    let publishedNow = false;
    if (dto.isPublished !== undefined) {
      if (
        dto.isPublished &&
        existing.source === StatusSource.SUBSCRIBER &&
        existing.moderation !== StatusModeration.APPROVED
      ) {
        throw new BadRequestException(
          'Validez d’abord ce statut abonné (onglet « À modérer »)',
        );
      }
      data.isPublished = dto.isPublished;
      if (dto.isPublished && !existing.isPublished) {
        publishedNow = true;
        data.publishedAt = now;
        // La durée de vie démarre à la publication (pas à la création)
        if (dto.ttlHours === undefined && dto.expiresAt === undefined) {
          const ttlMs =
            existing.expiresAt.getTime() - existing.createdAt.getTime();
          data.expiresAt = new Date(now.getTime() + Math.max(ttlMs, HOUR_MS));
        }
      }
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const willBePublished = dto.isPublished ?? existing.isPublished;
    if (willBePublished && !existing.slides.some((s) => this.hasContent(s))) {
      throw new BadRequestException(NO_CONTENT_MESSAGE);
    }

    const updated = await this.prisma.status.update({
      where: { id },
      data,
      select: ADMIN_STATUS_SELECT,
    });

    this.log(
      { kind: 'admin', id: actorId },
      publishedNow ? 'status_published' : 'status_updated',
      id,
      { fields: Object.keys(dto) },
    );
    return this.toAdmin(updated);
  }

  async remove(id: string, actor: StatusActor) {
    const existing = await this.findStatus(id);
    if (actor.kind === 'subscriber' && existing.subscriberId !== actor.id) {
      throw new NotFoundException('Statut introuvable');
    }
    await this.prisma.status.delete({ where: { id } });
    // Statut en attente sur un forfait : la publication est rendue
    if (existing.moderation === StatusModeration.PENDING) {
      await this.refundPassQuota(existing);
    }
    void this.deleteKeys(existing.slides.flatMap((s) => this.slideKeys(s)));
    this.log(actor, 'status_deleted', id);
    return { ok: true as const };
  }

  /**
   * Regroupe `id` dans `targetId` (statuts équipe uniquement) : ses diapos
   * passent à la suite de celles de la cible, puis la source est supprimée.
   */
  async merge(id: string, targetId: string, actorId: string) {
    if (id === targetId) {
      throw new BadRequestException('Choisissez un autre statut');
    }
    const [source, target] = await Promise.all([
      this.findStatus(id),
      this.findStatus(targetId),
    ]);
    if (
      source.source !== StatusSource.ADMIN ||
      target.source !== StatusSource.ADMIN
    ) {
      throw new BadRequestException(
        'Seuls les statuts de l’équipe peuvent être regroupés',
      );
    }
    if (source.slides.length + target.slides.length > STATUS_MAX_SLIDES) {
      throw new BadRequestException(
        `Un statut contient au maximum ${STATUS_MAX_SLIDES} diapos`,
      );
    }
    const start = target.slides.length;
    await this.prisma.$transaction([
      ...source.slides.map((slide, i) =>
        this.prisma.statusSlide.update({
          where: { id: slide.id },
          data: { statusId: targetId, position: start + i },
        }),
      ),
      ...target.slides.map((slide, i) =>
        this.prisma.statusSlide.update({
          where: { id: slide.id },
          data: { position: i },
        }),
      ),
      // Les vues restent comptées sur la bulle conservée
      this.prisma.status.update({
        where: { id: targetId },
        data: { viewCount: { increment: source.viewCount } },
      }),
      this.prisma.status.delete({ where: { id } }),
    ]);

    this.log({ kind: 'admin', id: actorId }, 'status_merged', targetId, {
      from: id,
      slides: source.slides.length,
    });
    return this.getById(targetId);
  }

  // ------------------------------------------------------------ modération

  /** Valide un statut abonné soumis et payé : il passe en ligne. */
  async approve(id: string, dto: ApproveStatusDto, actorId: string) {
    const existing = await this.findStatus(id);
    if (existing.source !== StatusSource.SUBSCRIBER) {
      throw new BadRequestException('Ce statut ne nécessite pas de validation');
    }
    if (
      existing.billing === StatusBilling.NONE ||
      existing.moderation !== StatusModeration.PENDING
    ) {
      throw new BadRequestException(
        'Ce statut n’est pas en attente de validation',
      );
    }
    if (!PAID_STATES.includes(existing.paymentState)) {
      throw new BadRequestException('Paiement du statut non encore confirmé');
    }
    if (!existing.slides.some((s) => !!s.mediaKey)) {
      throw new BadRequestException('Le statut ne contient aucun média');
    }

    const now = new Date();
    const ttl =
      dto.ttlHours ?? existing.offer?.statusLifetimeHours ?? DEFAULT_TTL_HOURS;
    const updated = await this.prisma.status.update({
      where: { id },
      data: {
        moderation: StatusModeration.APPROVED,
        refusalReason: null,
        moderatedBy: { connect: { id: actorId } },
        moderatedAt: now,
        isPublished: true,
        publishedAt: now,
        expiresAt: new Date(now.getTime() + ttl * HOUR_MS),
        sortOrder: 0,
      },
      select: ADMIN_STATUS_SELECT,
    });
    this.log({ kind: 'admin', id: actorId }, 'status_approved', id, {
      ttlHours: ttl,
    });
    return this.toAdmin(updated);
  }

  /**
   * Refuse (ou retire) un statut abonné. Forfait : la publication est rendue.
   * Paiement unique déjà réglé : l’abonné peut corriger et resoumettre sans
   * repayer (sinon remboursement depuis « Paiements »).
   */
  async reject(id: string, reason: string, actorId: string) {
    const existing = await this.findStatus(id);
    if (existing.source !== StatusSource.SUBSCRIBER) {
      throw new BadRequestException('Masquez ou supprimez les statuts équipe');
    }
    if (
      existing.billing === StatusBilling.NONE ||
      existing.moderation === StatusModeration.REJECTED
    ) {
      throw new BadRequestException('Ce statut ne peut pas être refusé');
    }
    const updated = await this.prisma.status.update({
      where: { id },
      data: {
        moderation: StatusModeration.REJECTED,
        refusalReason: reason.trim(),
        moderatedBy: { connect: { id: actorId } },
        moderatedAt: new Date(),
        isPublished: false,
      },
      select: ADMIN_STATUS_SELECT,
    });
    await this.refundPassQuota(existing);
    this.log({ kind: 'admin', id: actorId }, 'status_rejected', id, {
      reason: reason.trim(),
    });
    return this.toAdmin(updated);
  }

  // -------------------------------------------------------------- abonnés

  async listMine(subscriberId: string) {
    const rows = await this.prisma.status.findMany({
      where: { subscriberId, source: StatusSource.SUBSCRIBER },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: ADMIN_STATUS_SELECT,
    });
    return { items: rows.map((row) => this.toMine(row)) };
  }

  async getMine(id: string, subscriberId: string) {
    return this.toMine(await this.findOwned(id, subscriberId));
  }

  async createMine(dto: CreateMyStatusDto, subscriberId: string) {
    const drafts = await this.prisma.status.count({
      where: { subscriberId, ...SUBSCRIBER_DRAFT },
    });
    if (drafts >= 10) {
      throw new BadRequestException(
        'Vous avez déjà 10 brouillons : publiez-en ou supprimez-en avant d’en créer un autre',
      );
    }
    const created = await this.prisma.status.create({
      data: {
        source: StatusSource.SUBSCRIBER,
        title: dto.title ?? null,
        isPublished: false,
        // Recalculée à la validation (durée de vie de l’offre)
        expiresAt: new Date(Date.now() + DEFAULT_TTL_HOURS * HOUR_MS),
        subscriberId,
        billing: StatusBilling.NONE,
        paymentState: StatusPaymentState.PENDING,
        moderation: StatusModeration.PENDING,
      },
      select: ADMIN_STATUS_SELECT,
    });
    this.log(
      { kind: 'subscriber', id: subscriberId },
      'status_created',
      created.id,
    );
    return this.toMine(created);
  }

  /**
   * Soumet un brouillon (ou un statut refusé corrigé) à la rédaction.
   * - PASS : décompte une publication sur le forfait actif le plus proche
   *   de son expiration ;
   * - SINGLE : paiement Mobile Money de l’offre « publication unique ».
   */
  async submitMine(id: string, dto: SubmitMyStatusDto, subscriberId: string) {
    const existing = await this.findOwned(id, subscriberId);
    this.assertEditable(existing);
    if (existing.slides.length === 0) {
      throw new BadRequestException('Ajoutez une image ou une vidéo');
    }
    if (existing.slides.some((s) => !s.mediaKey)) {
      throw new BadRequestException(
        'Chaque diapo doit contenir une image ou une vidéo',
      );
    }
    const actor: StatusActor = { kind: 'subscriber', id: subscriberId };

    // Paiement unique déjà réglé puis refusé : resoumission sans repayer
    if (
      existing.moderation === StatusModeration.REJECTED &&
      existing.billing === StatusBilling.SINGLE &&
      existing.paymentState === StatusPaymentState.PAID
    ) {
      const updated = await this.prisma.status.update({
        where: { id },
        data: { moderation: StatusModeration.PENDING, refusalReason: null },
        select: ADMIN_STATUS_SELECT,
      });
      this.log(actor, 'status_submitted', id, {
        billing: 'SINGLE',
        resubmit: true,
      });
      return { status: this.toMine(updated), payment: null };
    }

    if (dto.billing === 'PASS') {
      const pass = await this.consumePass(subscriberId);
      if (!pass) {
        throw new BadRequestException(
          'Aucun forfait Statuts actif avec des publications restantes',
        );
      }
      const updated = await this.prisma.status.update({
        where: { id },
        data: {
          billing: StatusBilling.PASS,
          pass: { connect: { id: pass.id } },
          offer: pass.offerId
            ? { connect: { id: pass.offerId } }
            : { disconnect: true },
          paymentState: StatusPaymentState.FREE,
          moderation: StatusModeration.PENDING,
          refusalReason: null,
        },
        select: ADMIN_STATUS_SELECT,
      });
      this.log(actor, 'status_submitted', id, {
        billing: 'PASS',
        passId: pass.id,
      });
      return { status: this.toMine(updated), payment: null };
    }

    if (!dto.phone) {
      throw new BadRequestException('Numéro Mobile Money requis');
    }
    const offer = await this.prisma.statusOffer.findFirst({
      where: {
        kind: StatusOfferKind.SINGLE,
        isActive: true,
        ...(dto.offerId ? { id: dto.offerId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
    });
    if (!offer) {
      throw new BadRequestException('Offre de publication indisponible');
    }
    const updated = await this.prisma.status.update({
      where: { id },
      data: {
        billing: StatusBilling.SINGLE,
        offer: { connect: { id: offer.id } },
        pass: { disconnect: true },
        paymentState: StatusPaymentState.PENDING,
        moderation: StatusModeration.PENDING,
        refusalReason: null,
      },
      select: ADMIN_STATUS_SELECT,
    });
    this.log(actor, 'status_submitted', id, {
      billing: 'SINGLE',
      offerId: offer.id,
    });
    const payment = await this.payments.startFlexpaieCharge({
      subscriberId,
      amountCents: offer.priceCents,
      currency: offer.currency,
      purpose: PaymentPurpose.STATUS,
      phone: dto.phone,
      referencePrefix: 'STA',
      metadata: { statusId: id, offerId: offer.id },
    });
    return { status: this.toMine(updated), payment };
  }

  /** Relance le paiement d’un statut « publication unique » non réglé. */
  async retryPayment(id: string, phone: string, subscriberId: string) {
    const existing = await this.findOwned(id, subscriberId);
    if (
      existing.billing !== StatusBilling.SINGLE ||
      existing.paymentState !== StatusPaymentState.PENDING ||
      existing.moderation !== StatusModeration.PENDING ||
      !existing.offer
    ) {
      throw new BadRequestException('Aucun paiement en attente pour ce statut');
    }
    return this.payments.startFlexpaieCharge({
      subscriberId,
      amountCents: existing.offer.priceCents,
      currency: existing.offer.currency,
      purpose: PaymentPurpose.STATUS,
      phone,
      referencePrefix: 'STA',
      metadata: { statusId: id, offerId: existing.offer.id },
    });
  }

  // ---------------------------------------------------------------- diapos

  async createSlide(
    statusId: string,
    dto: CreateStatusSlideDto,
    actor: StatusActor,
  ) {
    const status = await this.findForActor(statusId, actor);
    const max =
      status.source === StatusSource.SUBSCRIBER
        ? SUBSCRIBER_MAX_SLIDES
        : STATUS_MAX_SLIDES;
    if (status.slides.length >= max) {
      throw new BadRequestException(
        `Un statut contient au maximum ${max} diapos`,
      );
    }
    const articleId =
      actor.kind === 'admin'
        ? await this.resolveArticleId(dto.articleId)
        : null;
    const last = status.slides[status.slides.length - 1];
    const slide = await this.prisma.statusSlide.create({
      data: {
        statusId,
        position: last ? last.position + 1 : 0,
        caption: this.normalizeCaption(dto.caption),
        linkUrl: dto.linkUrl ?? null,
        articleId,
        durationSec: dto.durationSec ?? 6,
        ...(dto.imageFit ? { imageFit: dto.imageFit } : {}),
      },
      select: ADMIN_SLIDE_SELECT,
    });
    this.log(actor, 'status_slide_created', statusId, { slideId: slide.id });
    return this.toAdminSlide(slide);
  }

  async updateSlide(
    slideId: string,
    dto: UpdateStatusSlideDto,
    actor: StatusActor,
  ) {
    const existing = await this.findSlide(slideId);
    const status = await this.findForActor(existing.statusId, actor);
    const data: Prisma.StatusSlideUpdateInput = {};

    if (dto.caption !== undefined) {
      data.caption = this.normalizeCaption(dto.caption);
    }
    if (dto.linkUrl !== undefined) data.linkUrl = dto.linkUrl ?? null;
    if (dto.articleId !== undefined && actor.kind === 'admin') {
      const articleId = await this.resolveArticleId(dto.articleId);
      data.article = articleId
        ? { connect: { id: articleId } }
        : { disconnect: true };
    }
    if (dto.durationSec !== undefined) data.durationSec = dto.durationSec;
    if (dto.imageFit !== undefined) data.imageFit = dto.imageFit;
    const oldKeys: string[] = [];
    if (dto.clearMedia) {
      oldKeys.push(...this.slideKeys(existing));
      data.mediaKey = null;
      data.mediaType = null;
      data.posterKey = null;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    if (status.isPublished) {
      const next = {
        mediaKey: dto.clearMedia ? null : existing.mediaKey,
        caption:
          dto.caption !== undefined
            ? this.normalizeCaption(dto.caption)
            : existing.caption,
        articleId:
          dto.articleId !== undefined && actor.kind === 'admin'
            ? dto.articleId?.trim() || null
            : existing.articleId,
      };
      const others = status.slides.filter((s) => s.id !== slideId);
      if (!this.hasContent(next) && !others.some((s) => this.hasContent(s))) {
        throw new BadRequestException(NO_CONTENT_MESSAGE);
      }
    }

    const updated = await this.prisma.statusSlide.update({
      where: { id: slideId },
      data,
      select: ADMIN_SLIDE_SELECT,
    });
    if (oldKeys.length) void this.deleteKeys(oldKeys);
    this.log(actor, 'status_slide_updated', existing.statusId, { slideId });
    return this.toAdminSlide(updated);
  }

  async removeSlide(slideId: string, actor: StatusActor) {
    const existing = await this.findSlide(slideId);
    const status = await this.findForActor(existing.statusId, actor);
    if (
      status.isPublished &&
      !status.slides.some((s) => s.id !== slideId && this.hasContent(s))
    ) {
      throw new BadRequestException(
        'Un statut publié doit garder au moins une diapo : masquez-le ou supprimez le statut',
      );
    }
    await this.prisma.statusSlide.delete({ where: { id: slideId } });
    void this.deleteKeys(this.slideKeys(existing));
    this.log(actor, 'status_slide_deleted', existing.statusId, { slideId });
    return { ok: true as const };
  }

  /** Réordonne les diapos d’un statut (liste complète des ids, dans l’ordre). */
  async reorderSlides(statusId: string, ids: string[], actor: StatusActor) {
    const status = await this.findForActor(statusId, actor);
    const current = new Set(status.slides.map((s) => s.id));
    if (
      ids.length !== current.size ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !current.has(id))
    ) {
      throw new BadRequestException('Liste des diapos invalide');
    }
    await this.prisma.$transaction(
      ids.map((id, position) =>
        this.prisma.statusSlide.update({ where: { id }, data: { position } }),
      ),
    );
    this.log(actor, 'status_slides_reordered', statusId);
    const fresh = await this.findStatus(statusId);
    return actor.kind === 'admin' ? this.toAdmin(fresh) : this.toMine(fresh);
  }

  async uploadImage(slideId: string, file: UploadFile, actor: StatusActor) {
    const existing = await this.findSlide(slideId);
    await this.findForActor(existing.statusId, actor);
    this.assertImageFile(file);
    const ext = this.imageExt(file.originalname, file.mimetype);
    const key = this.newKey(slideId, 'image', ext);
    await this.putToR2(key, file, contentTypeForExt(ext));

    const updated = await this.prisma.statusSlide.update({
      where: { id: slideId },
      data: {
        mediaType: StatusMediaType.IMAGE,
        mediaKey: key,
        posterKey: null,
      },
      select: ADMIN_SLIDE_SELECT,
    });

    void this.deleteKeys(this.slideKeys(existing));
    this.log(actor, 'status_media_uploaded', existing.statusId, {
      key,
      size: file.size,
    });
    return this.toAdminSlide(updated);
  }

  async uploadPoster(slideId: string, file: UploadFile, actor: StatusActor) {
    const existing = await this.findSlide(slideId);
    await this.findForActor(existing.statusId, actor);
    if (existing.mediaType !== StatusMediaType.VIDEO) {
      throw new BadRequestException('La miniature est réservée aux vidéos');
    }
    this.assertImageFile(file);
    const ext = this.imageExt(file.originalname, file.mimetype);
    const key = this.newKey(slideId, 'poster', ext);
    await this.putToR2(key, file, contentTypeForExt(ext));

    const updated = await this.prisma.statusSlide.update({
      where: { id: slideId },
      data: { posterKey: key },
      select: ADMIN_SLIDE_SELECT,
    });
    if (existing.posterKey) void this.deleteKeys([existing.posterKey]);
    this.log(actor, 'status_media_uploaded', existing.statusId, {
      key,
      size: file.size,
    });
    return this.toAdminSlide(updated);
  }

  async presignVideo(
    slideId: string,
    dto: PresignStatusVideoDto,
    actor: StatusActor,
  ) {
    const existing = await this.findSlide(slideId);
    await this.findForActor(existing.statusId, actor);
    if (dto.size > STATUS_VIDEO_MAX_BYTES) {
      throw new BadRequestException('La vidéo dépasse 100 Mo');
    }
    const r2 = this.requireR2();
    const ext = this.videoExt(dto.filename, dto.contentType);
    const expiresIn = 1800;
    const signed = presignR2PutObject(r2, {
      key: this.newKey(slideId, 'video', ext),
      contentType: contentTypeForExt(ext),
      expiresInSeconds: expiresIn,
    });
    return {
      key: signed.key,
      uploadUrl: signed.uploadUrl,
      headers: signed.headers,
      expiresIn,
      maxSize: STATUS_VIDEO_MAX_BYTES,
    };
  }

  async completeVideo(
    slideId: string,
    dto: CompleteStatusVideoDto,
    actor: StatusActor,
  ) {
    const existing = await this.findSlide(slideId);
    await this.findForActor(existing.statusId, actor);
    const key = dto.key.replace(/^\//, '');
    if (!key.startsWith(`${this.slidePrefix(slideId)}video_`)) {
      throw new BadRequestException('Clé vidéo invalide');
    }
    const r2 = this.requireR2();
    const head = await headR2Object(r2, key);
    if (!head) {
      throw new BadRequestException('Vidéo introuvable sur le stockage');
    }
    if ((head.contentLength ?? 0) > STATUS_VIDEO_MAX_BYTES) {
      void this.deleteKeys([key]);
      throw new BadRequestException('La vidéo dépasse 100 Mo');
    }

    const updated = await this.prisma.statusSlide.update({
      where: { id: slideId },
      data: {
        mediaType: StatusMediaType.VIDEO,
        mediaKey: key,
        posterKey: null,
      },
      select: ADMIN_SLIDE_SELECT,
    });

    void this.deleteKeys(this.slideKeys(existing).filter((k) => k !== key));
    this.log(actor, 'status_media_uploaded', existing.statusId, {
      key,
      size: head.contentLength ?? 0,
    });
    return this.toAdminSlide(updated);
  }

  // --------------------------------------------------------------- helpers

  private pendingWhere(): Prisma.StatusWhereInput {
    return {
      source: StatusSource.SUBSCRIBER,
      billing: { not: StatusBilling.NONE },
      moderation: StatusModeration.PENDING,
      paymentState: { in: PAID_STATES },
    };
  }

  /**
   * Décompte une publication sur le forfait actif qui expire le plus tôt.
   * Incrément conditionnel (sur la valeur lue) : en cas de course,
   * on retente sur l’état relu.
   */
  private async consumePass(subscriberId: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const passes = await this.prisma.statusPass.findMany({
        where: {
          subscriberId,
          paymentState: StatusPaymentState.PAID,
          expiresAt: { gt: new Date() },
        },
        orderBy: { expiresAt: 'asc' },
        select: { id: true, offerId: true, quota: true, usedCount: true },
      });
      const pass = passes.find(
        (p) => p.quota === null || p.usedCount < p.quota,
      );
      if (!pass) return null;
      const res = await this.prisma.statusPass.updateMany({
        where: { id: pass.id, usedCount: pass.usedCount },
        data: { usedCount: { increment: 1 } },
      });
      if (res.count === 1) return pass;
    }
    throw new BadRequestException('Forfait occupé, réessayez');
  }

  private async refundPassQuota(row: {
    billing: StatusBilling;
    passId: string | null;
  }) {
    if (row.billing !== StatusBilling.PASS || !row.passId) return;
    await this.prisma.statusPass.updateMany({
      where: { id: row.passId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }

  private async findStatus(id: string) {
    const row = await this.prisma.status.findUnique({
      where: { id },
      select: ADMIN_STATUS_SELECT,
    });
    if (!row) throw new NotFoundException('Statut introuvable');
    return row;
  }

  private async findOwned(id: string, subscriberId: string) {
    const row = await this.findStatus(id);
    if (
      row.source !== StatusSource.SUBSCRIBER ||
      row.subscriberId !== subscriberId
    ) {
      throw new NotFoundException('Statut introuvable');
    }
    return row;
  }

  /** Admin : tout statut. Abonné : ses brouillons ou statuts refusés. */
  private async findForActor(statusId: string, actor: StatusActor) {
    if (actor.kind === 'admin') return this.findStatus(statusId);
    const row = await this.findOwned(statusId, actor.id);
    this.assertEditable(row);
    return row;
  }

  private assertEditable(row: AdminStatusRow) {
    const editable =
      row.billing === StatusBilling.NONE ||
      row.moderation === StatusModeration.REJECTED;
    if (!editable) {
      throw new ForbiddenException(
        'Ce statut est déjà soumis : il ne peut plus être modifié',
      );
    }
  }

  private async findSlide(id: string) {
    const row = await this.prisma.statusSlide.findUnique({
      where: { id },
      select: ADMIN_SLIDE_SELECT,
    });
    if (!row) throw new NotFoundException('Diapo introuvable');
    return row;
  }

  private hasContent(row: {
    mediaKey: string | null;
    caption: string | null;
    articleId: string | null;
  }) {
    return !!row.mediaKey || !!row.caption?.trim() || !!row.articleId;
  }

  private slideKeys(slide: {
    mediaKey: string | null;
    posterKey: string | null;
  }) {
    return [slide.mediaKey, slide.posterKey].filter((k): k is string => !!k);
  }

  private stateOf(row: AdminStatusRow): StatusState {
    if (row.source === StatusSource.SUBSCRIBER) {
      if (row.billing === StatusBilling.NONE) return 'draft';
      if (row.moderation === StatusModeration.REJECTED) return 'rejected';
      if (row.moderation === StatusModeration.PENDING) {
        return row.paymentState === StatusPaymentState.PENDING
          ? 'awaiting_payment'
          : 'pending';
      }
    }
    if (!row.isPublished) return 'draft';
    return row.expiresAt.getTime() > Date.now() ? 'active' : 'expired';
  }

  private async resolveArticleId(raw: string | null | undefined) {
    const id = raw?.trim();
    if (!id) return null;
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!article) throw new BadRequestException('Article introuvable');
    return article.id;
  }

  private normalizeCaption(raw: string | null | undefined) {
    const trimmed = raw?.trim();
    return trimmed ? trimmed : null;
  }

  /** Médias rangés par diapo : ils la suivent si elle change de statut. */
  private slidePrefix(slideId: string) {
    return `statuses/slides/${slideId}/`;
  }

  private newKey(slideId: string, kind: string, ext: string) {
    return `${this.slidePrefix(slideId)}${kind}_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
  }

  private log(
    actor: StatusActor,
    action: string,
    statusId: string,
    meta?: Record<string, unknown>,
  ) {
    void this.activity.log({
      actorType:
        actor.kind === 'admin'
          ? ActivityActorType.ADMIN
          : ActivityActorType.SUBSCRIBER,
      ...(actor.kind === 'admin'
        ? { adminId: actor.id }
        : { subscriberId: actor.id }),
      action,
      entity: 'status',
      entityId: statusId,
      meta: meta as Prisma.InputJsonValue | undefined,
    });
  }

  private requireR2() {
    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException(
        'Stockage R2 non configuré (R2_ACCESS_KEY_ID / R2_BUCKET)',
      );
    }
    return r2;
  }

  private async putToR2(key: string, file: UploadFile, contentType: string) {
    await putR2Object(this.requireR2(), {
      key,
      body: file.buffer,
      contentType,
    });
  }

  private async deleteKeys(keys: string[]) {
    const r2 = createR2ClientFromEnv();
    const own = keys.filter((k) => k.startsWith('statuses/'));
    if (!r2 || own.length === 0) return;
    try {
      await deleteR2Keys(r2, own);
    } catch (err) {
      this.logger.warn(`R2 delete statut: ${String(err)}`);
    }
  }

  private assertImageFile(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    if (file.size > IMAGE_MAX_BYTES) {
      throw new BadRequestException("L'image dépasse 10 Mo");
    }
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(
      file.mimetype,
    );
    if (!ok) {
      throw new BadRequestException('Formats image : JPG, PNG, WEBP');
    }
  }

  private imageExt(originalname: string, mimetype: string): string {
    let ext = extname(originalname).toLowerCase().replace('.', '');
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      if (mimetype.includes('png')) ext = 'png';
      else if (mimetype.includes('webp')) ext = 'webp';
      else ext = 'jpg';
    }
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  private videoExt(filename: string, contentType: string | undefined) {
    const name = filename.toLowerCase();
    const mime = (contentType ?? '').toLowerCase();
    if (name.endsWith('.mov') || mime.includes('quicktime')) return 'mov';
    if (
      name.endsWith('.mp4') ||
      name.endsWith('.m4v') ||
      mime.includes('mp4')
    ) {
      return 'mp4';
    }
    throw new BadRequestException('Formats vidéo : MP4 ou MOV (max 100 Mo)');
  }

  private toAdminSlide(row: AdminSlideRow) {
    return {
      id: row.id,
      position: row.position,
      mediaType: row.mediaType,
      mediaUrl: this.resolveMediaUrl(row.mediaKey),
      posterUrl: this.resolveMediaUrl(row.posterKey),
      imageFit: row.imageFit,
      caption: row.caption,
      linkUrl: row.linkUrl,
      articleId: row.articleId,
      article: row.article
        ? {
            id: row.article.id,
            title: row.article.title,
            slug: row.article.slug,
            isPublished: row.article.isPublished,
            coverUrl: this.resolveMediaUrl(row.article.coverKey),
          }
        : null,
      durationSec: row.durationSec,
    };
  }

  private toAdmin(row: AdminStatusRow) {
    return {
      id: row.id,
      source: row.source,
      title: row.title,
      state: this.stateOf(row),
      slides: row.slides.map((slide) => this.toAdminSlide(slide)),
      sortOrder: row.sortOrder,
      isPublished: row.isPublished,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt.toISOString(),
      viewCount: row.viewCount,
      author: row.author,
      subscriber: row.subscriber
        ? {
            id: row.subscriber.id,
            name: row.subscriber.name,
            email: row.subscriber.email,
            avatarUrl: this.resolveMediaUrl(row.subscriber.avatarKey),
          }
        : null,
      billing: row.billing,
      paymentState: row.paymentState,
      paymentId: row.paymentId,
      passId: row.passId,
      offer: row.offer,
      moderation: row.moderation,
      refusalReason: row.refusalReason,
      moderatedAt: row.moderatedAt?.toISOString() ?? null,
      moderatedBy: row.moderatedBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Vue abonné : sans données internes (email, modérateur, ordre). */
  private toMine(row: AdminStatusRow) {
    const state = this.stateOf(row);
    return {
      id: row.id,
      title: row.title,
      state,
      editable:
        row.billing === StatusBilling.NONE ||
        row.moderation === StatusModeration.REJECTED,
      slides: row.slides.map((slide) => {
        const s = this.toAdminSlide(slide);
        return {
          id: s.id,
          position: s.position,
          mediaType: s.mediaType,
          mediaUrl: s.mediaUrl,
          posterUrl: s.posterUrl,
          imageFit: s.imageFit,
          caption: s.caption,
          linkUrl: s.linkUrl,
          durationSec: s.durationSec,
        };
      }),
      billing: row.billing,
      paymentState: row.paymentState,
      offer: row.offer
        ? {
            id: row.offer.id,
            label: row.offer.label,
            priceCents: row.offer.priceCents,
            currency: row.offer.currency,
          }
        : null,
      refusalReason: row.refusalReason,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      expiresAt:
        state === 'active' || state === 'expired'
          ? row.expiresAt.toISOString()
          : null,
      viewCount: row.viewCount,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private resolveMediaUrl(key: string | null): string | null {
    if (!key) return null;
    const trimmed = key.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const r2 = this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '');
    if (!r2) return null;
    return `${r2}/${trimmed.replace(/^\//, '')}`;
  }
}
