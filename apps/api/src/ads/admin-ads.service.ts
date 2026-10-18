import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityActorType,
  AdDiffusionStatus,
  AdFormat,
  AdPaymentStatus,
  AdValidationStatus,
  AdminRole,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  putR2Object,
} from '../storage/r2';
import {
  dimensionsFor,
  PLACEMENT_FORMAT,
  placementOf,
  type AdPlacement,
} from './ad-catalog';
import { AdsService } from './ads.service';
import {
  CreateAdDto,
  RefuseAdDto,
  UpdateAdDto,
  UpdateAdRateDto,
} from './dto/admin-ad.dto';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const AD_SELECT = {
  id: true,
  legacyId: true,
  title: true,
  format: true,
  placement: true,
  imageKey: true,
  targetUrl: true,
  dimensions: true,
  startsOn: true,
  endsOn: true,
  impressions: true,
  views: true,
  clicks: true,
  amountPaid: true,
  paymentStatus: true,
  validationStatus: true,
  refusalReason: true,
  diffusionStatus: true,
  isLocked: true,
  createdByAdmin: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdvertisementSelect;

@Injectable()
export class AdminAdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: AdsService,
    private readonly activity: ActivityService,
  ) {}

  async list(filters: {
    q?: string;
    validation?: string;
    payment?: string;
    diffusion?: string;
    placement?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(filters.take ?? 20, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);
    const q = filters.q?.trim();
    const where: Prisma.AdvertisementWhereInput = {};
    if (q) where.title = { contains: q };
    const validation = enumValue(AdValidationStatus, filters.validation);
    const payment = enumValue(AdPaymentStatus, filters.payment);
    const diffusion = enumValue(AdDiffusionStatus, filters.diffusion);
    if (validation) where.validationStatus = validation;
    if (payment) where.paymentStatus = payment;
    if (diffusion) where.diffusionStatus = diffusion;
    if (filters.placement?.trim()) {
      const placement = placementOf(filters.placement.trim());
      if (!placement) throw new BadRequestException('Emplacement inconnu');
      where.placement = placement;
    }

    const [items, total, pending, approved, active, revenue] = await Promise.all([
      this.prisma.advertisement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: AD_SELECT,
      }),
      this.prisma.advertisement.count({ where }),
      this.prisma.advertisement.count({
        where: { validationStatus: AdValidationStatus.PENDING },
      }),
      this.prisma.advertisement.count({
        where: { validationStatus: AdValidationStatus.APPROVED },
      }),
      this.prisma.advertisement.count({
        where: { diffusionStatus: AdDiffusionStatus.ACTIVE },
      }),
      this.prisma.advertisement.aggregate({ _sum: { amountPaid: true } }),
    ]);

    return {
      items: items.map((row) => this.toAdmin(row)),
      total,
      take,
      skip,
      summary: {
        pending,
        approved,
        active,
        revenue: money(revenue._sum.amountPaid),
      },
    };
  }

  async getById(id: string) {
    return this.toAdmin(await this.assertExists(id));
  }

  async create(dto: CreateAdDto, actor: { id: string; role: string }) {
    const placement = this.placement(dto.placement);
    const format = PLACEMENT_FORMAT[placement];
    const startsOn = this.day(dto.startsOn, 'date de début');
    const endsOn = this.day(dto.endsOn, 'date de fin');
    this.assertRange(startsOn, endsOn);
    await this.assertRate(format);

    const superadmin = actor.role === AdminRole.SUPERADMIN;
    const locked = superadmin && dto.isLocked === true;
    const created = await this.prisma.advertisement.create({
      data: {
        title: dto.title.trim(),
        format,
        placement,
        imageKey: '',
        targetUrl: dto.targetUrl.trim(),
        dimensions: dimensionsFor(placement),
        startsOn,
        endsOn,
        amountPaid: 0,
        paymentStatus: AdPaymentStatus.FREE,
        validationStatus: superadmin
          ? AdValidationStatus.APPROVED
          : AdValidationStatus.PENDING,
        diffusionStatus: superadmin
          ? AdDiffusionStatus.ACTIVE
          : AdDiffusionStatus.INACTIVE,
        isLocked: locked,
        createdByAdmin: true,
      },
      select: AD_SELECT,
    });

    if (locked) await this.unlockOthers(created.id, placement);
    this.ads.clearCache();
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actor.id,
      action: 'ad_created',
      entity: 'advertisement',
      entityId: created.id,
      meta: { title: created.title, placement },
    });
    return this.toAdmin(created);
  }

  async update(
    id: string,
    dto: UpdateAdDto,
    actor: { id: string; role: string },
  ) {
    const current = await this.assertExists(id);
    const data: Prisma.AdvertisementUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.targetUrl !== undefined) data.targetUrl = dto.targetUrl.trim();
    if (dto.placement !== undefined) {
      const placement = this.placement(dto.placement);
      const format = PLACEMENT_FORMAT[placement];
      data.placement = placement;
      data.format = format;
      data.dimensions = dimensionsFor(placement);
    }
    const startsOn = dto.startsOn
      ? this.day(dto.startsOn, 'date de début')
      : current.startsOn;
    const endsOn = dto.endsOn
      ? this.day(dto.endsOn, 'date de fin')
      : current.endsOn;
    if (dto.startsOn || dto.endsOn) {
      this.assertRange(startsOn, endsOn);
      data.startsOn = startsOn;
      data.endsOn = endsOn;
    }
    if (dto.isLocked !== undefined) {
      if (actor.role !== AdminRole.SUPERADMIN) {
        throw new BadRequestException(
          'Seul un superadmin peut verrouiller un emplacement',
        );
      }
      data.isLocked = dto.isLocked;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }

    const updated = await this.prisma.advertisement.update({
      where: { id },
      data,
      select: AD_SELECT,
    });
    if (updated.isLocked && updated.placement) {
      await this.unlockOthers(updated.id, updated.placement);
    }
    this.ads.clearCache();
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actor.id,
      action: 'ad_updated',
      entity: 'advertisement',
      entityId: id,
      meta: { title: updated.title },
    });
    return this.toAdmin(updated);
  }

  async uploadImage(id: string, file: UploadFile, actorId: string) {
    await this.assertExists(id);
    this.assertImage(file);
    const ext = this.safeExt(file.originalname, file.mimetype);
    const key = `uploads/ads/${randomBytes(6).toString('hex')}_${Date.now()}.${ext}`;
    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException('Stockage R2 non configuré');
    }
    await putR2Object(r2, {
      key,
      body: file.buffer,
      contentType: contentTypeForExt(ext),
    });
    const updated = await this.prisma.advertisement.update({
      where: { id },
      data: { imageKey: key },
      select: AD_SELECT,
    });
    this.ads.clearCache();
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'ad_image_uploaded',
      entity: 'advertisement',
      entityId: id,
      meta: { imageKey: key },
    });
    return this.toAdmin(updated);
  }

  async validate(id: string, actorId: string) {
    const current = await this.assertExists(id);
    const canDiffuse =
      current.paymentStatus === AdPaymentStatus.FREE ||
      current.paymentStatus === AdPaymentStatus.PAID;
    const updated = await this.prisma.advertisement.update({
      where: { id },
      data: {
        validationStatus: AdValidationStatus.APPROVED,
        refusalReason: null,
        ...(canDiffuse ? { diffusionStatus: AdDiffusionStatus.ACTIVE } : {}),
      },
      select: AD_SELECT,
    });
    this.ads.clearCache();
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'ad_validated',
      entity: 'advertisement',
      entityId: id,
      meta: { title: updated.title },
    });
    return this.toAdmin(updated);
  }

  async refuse(id: string, dto: RefuseAdDto, actorId: string) {
    await this.assertExists(id);
    const updated = await this.prisma.advertisement.update({
      where: { id },
      data: {
        validationStatus: AdValidationStatus.REJECTED,
        refusalReason: dto.reason.trim(),
        diffusionStatus: AdDiffusionStatus.INACTIVE,
        isLocked: false,
      },
      select: AD_SELECT,
    });
    this.ads.clearCache();
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'ad_refused',
      entity: 'advertisement',
      entityId: id,
      meta: { title: updated.title },
    });
    return this.toAdmin(updated);
  }

  async setDiffusion(id: string, active: boolean, actorId: string) {
    const current = await this.assertExists(id);
    if (active) {
      if (current.validationStatus !== AdValidationStatus.APPROVED) {
        throw new BadRequestException('La publicité doit d’abord être validée');
      }
      if (
        current.paymentStatus !== AdPaymentStatus.FREE &&
        current.paymentStatus !== AdPaymentStatus.PAID
      ) {
        throw new BadRequestException('Le paiement n’est pas réglé');
      }
    }
    const updated = await this.prisma.advertisement.update({
      where: { id },
      data: {
        diffusionStatus: active
          ? AdDiffusionStatus.ACTIVE
          : AdDiffusionStatus.INACTIVE,
      },
      select: AD_SELECT,
    });
    this.ads.clearCache();
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: active ? 'ad_activated' : 'ad_deactivated',
      entity: 'advertisement',
      entityId: id,
      meta: { title: updated.title },
    });
    return this.toAdmin(updated);
  }

  async remove(id: string, actorId: string) {
    const current = await this.assertExists(id);
    await this.prisma.advertisement.delete({ where: { id } });
    this.ads.clearCache();
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'ad_deleted',
      entity: 'advertisement',
      entityId: id,
      meta: { title: current.title },
    });
    return { ok: true };
  }

  async rates() {
    const rows = await this.prisma.adRate.findMany({
      orderBy: { format: 'asc' },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        format: row.format,
        dimensions: row.dimensions,
        price7Days: money(row.price7Days),
        price15Days: money(row.price15Days),
        price30Days: money(row.price30Days),
        isActive: row.isActive,
      })),
    };
  }

  async updateRate(id: string, dto: UpdateAdRateDto, actorId: string) {
    const current = await this.prisma.adRate.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Tarif introuvable');
    const data: Prisma.AdRateUpdateInput = {};
    if (dto.price7Days !== undefined) data.price7Days = this.price(dto.price7Days);
    if (dto.price15Days !== undefined) data.price15Days = this.price(dto.price15Days);
    if (dto.price30Days !== undefined) data.price30Days = this.price(dto.price30Days);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification');
    }
    const updated = await this.prisma.adRate.update({ where: { id }, data });
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'ad_rate_updated',
      entity: 'ad_rate',
      entityId: id,
      meta: { format: updated.format },
    });
    return {
      id: updated.id,
      format: updated.format,
      dimensions: updated.dimensions,
      price7Days: money(updated.price7Days),
      price15Days: money(updated.price15Days),
      price30Days: money(updated.price30Days),
      isActive: updated.isActive,
    };
  }

  private async unlockOthers(id: string, placement: string) {
    await this.prisma.advertisement.updateMany({
      where: { placement, isLocked: true, NOT: { id } },
      data: { isLocked: false },
    });
  }

  private async assertExists(id: string) {
    const row = await this.prisma.advertisement.findUnique({
      where: { id },
      select: AD_SELECT,
    });
    if (!row) throw new NotFoundException('Publicité introuvable');
    return row;
  }

  private async assertRate(format: AdFormat) {
    const rate = await this.prisma.adRate.findUnique({ where: { format } });
    if (!rate || !rate.isActive) {
      throw new BadRequestException('Aucun tarif actif pour ce format');
    }
  }

  private placement(value: string): AdPlacement {
    const placement = placementOf(value);
    if (!placement) throw new BadRequestException('Emplacement inconnu');
    return placement;
  }

  private day(value: string, label: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`La ${label} est invalide`);
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`La ${label} est invalide`);
    }
    return date;
  }

  private assertRange(startsOn: Date, endsOn: Date) {
    if (endsOn < startsOn) {
      throw new BadRequestException('La date de fin précède la date de début');
    }
  }

  private price(value: number) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new BadRequestException('Le tarif doit être un montant positif');
    }
    return Math.round(value * 100) / 100;
  }

  private assertImage(file: UploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucune image reçue');
    }
    if (file.size > 8_000_000) {
      throw new BadRequestException('L’image dépasse 8 Mo');
    }
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(
      file.mimetype,
    );
    if (!ok) {
      throw new BadRequestException('Formats acceptés : JPG, PNG, WEBP, GIF');
    }
  }

  private safeExt(originalname: string, mimetype: string) {
    let ext = extname(originalname).toLowerCase().replace('.', '');
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      if (mimetype.includes('png')) ext = 'png';
      else if (mimetype.includes('webp')) ext = 'webp';
      else if (mimetype.includes('gif')) ext = 'gif';
      else ext = 'jpg';
    }
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  private toAdmin(row: Prisma.AdvertisementGetPayload<{ select: typeof AD_SELECT }>) {
    return {
      id: row.id,
      legacyId: row.legacyId,
      title: row.title,
      format: row.format,
      placement: row.placement,
      dimensions: row.dimensions,
      imageUrl: row.imageKey ? this.ads.imageUrl(row.imageKey) : null,
      targetUrl: row.targetUrl,
      startsOn: isoDay(row.startsOn),
      endsOn: isoDay(row.endsOn),
      impressions: row.impressions,
      views: row.views,
      clicks: row.clicks,
      amountPaid: money(row.amountPaid),
      paymentStatus: row.paymentStatus,
      validationStatus: row.validationStatus,
      refusalReason: row.refusalReason,
      diffusionStatus: row.diffusionStatus,
      isLocked: row.isLocked,
      createdByAdmin: row.createdByAdmin,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function money(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

function enumValue<T extends Record<string, string>>(
  catalog: T,
  raw: string | undefined,
): T[keyof T] | undefined {
  if (!raw) return undefined;
  const values = Object.values(catalog) as string[];
  if (!values.includes(raw)) {
    throw new BadRequestException('Filtre inconnu');
  }
  return raw as T[keyof T];
}
