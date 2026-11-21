import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityActorType,
  PaymentPurpose,
  Prisma,
  StatusOfferKind,
  StatusPaymentState,
} from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStatusOfferDto,
  UpdateStatusOfferDto,
} from './dto/admin-status.dto';

const OFFER_SELECT = {
  id: true,
  kind: true,
  label: true,
  description: true,
  priceCents: true,
  currency: true,
  statusLifetimeHours: true,
  quota: true,
  periodDays: true,
  isActive: true,
  sortOrder: true,
} satisfies Prisma.StatusOfferSelect;

const PASS_SELECT = {
  id: true,
  paymentState: true,
  startsAt: true,
  expiresAt: true,
  quota: true,
  usedCount: true,
  createdAt: true,
  offer: { select: { id: true, label: true } },
} satisfies Prisma.StatusPassSelect;

type PassRow = Prisma.StatusPassGetPayload<{ select: typeof PASS_SELECT }>;

/** Grille tarifaire des statuts abonnés et forfaits « Statuts ». */
@Injectable()
export class StatusOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly payments: PaymentsService,
  ) {}

  // ---------------------------------------------------------------- public

  async listActive() {
    const items = await this.prisma.statusOffer.findMany({
      // Plus de forfaits « Statuts » : l’abonnement couvre toute la plateforme
      where: { isActive: true, kind: StatusOfferKind.SINGLE },
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
      select: OFFER_SELECT,
    });
    return { items };
  }

  // --------------------------------------------------------------- abonnés

  /** Forfaits de l’abonné : actifs (payés, non expirés) puis en attente. */
  async listMyPasses(subscriberId: string) {
    const now = new Date();
    const rows = await this.prisma.statusPass.findMany({
      where: {
        subscriberId,
        OR: [
          { paymentState: StatusPaymentState.PAID, expiresAt: { gt: now } },
          {
            paymentState: StatusPaymentState.PENDING,
            createdAt: { gt: new Date(now.getTime() - 86_400_000) },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      select: PASS_SELECT,
    });
    const items = rows.map((row) => this.toPass(row));
    return {
      items,
      /** Publications disponibles sur les forfaits actifs (null = illimité) */
      remaining: items
        .filter((p) => p.active)
        .reduce<number | null>(
          (sum, p) =>
            sum === null || p.remaining === null ? null : sum + p.remaining,
          0,
        ),
      hasActivePass: items.some(
        (p) => p.active && (p.remaining === null || p.remaining > 0),
      ),
    };
  }

  async checkoutPass(subscriberId: string, offerId: string, phone: string) {
    const offer = await this.prisma.statusOffer.findFirst({
      where: { id: offerId, kind: StatusOfferKind.PASS, isActive: true },
    });
    if (!offer) throw new BadRequestException('Forfait indisponible');

    const pass = await this.prisma.statusPass.create({
      data: {
        subscriberId,
        offerId: offer.id,
        quota: offer.quota,
        paymentState: StatusPaymentState.PENDING,
      },
      select: PASS_SELECT,
    });
    try {
      const payment = await this.payments.startFlexpaieCharge({
        subscriberId,
        amountCents: offer.priceCents,
        currency: offer.currency,
        purpose: PaymentPurpose.STATUS_PLAN,
        phone,
        referencePrefix: 'STP',
        metadata: { passId: pass.id, offerId: offer.id },
      });
      void this.activity.log({
        actorType: ActivityActorType.SUBSCRIBER,
        subscriberId,
        action: 'status_pass_checkout',
        entity: 'status_pass',
        entityId: pass.id,
        meta: { offerId: offer.id, paymentId: payment.paymentId },
      });
      return { pass: this.toPass(pass), payment };
    } catch (err) {
      await this.prisma.statusPass.delete({ where: { id: pass.id } });
      throw err;
    }
  }

  // ----------------------------------------------------------------- admin

  async listAll() {
    const items = await this.prisma.statusOffer.findMany({
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { priceCents: 'asc' }],
      select: {
        ...OFFER_SELECT,
        _count: { select: { statuses: true, passes: true } },
      },
    });
    return {
      items: items.map(({ _count, ...offer }) => ({
        ...offer,
        statusCount: _count.statuses,
        passCount: _count.passes,
      })),
    };
  }

  async create(dto: CreateStatusOfferDto, actorId: string) {
    if (dto.kind === StatusOfferKind.PASS) {
      throw new BadRequestException(
        'Les forfaits Statuts ne sont plus proposés : chaque tarif est une publication avec sa propre durée',
      );
    }
    const offer = await this.prisma.statusOffer.create({
      data: {
        kind: StatusOfferKind.SINGLE,
        label: dto.label.trim(),
        description: dto.description?.trim() || null,
        priceCents: dto.priceCents,
        currency: (dto.currency ?? 'USD').toUpperCase(),
        statusLifetimeHours: dto.statusLifetimeHours ?? 24,
        quota: null,
        periodDays: null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
      select: OFFER_SELECT,
    });
    this.log(actorId, 'status_offer_created', offer.id);
    return offer;
  }

  async update(id: string, dto: UpdateStatusOfferDto, actorId: string) {
    const existing = await this.prisma.statusOffer.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Offre introuvable');
    const isPass = existing.kind === StatusOfferKind.PASS;
    if (isPass && dto.periodDays === null) {
      throw new BadRequestException('Durée du forfait requise');
    }
    const data: Prisma.StatusOfferUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.priceCents !== undefined) data.priceCents = dto.priceCents;
    if (dto.currency !== undefined) data.currency = dto.currency.toUpperCase();
    if (dto.statusLifetimeHours !== undefined) {
      data.statusLifetimeHours = dto.statusLifetimeHours;
    }
    if (isPass && dto.quota !== undefined) data.quota = dto.quota;
    if (isPass && dto.periodDays !== undefined)
      data.periodDays = dto.periodDays;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }
    const offer = await this.prisma.statusOffer.update({
      where: { id },
      data,
      select: OFFER_SELECT,
    });
    this.log(actorId, 'status_offer_updated', id, {
      fields: Object.keys(data),
    });
    return offer;
  }

  /** Suppression si jamais utilisée ; sinon on désactive (historique). */
  async remove(id: string, actorId: string) {
    const existing = await this.prisma.statusOffer.findUnique({
      where: { id },
      select: { _count: { select: { statuses: true, passes: true } } },
    });
    if (!existing) throw new NotFoundException('Offre introuvable');
    if (existing._count.statuses + existing._count.passes > 0) {
      await this.prisma.statusOffer.update({
        where: { id },
        data: { isActive: false },
      });
      this.log(actorId, 'status_offer_updated', id, { deactivated: true });
      return { ok: true as const, deactivated: true };
    }
    await this.prisma.statusOffer.delete({ where: { id } });
    this.log(actorId, 'status_offer_deleted', id);
    return { ok: true as const, deactivated: false };
  }

  async listPasses(filters: { take?: number; skip?: number } = {}) {
    const take = Math.min(Math.max(filters.take ?? 50, 1), 200);
    const skip = Math.max(filters.skip ?? 0, 0);
    const where: Prisma.StatusPassWhereInput = {
      paymentState: StatusPaymentState.PAID,
    };
    const [rows, total] = await Promise.all([
      this.prisma.statusPass.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          ...PASS_SELECT,
          subscriber: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.statusPass.count({ where }),
    ]);
    return {
      items: rows.map((row) => ({
        ...this.toPass(row),
        subscriber: row.subscriber,
      })),
      total,
      take,
      skip,
    };
  }

  // --------------------------------------------------------------- helpers

  private assertPassFields(
    kind: StatusOfferKind,
    periodDays: number | null | undefined,
  ) {
    if (kind === StatusOfferKind.PASS && !periodDays) {
      throw new BadRequestException('Durée du forfait (jours) requise');
    }
  }

  private toPass(row: PassRow) {
    const now = Date.now();
    const active =
      row.paymentState === StatusPaymentState.PAID &&
      !!row.expiresAt &&
      row.expiresAt.getTime() > now;
    return {
      id: row.id,
      offer: row.offer,
      paymentState: row.paymentState,
      active,
      startsAt: row.startsAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      quota: row.quota,
      usedCount: row.usedCount,
      remaining:
        row.quota === null ? null : Math.max(row.quota - row.usedCount, 0),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private log(
    actorId: string,
    action: string,
    offerId: string,
    meta?: Prisma.InputJsonValue,
  ) {
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action,
      entity: 'status_offer',
      entityId: offerId,
      meta,
    });
  }
}
