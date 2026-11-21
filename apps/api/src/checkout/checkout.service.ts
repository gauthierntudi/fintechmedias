import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessType,
  CheckoutKind,
  CheckoutSession,
  CheckoutState,
  PaymentPurpose,
  PaymentStatus,
  StatusBilling,
  StatusModeration,
  StatusPaymentState,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCheckoutDto } from './checkout.dto';

/** Durée de validité d’un lien de paiement. */
const SESSION_TTL_MS = 60 * 60 * 1000;

/** Préfixe de lien de retour vers l’app mobile. */
const APP_SCHEME = 'fintechmedias://';

type Draft = {
  label: string;
  detail: string | null;
  amountCents: number;
  currency: string;
  planId?: string;
  magazineId?: string;
  articleId?: string;
  statusId?: string;
  offerId?: string;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  // ------------------------------------------------------------ création

  async create(subscriberId: string, dto: CreateCheckoutDto) {
    const subscriber = await this.prisma.subscriber.findFirst({
      where: { id: subscriberId, isActive: true },
      select: { id: true },
    });
    if (!subscriber) throw new NotFoundException('Compte introuvable');

    const kind: CheckoutKind = dto.kind;
    let draft: Draft;
    switch (kind) {
      case CheckoutKind.SUBSCRIPTION:
        draft = await this.draftSubscription(dto.planId);
        break;
      case CheckoutKind.MAGAZINE:
        draft = await this.draftMagazine(subscriberId, dto.magazineId);
        break;
      case CheckoutKind.ARTICLE:
        draft = await this.draftArticle(subscriberId, dto.articleId);
        break;
      case CheckoutKind.STATUS:
        draft = await this.draftStatus(subscriberId, dto.statusId);
        break;
      default:
        throw new BadRequestException('Type de paiement inconnu');
    }

    const session = await this.prisma.checkoutSession.create({
      data: {
        id: randomBytes(24).toString('base64url'),
        subscriberId,
        kind,
        ...draft,
        returnUrl: this.safeReturnUrl(dto.returnUrl),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });

    return {
      id: session.id,
      url: `${this.siteUrl()}/paiement/${session.id}`,
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private async draftSubscription(planId?: string): Promise<Draft> {
    if (!planId) throw new BadRequestException('Formule manquante');
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Formule indisponible');
    return {
      label: `Abonnement ${plan.name}`,
      detail: `Accès à toute la plateforme pendant ${plan.durationDays} jours`,
      amountCents: plan.priceCents,
      currency: plan.currency,
      planId: plan.id,
    };
  }

  private async draftMagazine(
    subscriberId: string,
    magazineId?: string,
  ): Promise<Draft> {
    if (!magazineId) throw new BadRequestException('Magazine manquant');
    const [magazine, owned] = await Promise.all([
      this.prisma.magazine.findFirst({
        where: { id: magazineId, isPublished: true, isActive: true },
        select: {
          id: true,
          title: true,
          issueNumber: true,
          accessType: true,
          priceCents: true,
          currency: true,
        },
      }),
      this.prisma.purchase.findFirst({
        where: {
          subscriberId,
          magazineId,
          paymentStatus: PaymentStatus.SUCCESS,
        },
        select: { id: true },
      }),
    ]);
    if (!magazine) throw new NotFoundException('Magazine introuvable');
    if (magazine.accessType !== AccessType.PAID) {
      throw new BadRequestException('Ce numéro n’est pas en vente unitaire');
    }
    if (!magazine.priceCents || magazine.priceCents <= 0) {
      throw new BadRequestException('Prix du magazine non configuré');
    }
    if (owned) throw new ConflictException('Vous avez déjà acheté ce numéro');
    return {
      label: magazine.title,
      detail: magazine.issueNumber
        ? `Magazine · numéro ${magazine.issueNumber}`
        : 'Magazine',
      amountCents: magazine.priceCents,
      currency: magazine.currency,
      magazineId: magazine.id,
    };
  }

  private async draftArticle(
    subscriberId: string,
    articleId?: string,
  ): Promise<Draft> {
    if (!articleId) throw new BadRequestException('Article manquant');
    const [article, owned] = await Promise.all([
      this.prisma.article.findFirst({
        where: { id: articleId, isPublished: true },
        select: { id: true, title: true, isPaid: true, priceCents: true },
      }),
      this.prisma.articlePurchase.findFirst({
        where: {
          subscriberId,
          articleId,
          paymentStatus: PaymentStatus.SUCCESS,
        },
        select: { id: true },
      }),
    ]);
    if (!article) throw new NotFoundException('Article introuvable');
    if (!article.isPaid || !article.priceCents || article.priceCents <= 0) {
      throw new BadRequestException('Cet article n’est pas en vente');
    }
    if (owned) throw new ConflictException('Vous avez déjà acheté cet article');
    return {
      label: article.title,
      detail: 'Article · lecture illimitée',
      amountCents: article.priceCents,
      currency: 'USD',
      articleId: article.id,
    };
  }

  /**
   * Le statut a déjà été soumis avec une offre « publication unique » :
   * son prix et sa durée de vie viennent de cette offre.
   */
  private async draftStatus(
    subscriberId: string,
    statusId?: string,
  ): Promise<Draft> {
    if (!statusId) throw new BadRequestException('Statut manquant');
    const status = await this.prisma.status.findFirst({
      where: { id: statusId, subscriberId },
      select: {
        id: true,
        billing: true,
        paymentState: true,
        moderation: true,
        offer: true,
      },
    });
    if (!status) throw new NotFoundException('Statut introuvable');
    if (
      status.billing !== StatusBilling.SINGLE ||
      status.paymentState !== StatusPaymentState.PENDING ||
      status.moderation !== StatusModeration.PENDING ||
      !status.offer
    ) {
      throw new BadRequestException('Aucun paiement en attente pour ce statut');
    }
    const offer = status.offer;
    return {
      label: offer.label,
      detail: `Visible ${this.lifetimeLabel(offer.statusLifetimeHours)} en tête de l’accueil`,
      amountCents: offer.priceCents,
      currency: offer.currency,
      statusId: status.id,
      offerId: offer.id,
    };
  }

  // ------------------------------------------------------------ page web

  async view(id: string) {
    const session = await this.load(id);
    return this.toView(session);
  }

  async pay(id: string, phone: string) {
    let session = await this.load(id);
    if (session.state === CheckoutState.PAID) return this.toView(session);
    this.assertPayable(session);

    const cleanPhone = phone.replace(/\s+/g, '');
    let started: { paymentId: string; message?: string };
    switch (session.kind) {
      case CheckoutKind.SUBSCRIPTION:
        started = await this.payments.createFlexpaiePayment(
          session.subscriberId,
          session.planId ?? '',
          cleanPhone,
        );
        break;
      case CheckoutKind.MAGAZINE:
        started = await this.payments.createFlexpaiePurchase(
          session.subscriberId,
          session.magazineId ?? '',
          cleanPhone,
        );
        break;
      case CheckoutKind.ARTICLE:
        started = await this.payments.startFlexpaieCharge({
          subscriberId: session.subscriberId,
          amountCents: session.amountCents,
          currency: session.currency,
          purpose: PaymentPurpose.ARTICLE,
          phone: cleanPhone,
          referencePrefix: 'ART',
          metadata: { articleId: session.articleId, checkoutId: session.id },
        });
        break;
      case CheckoutKind.STATUS:
        // L’offre a pu être désactivée ou le statut annulé entre-temps
        await this.draftStatus(session.subscriberId, session.statusId ?? '');
        started = await this.payments.startFlexpaieCharge({
          subscriberId: session.subscriberId,
          amountCents: session.amountCents,
          currency: session.currency,
          purpose: PaymentPurpose.STATUS,
          phone: cleanPhone,
          referencePrefix: 'STA',
          metadata: {
            statusId: session.statusId,
            offerId: session.offerId,
            checkoutId: session.id,
          },
        });
        break;
    }

    session = await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: { paymentId: started.paymentId },
    });
    return this.toView(session);
  }

  /** Interroge FlexPaie (en plus du webhook) pour le dernier paiement. */
  async check(id: string) {
    let session = await this.load(id);
    if (session.state === CheckoutState.OPEN && session.paymentId) {
      await this.payments.checkFlexpaieStatus(
        session.paymentId,
        session.subscriberId,
      );
      session = await this.load(id);
    }
    return this.toView(session);
  }

  // ------------------------------------------------------------ outils

  private async load(id: string): Promise<CheckoutSession> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(id)) {
      throw new NotFoundException('Lien de paiement introuvable');
    }
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id },
    });
    if (!session) throw new NotFoundException('Lien de paiement introuvable');
    if (
      session.state === CheckoutState.OPEN &&
      session.expiresAt.getTime() < Date.now() &&
      !(await this.hasPendingPayment(session))
    ) {
      return this.prisma.checkoutSession.update({
        where: { id },
        data: { state: CheckoutState.EXPIRED },
      });
    }
    return session;
  }

  /** Un paiement lancé juste avant l’expiration peut encore aboutir. */
  private async hasPendingPayment(session: CheckoutSession) {
    if (!session.paymentId) return false;
    const payment = await this.prisma.payment.findUnique({
      where: { id: session.paymentId },
      select: { status: true },
    });
    return payment?.status === PaymentStatus.PENDING;
  }

  private assertPayable(session: CheckoutSession) {
    if (session.state === CheckoutState.EXPIRED) {
      throw new GoneException(
        'Ce lien de paiement a expiré. Relancez le paiement depuis l’application.',
      );
    }
    if (session.state === CheckoutState.CANCELLED) {
      throw new GoneException('Ce paiement a été annulé.');
    }
  }

  private async toView(session: CheckoutSession) {
    const [subscriber, payment, imageUrl] = await Promise.all([
      this.prisma.subscriber.findUnique({
        where: { id: session.subscriberId },
        select: { name: true, email: true },
      }),
      session.paymentId
        ? this.prisma.payment.findUnique({
            where: { id: session.paymentId },
            select: { id: true, status: true, metadata: true },
          })
        : Promise.resolve(null),
      this.imageFor(session),
    ]);
    const meta =
      payment?.metadata &&
      typeof payment.metadata === 'object' &&
      !Array.isArray(payment.metadata)
        ? (payment.metadata as Record<string, unknown>)
        : {};
    const phone = typeof meta.phone === 'string' ? meta.phone : null;
    return {
      id: session.id,
      kind: session.kind,
      label: session.label,
      detail: session.detail,
      amountCents: session.amountCents,
      currency: session.currency,
      state: session.state,
      expiresAt: session.expiresAt.toISOString(),
      paidAt: session.paidAt?.toISOString() ?? null,
      imageUrl,
      returnUrl: session.returnUrl,
      account: {
        name: subscriber?.name ?? null,
        email: subscriber ? this.maskEmail(subscriber.email) : null,
      },
      payment: payment
        ? {
            status: payment.status,
            phone: phone ? this.maskPhone(phone) : null,
          }
        : null,
    };
  }

  private async imageFor(session: CheckoutSession): Promise<string | null> {
    if (session.magazineId) {
      const m = await this.prisma.magazine.findUnique({
        where: { id: session.magazineId },
        select: { coverKey: true },
      });
      return this.payments.resolveCoverUrl(m?.coverKey ?? null);
    }
    if (session.articleId) {
      const a = await this.prisma.article.findUnique({
        where: { id: session.articleId },
        select: { coverKey: true },
      });
      return this.payments.resolveCoverUrl(a?.coverKey ?? null);
    }
    if (session.statusId) {
      const slide = await this.prisma.statusSlide.findFirst({
        where: { statusId: session.statusId },
        orderBy: { position: 'asc' },
        select: { mediaType: true, mediaKey: true, posterKey: true },
      });
      const key =
        slide?.mediaType === 'VIDEO' ? slide.posterKey : slide?.mediaKey;
      return this.payments.resolveCoverUrl(key ?? null);
    }
    return null;
  }

  private lifetimeLabel(hours: number) {
    if (hours >= 48 && hours % 24 === 0) return `${hours / 24} jours`;
    return `${hours} h`;
  }

  private maskEmail(email: string) {
    const [user, domain] = email.split('@');
    if (!domain) return email;
    const head = user.slice(0, Math.min(2, user.length));
    return `${head}${'•'.repeat(Math.max(1, user.length - head.length))}@${domain}`;
  }

  private maskPhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 6) return phone;
    // Espaces insécables : le numéro masqué ne se coupe pas en fin de ligne
    return `${digits.slice(0, 3)}\u00a0•••\u00a0${digits.slice(-3)}`;
  }

  private siteUrl() {
    return (
      this.config.get<string>('APP_URL')?.replace(/\/$/, '') ||
      'https://fintechmedias.com'
    );
  }

  /** N’accepte qu’un retour vers l’app ou vers le site. */
  private safeReturnUrl(raw?: string): string | null {
    const url = raw?.trim();
    if (!url) return null;
    if (url.startsWith(APP_SCHEME)) return url;
    if (url.startsWith(`${this.siteUrl()}/`)) return url;
    return null;
  }
}
