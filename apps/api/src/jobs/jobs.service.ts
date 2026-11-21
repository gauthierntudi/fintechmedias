import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityActorType,
  type Job,
  type JobCompany,
  JobContractType,
  JobStatus,
  JobWorkMode,
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
import { detectLogoBackground } from '../storage/logo-background';
import {
  JOB_COMPANY_SECTORS,
  JOB_CONTRACT_TYPES,
  JOB_WORK_MODES,
} from './dto/admin-job.dto';
import type {
  CreateJobDto,
  ListJobsQueryDto,
  UpdateJobCompanyDto,
  UpdateJobDto,
} from './dto/admin-job.dto';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  // ─── Public ──────────────────────────────────────────────────────────────

  async listPublic(query: ListJobsQueryDto) {
    const when = query.when ?? 'open';
    const take = Math.min(Math.max(query.take ?? 12, 1), 48);
    const skip = Math.max(query.skip ?? 0, 0);

    const and: Prisma.JobWhereInput[] = [{ status: JobStatus.PUBLISHED }];
    const period = this.periodFilter(when);
    if (period) and.push(period);
    const q = query.q?.trim();
    if (q) {
      and.push({
        OR: [{ title: { contains: q } }, { companyName: { contains: q } }],
      });
    }
    const location = query.location?.trim();
    if (location) and.push(await this.locationFilter(location));
    const contracts = this.pickList(query.contract, JOB_CONTRACT_TYPES);
    if (contracts.length) and.push({ contractType: { in: contracts } });
    const modes = this.pickList(query.mode, JOB_WORK_MODES);
    if (modes.length) and.push({ workMode: { in: modes } });
    const sectors = this.pickList(query.sector, JOB_COMPANY_SECTORS);
    if (sectors.length) and.push({ company: { sector: { in: sectors } } });
    const where: Prisma.JobWhereInput = { AND: and };

    // Compteurs des cases à cocher : offres de la période, hors autres filtres.
    const facetWhere: Prisma.JobWhereInput = {
      AND: [{ status: JobStatus.PUBLISHED }, ...(period ? [period] : [])],
    };

    const orderBy: Prisma.JobOrderByWithRelationInput[] =
      query.sort === 'deadline'
        ? [
            { deadline: { sort: 'asc', nulls: 'last' } },
            { publishedAt: 'desc' },
          ]
        : [{ publishedAt: 'desc' }, { createdAt: 'desc' }];

    const [rows, total, locationRows, byContract, byMode] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy,
        take,
        skip,
        include: { company: { select: { sector: true } } },
      }),
      this.prisma.job.count({ where }),
      // Lieux proposés dans le filtre : ceux des offres encore ouvertes.
      this.prisma.job.findMany({
        where: {
          AND: [{ status: JobStatus.PUBLISHED }, this.periodFilter('open')!],
        },
        select: { locations: true },
        take: 500,
      }),
      this.prisma.job.groupBy({
        by: ['contractType'],
        where: facetWhere,
        _count: { _all: true },
      }),
      this.prisma.job.groupBy({
        by: ['workMode'],
        where: facetWhere,
        _count: { _all: true },
      }),
    ]);

    const locations = new Set<string>();
    for (const r of locationRows) {
      for (const l of this.splitLocations(r.locations)) locations.add(l);
    }

    return {
      items: rows.map((row) => this.toCard(row, row.company?.sector)),
      total,
      take,
      skip,
      locations: [...locations].sort((a, b) => a.localeCompare(b, 'fr')),
      facets: {
        contract: Object.fromEntries(
          byContract.map((g) => [g.contractType, g._count._all]),
        ),
        mode: Object.fromEntries(
          byMode.map((g) => [g.workMode, g._count._all]),
        ),
      },
    };
  }

  /** « CDI,CDD » → valeurs autorisées uniquement. */
  private pickList<T extends string>(
    raw: string | undefined,
    allowed: readonly T[],
  ): T[] {
    if (!raw) return [];
    const set = new Set<string>(allowed);
    return [
      ...new Set(
        raw
          .split(',')
          .map((v) => v.trim())
          .filter((v): v is T => set.has(v)),
      ),
    ];
  }

  async getPublicBySlug(slug: string) {
    const row = await this.prisma.job.findUnique({ where: { slug } });
    if (!row || row.status !== JobStatus.PUBLISHED) {
      throw new NotFoundException('Offre introuvable');
    }
    const others = await this.prisma.job.findMany({
      where: {
        AND: [
          { status: JobStatus.PUBLISHED },
          { id: { not: row.id } },
          this.periodFilter('open')!,
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: 4,
      include: { company: { select: { sector: true } } },
    });
    return {
      ...this.toDetail(row),
      related: others.map((o) => this.toCard(o, o.company?.sector)),
    };
  }

  /**
   * Annuaire des entreprises fintech (ordre alphabétique), avec le nombre
   * d’offres publiées encore ouvertes.
   */
  async publicCompanies() {
    const rows = await this.prisma.jobCompany.findMany({
      // Seulement les entreprises ayant au moins une offre publiée.
      where: { jobs: { some: { status: JobStatus.PUBLISHED } } },
      select: {
        slug: true,
        name: true,
        logoKey: true,
        logoBg: true,
        url: true,
        sector: true,
        headquarters: true,
        appStoreUrl: true,
        playStoreUrl: true,
        _count: {
          select: {
            jobs: {
              where: {
                AND: [
                  { status: JobStatus.PUBLISHED },
                  this.periodFilter('open')!,
                ],
              },
            },
          },
        },
      },
      take: 500,
    });
    const items = rows
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        logoUrl: this.mediaUrl(r.logoKey),
        logoBg: r.logoBg,
        url: r.url,
        sector: r.sector,
        headquarters: r.headquarters,
        appStoreUrl: r.appStoreUrl,
        playStoreUrl: r.playStoreUrl,
        openJobs: r._count.jobs,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return { items, total: items.length };
  }

  /** Compteur de vues (une fois par affichage de la fiche). */
  async trackView(slug: string) {
    const row = await this.findPublishedForTracking(slug);
    await this.prisma.job.update({
      where: { id: row.id },
      data: { viewCount: { increment: 1 } },
      select: { id: true },
    });
    return { ok: true as const };
  }

  /** Clic « Postuler » — compté même si l’ouverture du lien est immédiate. */
  async trackApplyClick(slug: string) {
    const row = await this.findPublishedForTracking(slug);
    await this.prisma.job.update({
      where: { id: row.id },
      data: { applyClicks: { increment: 1 } },
      select: { id: true },
    });
    return { ok: true as const };
  }

  private async findPublishedForTracking(slug: string) {
    const row = await this.prisma.job.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!row || row.status !== JobStatus.PUBLISHED) {
      throw new NotFoundException('Offre introuvable');
    }
    return row;
  }

  // ─── Admin ───────────────────────────────────────────────────────────────

  async listAdmin(filters: {
    q?: string;
    status?: string;
    when?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(filters.take ?? 20, 1), 100);
    const skip = Math.max(filters.skip ?? 0, 0);
    const and: Prisma.JobWhereInput[] = [];
    const q = filters.q?.trim();
    if (q) {
      and.push({
        OR: [
          { title: { contains: q } },
          { companyName: { contains: q } },
          { locations: { contains: q } },
        ],
      });
    }
    if (filters.status === 'DRAFT' || filters.status === 'PUBLISHED') {
      and.push({ status: filters.status });
    }
    if (filters.when === 'open' || filters.when === 'closed') {
      and.push(this.periodFilter(filters.when)!);
    }
    const where: Prisma.JobWhereInput = and.length ? { AND: and } : {};

    const [rows, total, published, drafts, open] = await Promise.all([
      this.prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.job.count({ where }),
      this.prisma.job.count({ where: { status: JobStatus.PUBLISHED } }),
      this.prisma.job.count({ where: { status: JobStatus.DRAFT } }),
      this.prisma.job.count({
        where: {
          AND: [{ status: JobStatus.PUBLISHED }, this.periodFilter('open')!],
        },
      }),
    ]);

    return {
      items: rows.map((row) => this.toAdmin(row)),
      total,
      take,
      skip,
      summary: { total: published + drafts, published, drafts, open },
    };
  }

  async getAdmin(id: string) {
    const row = await this.prisma.job.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Offre introuvable');
    return this.toAdmin(row);
  }

  async create(dto: CreateJobDto, actorId: string) {
    const title = dto.title.trim();
    const slug = await this.uniqueSlug(dto.slug?.trim() || this.slugify(title));
    const status = (dto.status as JobStatus) ?? JobStatus.DRAFT;

    const created = await this.prisma.job.create({
      data: {
        title,
        slug,
        companyName: dto.companyName.trim(),
        companyLogoKey: this.text(dto.companyLogoKey),
        companyUrl: this.url(dto.companyUrl, 'companyUrl'),
        contractType:
          (dto.contractType as JobContractType) ?? JobContractType.CDI,
        workMode: (dto.workMode as JobWorkMode) ?? JobWorkMode.ON_SITE,
        status,
        locations: this.joinLocations(dto.locations),
        deadline: this.deadline(dto.deadline),
        description: this.richText(dto.description),
        applyUrl: this.url(dto.applyUrl, 'applyUrl'),
        applyEmail: this.email(dto.applyEmail),
        publishedAt: status === JobStatus.PUBLISHED ? new Date() : null,
      },
    });

    const linked = await this.syncCompany(created, this.companyExtras(dto));

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'job_created',
      entity: 'job',
      entityId: created.id,
      meta: { title: created.title, company: created.companyName },
    });

    return this.toAdmin(linked);
  }

  async update(id: string, dto: UpdateJobDto, actorId: string) {
    const existing = await this.prisma.job.findUnique({
      where: { id },
      select: { id: true, slug: true, publishedAt: true },
    });
    if (!existing) throw new NotFoundException('Offre introuvable');

    const data: Prisma.JobUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.slug !== undefined) {
      const wanted =
        dto.slug.trim() || this.slugify(dto.title?.trim() || existing.slug);
      if (wanted !== existing.slug) {
        data.slug = await this.uniqueSlug(wanted, id);
      }
    }
    if (dto.companyName !== undefined)
      data.companyName = dto.companyName.trim();
    if (dto.companyLogoKey !== undefined) {
      data.companyLogoKey = this.text(dto.companyLogoKey);
      // Recalculée par syncCompany si c’est le logo de la fiche entreprise.
      data.companyLogoBg = null;
    }
    if (dto.companyUrl !== undefined) {
      data.companyUrl = this.url(dto.companyUrl, 'companyUrl');
    }
    if (dto.contractType !== undefined) {
      data.contractType = dto.contractType;
    }
    if (dto.workMode !== undefined) data.workMode = dto.workMode;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === JobStatus.PUBLISHED && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    if (dto.locations !== undefined) {
      data.locations = this.joinLocations(dto.locations);
    }
    if (dto.deadline !== undefined) data.deadline = this.deadline(dto.deadline);
    if (dto.description !== undefined) {
      data.description = this.richText(dto.description);
    }
    if (dto.applyUrl !== undefined) {
      data.applyUrl = this.url(dto.applyUrl, 'applyUrl');
    }
    if (dto.applyEmail !== undefined)
      data.applyEmail = this.email(dto.applyEmail);

    const updated = await this.syncCompany(
      await this.prisma.job.update({ where: { id }, data }),
      this.companyExtras(dto),
    );

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'job_updated',
      entity: 'job',
      entityId: id,
      meta: { title: updated.title, status: updated.status },
    });

    return this.toAdmin(updated);
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.job.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!existing) throw new NotFoundException('Offre introuvable');
    await this.prisma.job.delete({ where: { id } });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'job_deleted',
      entity: 'job',
      entityId: id,
      meta: { title: existing.title },
    });
    return { ok: true as const };
  }

  async uploadLogo(id: string, file: UploadFile, actorId: string) {
    const row = await this.prisma.job.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Offre introuvable');
    const key = await this.uploadImage(id, file);
    const bg = await detectLogoBackground(file.buffer);
    const updated = await this.syncCompany(
      await this.prisma.job.update({
        where: { id },
        data: { companyLogoKey: key, companyLogoBg: bg },
      }),
    );
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'job_logo_uploaded',
      entity: 'job',
      entityId: id,
      meta: { key, size: file.size },
    });
    return this.toAdmin(updated);
  }

  /** Annuaire (admin) : fiches complètes + nombre d’offres. */
  async companies() {
    const rows = await this.prisma.jobCompany.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { jobs: true } } },
      take: 1000,
    });
    return {
      items: rows
        .map((r) => ({ ...this.toCompany(r), jobs: r._count.jobs }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    };
  }

  async updateCompany(id: string, dto: UpdateJobCompanyDto, actorId: string) {
    const existing = await this.prisma.jobCompany.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Entreprise introuvable');

    const data: Prisma.JobCompanyUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.replace(/\s+/g, ' ').trim();
      const nameKey = this.companyKey(name);
      if (!nameKey) throw new BadRequestException('Nom requis');
      if (nameKey !== existing.nameKey) {
        const clash = await this.prisma.jobCompany.findUnique({
          where: { nameKey },
          select: { id: true },
        });
        if (clash) {
          throw new BadRequestException(
            'Une autre entreprise porte déjà ce nom',
          );
        }
      }
      data.name = name;
      data.nameKey = nameKey;
    }
    if (dto.logoKey !== undefined) {
      data.logoKey = this.text(dto.logoKey);
      data.logoBg = null;
    }
    if (dto.url !== undefined) data.url = this.url(dto.url, 'url');
    Object.assign(data, this.companyFields(dto));

    const updated = await this.prisma.jobCompany.update({
      where: { id },
      data,
    });
    await this.propagateCompany(updated);

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'job_company_updated',
      entity: 'job_company',
      entityId: id,
      meta: { name: updated.name },
    });
    return this.toCompany(updated);
  }

  async uploadCompanyLogo(id: string, file: UploadFile, actorId: string) {
    const existing = await this.prisma.jobCompany.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Entreprise introuvable');
    const key = await this.uploadImage(`companies/${id}`, file);
    const updated = await this.prisma.jobCompany.update({
      where: { id },
      data: { logoKey: key, logoBg: await detectLogoBackground(file.buffer) },
    });
    await this.propagateCompany(updated);
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'job_company_updated',
      entity: 'job_company',
      entityId: id,
      meta: { name: updated.name, logo: key },
    });
    return this.toCompany(updated);
  }

  /** Nom, logo et site de la fiche → recopiés sur ses offres. */
  private async propagateCompany(company: JobCompany) {
    await this.prisma.job.updateMany({
      where: { companyId: company.id },
      data: {
        companyName: company.name,
        companyLogoKey: company.logoKey,
        companyLogoBg: company.logoBg,
        companyUrl: company.url,
      },
    });
  }

  private toCompany(r: JobCompany) {
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      logoKey: r.logoKey,
      logoUrl: this.mediaUrl(r.logoKey),
      logoBg: r.logoBg,
      url: r.url,
      sector: r.sector,
      headquarters: r.headquarters,
      appStoreUrl: r.appStoreUrl,
      playStoreUrl: r.playStoreUrl,
    };
  }

  /** Champs annuaire envoyés avec l’offre (undefined = inchangé). */
  private companyExtras(dto: CreateJobDto | UpdateJobDto) {
    return this.companyFields({
      sector: dto.companySector,
      headquarters: dto.companyHeadquarters,
      appStoreUrl: dto.companyAppStoreUrl,
      playStoreUrl: dto.companyPlayStoreUrl,
    });
  }

  private companyFields(dto: {
    sector?: string | null;
    headquarters?: string | null;
    appStoreUrl?: string | null;
    playStoreUrl?: string | null;
  }) {
    const out: {
      sector?: string | null;
      headquarters?: string | null;
      appStoreUrl?: string | null;
      playStoreUrl?: string | null;
    } = {};
    if (dto.sector !== undefined) out.sector = this.text(dto.sector);
    if (dto.headquarters !== undefined) {
      out.headquarters =
        this.text(dto.headquarters)?.replace(/\s+/g, ' ') ?? null;
    }
    if (dto.appStoreUrl !== undefined) {
      out.appStoreUrl = this.url(dto.appStoreUrl, 'App Store');
    }
    if (dto.playStoreUrl !== undefined) {
      out.playStoreUrl = this.url(dto.playStoreUrl, 'Play Store');
    }
    return out;
  }

  /**
   * Rattache l’offre à sa fiche entreprise ; la crée si le nom est nouveau.
   * Le logo et le site saisis sur l’offre mettent la fiche à jour.
   */
  async syncCompany(
    job: Job,
    extras: ReturnType<JobsService['companyFields']> = {},
  ): Promise<Job> {
    const name = job.companyName.replace(/\s+/g, ' ').trim();
    const nameKey = this.companyKey(name);
    if (!nameKey) return job;

    let company = await this.prisma.jobCompany.findUnique({
      where: { nameKey },
    });
    if (!company) {
      try {
        company = await this.prisma.jobCompany.create({
          data: {
            name,
            nameKey,
            slug: await this.uniqueCompanySlug(name),
            logoKey: job.companyLogoKey,
            logoBg: job.companyLogoBg,
            url: job.companyUrl,
            ...extras,
          },
        });
      } catch (e) {
        // Création concurrente du même nom : on relit la fiche.
        company = await this.prisma.jobCompany.findUnique({
          where: { nameKey },
        });
        if (!company) throw e;
      }
    } else {
      const patch: Prisma.JobCompanyUpdateInput = { ...extras };
      if (job.companyLogoKey && job.companyLogoKey !== company.logoKey) {
        patch.logoKey = job.companyLogoKey;
        patch.logoBg = job.companyLogoBg;
      }
      if (job.companyUrl && job.companyUrl !== company.url) {
        patch.url = job.companyUrl;
      }
      if (Object.keys(patch).length) {
        company = await this.prisma.jobCompany.update({
          where: { id: company.id },
          data: patch,
        });
        if (patch.logoKey !== undefined || patch.url !== undefined) {
          await this.propagateCompany(company);
        }
      }
    }

    // Logo de la fiche réutilisé sur l’offre → même couleur de fond.
    const logoBg =
      job.companyLogoKey && job.companyLogoKey === company.logoKey
        ? company.logoBg
        : job.companyLogoBg;
    if (job.companyId === company.id && job.companyLogoBg === logoBg) {
      return job;
    }
    return this.prisma.job.update({
      where: { id: job.id },
      data: { companyId: company.id, companyLogoBg: logoBg },
    });
  }

  private companyKey(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async uniqueCompanySlug(name: string): Promise<string> {
    const root = this.slugify(name);
    let candidate = root;
    for (let i = 2; i < 200; i++) {
      const hit = await this.prisma.jobCompany.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!hit) return candidate;
      candidate = `${root}-${i}`;
    }
    return `${root}-${randomBytes(3).toString('hex')}`;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** open = sans date limite ou limite non dépassée ; closed = dépassée. */
  private periodFilter(when: string): Prisma.JobWhereInput | null {
    const now = new Date();
    if (when === 'open') {
      return { OR: [{ deadline: null }, { deadline: { gte: now } }] };
    }
    if (when === 'closed') return { deadline: { lt: now } };
    return null;
  }

  private isOpen(row: Pick<Job, 'deadline'>): boolean {
    return !row.deadline || row.deadline.getTime() >= Date.now();
  }

  private toCard(row: Job, companySector?: string | null) {
    return {
      id: row.id,
      slug: row.slug,
      companySector: companySector ?? null,
      title: row.title,
      companyName: row.companyName,
      companyLogoUrl: this.mediaUrl(row.companyLogoKey),
      companyLogoBg: row.companyLogoBg,
      contractType: row.contractType,
      workMode: row.workMode,
      locations: this.splitLocations(row.locations),
      deadline: row.deadline?.toISOString() ?? null,
      isOpen: this.isOpen(row),
      publishedAt: row.publishedAt?.toISOString() ?? null,
      excerpt: this.excerpt(row.description),
    };
  }

  private toDetail(row: Job) {
    return {
      ...this.toCard(row),
      companyUrl: row.companyUrl,
      description: row.description,
      applyUrl: row.applyUrl,
      applyEmail: row.applyEmail,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAdmin(row: Job) {
    return {
      ...this.toDetail(row),
      status: row.status,
      companyLogoKey: row.companyLogoKey,
      viewCount: row.viewCount,
      applyClicks: row.applyClicks,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * HTML de l’éditeur riche → liste blanche de balises (texte, titres,
   * listes, liens). Attributs retirés, sauf `href` http(s)/mailto sur `<a>`.
   */
  private richText(raw: string | null | undefined): string | null {
    const value = this.text(raw);
    if (!value) return null;
    const allowed = new Set([
      'p',
      'br',
      'div',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'blockquote',
      'a',
    ]);
    const html = value
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(
        /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi,
        '',
      )
      .replace(
        /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
        (tag, rawName: string, attrs: string) => {
          const name = rawName.toLowerCase();
          if (!allowed.has(name)) return '';
          if (tag.startsWith('</')) return `</${name}>`;
          if (name === 'a') {
            const m = /\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
              attrs,
            );
            const href = (m?.[2] ?? m?.[3] ?? m?.[4] ?? '').trim();
            if (!/^(https?:|mailto:)/i.test(href)) return '<a>';
            const safe = href.replace(/"/g, '&quot;');
            return `<a href="${safe}" target="_blank" rel="noopener noreferrer nofollow">`;
          }
          return name === 'br' ? '<br>' : `<${name}>`;
        },
      )
      .trim();
    return this.htmlToText(html) ? html : null;
  }

  /** Texte brut d’un fragment HTML (entités courantes décodées). */
  private htmlToText(html: string): string {
    return html
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Premières phrases de la description, sans balises ni puces. */
  private excerpt(description: string | null): string | null {
    if (!description) return null;
    const flat = this.htmlToText(
      description.replace(/^\s*(?:[-•*]|\d+[.)])\s+/gm, ''),
    );
    if (!flat) return null;
    return flat.length > 220 ? `${flat.slice(0, 217).trimEnd()}…` : flat;
  }

  /**
   * Lieu de l’URL (« kinshasa-gombe ») → lieux exacts en base ayant le même
   * slug (« Kinshasa — Gombe »). Sans correspondance : recherche telle quelle.
   */
  private async locationFilter(input: string): Promise<Prisma.JobWhereInput> {
    const slug = this.slugify(input);
    const rows = await this.prisma.job.findMany({
      where: { status: JobStatus.PUBLISHED },
      select: { locations: true },
      take: 1000,
    });
    const names = new Set<string>();
    for (const r of rows) {
      for (const l of this.splitLocations(r.locations)) {
        if (this.slugify(l) === slug) names.add(l);
      }
    }
    if (!names.size) return { locations: { contains: input } };
    return { OR: [...names].map((n) => ({ locations: { contains: n } })) };
  }

  private splitLocations(raw: string): string[] {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  }

  private joinLocations(items: string[] | undefined): string {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items ?? []) {
      const v = item.replace(/\s+/g, ' ').trim();
      const k = v.toLowerCase();
      if (!v || seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
    return out.join('\n');
  }

  /** « YYYY-MM-DD » → fin de journée à Kinshasa (UTC+1). */
  private deadline(raw: string | null | undefined): Date | null {
    const v = raw?.trim();
    if (!v) return null;
    const d = new Date(`${v}T23:59:59.999+01:00`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Date limite invalide');
    }
    return d;
  }

  private text(raw: string | null | undefined): string | null {
    if (raw === undefined || raw === null) return null;
    const trimmed = raw.trim();
    return trimmed || null;
  }

  private email(raw: string | null | undefined): string | null {
    const v = this.text(raw)?.replace(/^mailto:/i, '');
    if (!v) return null;
    if (!EMAIL_RE.test(v)) {
      throw new BadRequestException('Adresse e-mail de candidature invalide');
    }
    return v.toLowerCase();
  }

  private url(raw: string | null | undefined, field: string): string | null {
    const value = this.text(raw);
    if (!value) return null;
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const parsed = new URL(withScheme);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      return parsed.toString();
    } catch {
      throw new BadRequestException(`Lien invalide (${field})`);
    }
  }

  private slugify(input: string): string {
    return (
      input
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 200) || 'offre'
    );
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = this.slugify(base);
    let candidate = root;
    for (let i = 2; i < 200; i++) {
      const hit = await this.prisma.job.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!hit || hit.id === excludeId) return candidate;
      candidate = `${root}-${i}`;
    }
    return `${root}-${randomBytes(3).toString('hex')}`;
  }

  private async uploadImage(id: string, file: UploadFile): Promise<string> {
    if (!file?.buffer?.length)
      throw new BadRequestException('Aucun fichier reçu');
    if (file.size > 4_000_000) {
      throw new BadRequestException('Le logo dépasse 4 Mo');
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Formats image : JPG, PNG, WEBP');
    }
    let ext = extname(file.originalname).toLowerCase().replace('.', '');
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      ext = file.mimetype.includes('png')
        ? 'png'
        : file.mimetype.includes('webp')
          ? 'webp'
          : 'jpg';
    }
    if (ext === 'jpeg') ext = 'jpg';

    const r2 = createR2ClientFromEnv();
    if (!r2) {
      throw new BadRequestException(
        'Stockage R2 non configuré (R2_ACCESS_KEY_ID / R2_BUCKET)',
      );
    }
    const key = `jobs/${id}/logo/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
    await putR2Object(r2, {
      key,
      body: file.buffer,
      contentType: contentTypeForExt(ext),
    });
    return key;
  }

  private mediaUrl(key: string | null | undefined): string | null {
    if (!key) return null;
    const trimmed = key.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const r2 = this.config.get<string>('R2_PUBLIC_URL')?.replace(/\/$/, '');
    if (!r2) return null;
    return `${r2}/${trimmed.replace(/^\//, '')}`;
  }
}
