import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityActorType,
  EventFormat,
  EventStatus,
  EventType,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { ActivityService } from '../activity/activity.service';
import { PrismaService } from '../prisma/prisma.service';
import { detectLogoBackground } from '../storage/logo-background';
import {
  contentTypeForExt,
  createR2ClientFromEnv,
  putR2Object,
} from '../storage/r2';
import type {
  CreateEventDto,
  EventCoOrganizerDto,
  EventProgrammeItemDto,
  EventSpeakerDto,
  EventTicketTierDto,
  EventDaysQueryDto,
  ListEventsQueryDto,
  UpdateEventDto,
} from './dto/admin-event.dto';

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
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
  bio: string | null;
};

export type EventCoOrganizer = {
  id: string;
  name: string;
  logoKey: string | null;
  /** Couleur de fond détectée sur le logo (#rrggbb) */
  logoBg?: string | null;
  url: string | null;
};

export type EventTicketTier = {
  id: string;
  name: string;
  description: string | null;
  prices: { currency: string; amount: number }[];
};

const EVENT_INCLUDE = {
  sponsors: {
    orderBy: { position: 'asc' },
    include: {
      sponsor: { select: { id: true, name: true, logoKey: true, url: true } },
    },
  },
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof EVENT_INCLUDE }>;

const STATS_DAYS = 30;
const DAY_MS = 86_400_000;
/** Africa/Kinshasa = UTC+1 toute l’année (même fuseau que le site). */
const EVENT_TZ_OFFSET_MS = 3_600_000;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly activity: ActivityService,
  ) {}

  // ─── Public ──────────────────────────────────────────────────────────────

  async listPublic(query: ListEventsQueryDto) {
    const when = query.when ?? 'upcoming';
    const take = Math.min(Math.max(query.take ?? 12, 1), 48);
    const skip = Math.max(query.skip ?? 0, 0);

    const and: Prisma.EventWhereInput[] = [
      { status: EventStatus.PUBLISHED },
      ...(await this.publicFilters(query)),
    ];
    const day = query.date ? this.dayRange(query.date) : null;
    if (day) {
      and.push(this.overlaps(day.start, day.end));
    } else {
      const timeFilter = this.timeFilter(when);
      if (timeFilter) and.push(timeFilter);
    }
    if (query.type) and.push({ type: query.type });
    const where: Prisma.EventWhereInput = { AND: and };

    const [rows, total, cityRows] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { startsAt: when === 'past' ? 'desc' : 'asc' },
        take,
        skip,
        include: EVENT_INCLUDE,
      }),
      this.prisma.event.count({ where }),
      this.prisma.event.findMany({
        where: { status: EventStatus.PUBLISHED, city: { not: null } },
        select: { city: true },
        distinct: ['city'],
        orderBy: { city: 'asc' },
      }),
    ]);

    return {
      items: rows.map((row) => this.toCard(row)),
      total,
      take,
      skip,
      cities: cityRows
        .map((r) => r.city?.trim())
        .filter((c): c is string => Boolean(c)),
    };
  }

  /** Jours (YYYY-MM-DD, Kinshasa) couverts par au moins un événement publié. */
  async listPublicDays(query: EventDaysQueryDto): Promise<{ days: string[] }> {
    const from = this.dayRange(query.from);
    const to = this.dayRange(query.to);
    if (!from || !to || to.end <= from.start) return { days: [] };
    const maxEnd = new Date(from.start.getTime() + 62 * DAY_MS);
    const end = to.end > maxEnd ? maxEnd : to.end;

    const rows = await this.prisma.event.findMany({
      where: {
        AND: [
          { status: EventStatus.PUBLISHED },
          ...(await this.publicFilters(query)),
          this.overlaps(from.start, end),
        ],
      },
      select: { startsAt: true, endsAt: true },
      take: 500,
    });

    const days = new Set<string>();
    for (const r of rows) {
      const first = Math.max(this.dayStartOf(r.startsAt), from.start.getTime());
      const last = Math.min(
        this.dayStartOf(r.endsAt ?? r.startsAt),
        end.getTime() - DAY_MS,
      );
      for (let t = first; t <= last; t += DAY_MS) days.add(this.dayKey(t));
    }
    return { days: [...days].sort() };
  }

  async getPublicBySlug(slug: string) {
    const row = await this.prisma.event.findUnique({
      where: { slug },
      include: EVENT_INCLUDE,
    });
    if (!row || row.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Événement introuvable');
    }
    return this.toDetail(row);
  }

  /** Compteur de vues (fiche) — total + jour courant. */
  async trackView(slug: string) {
    return this.track(slug, 'view');
  }

  /** Clic vers la billetterie externe — renvoie l’URL à ouvrir. */
  async trackTicketClick(slug: string) {
    return this.track(slug, 'ticket');
  }

  private async track(slug: string, kind: 'view' | 'ticket') {
    const row = await this.prisma.event.findUnique({
      where: { slug },
      select: { id: true, status: true, ticketUrl: true },
    });
    if (!row || row.status !== EventStatus.PUBLISHED) {
      throw new NotFoundException('Événement introuvable');
    }
    if (kind === 'ticket' && !row.ticketUrl) {
      throw new BadRequestException('Pas de billetterie pour cet événement');
    }
    const day = new Date().toISOString().slice(0, 10);
    const isView = kind === 'view';
    await Promise.all([
      this.prisma.event.update({
        where: { id: row.id },
        data: isView
          ? { viewCount: { increment: 1 } }
          : { ticketClicks: { increment: 1 } },
        select: { id: true },
      }),
      this.prisma.eventDailyStat.upsert({
        where: { eventId_day: { eventId: row.id, day } },
        create: {
          eventId: row.id,
          day,
          views: isView ? 1 : 0,
          ticketClicks: isView ? 0 : 1,
        },
        update: isView
          ? { views: { increment: 1 } }
          : { ticketClicks: { increment: 1 } },
        select: { day: true },
      }),
    ]);
    return { ok: true as const, ticketUrl: isView ? undefined : row.ticketUrl };
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
    const and: Prisma.EventWhereInput[] = [];
    const q = filters.q?.trim();
    if (q) {
      and.push({
        OR: [
          { title: { contains: q } },
          { city: { contains: q } },
          { organizer: { contains: q } },
        ],
      });
    }
    if (filters.status === 'DRAFT' || filters.status === 'PUBLISHED') {
      and.push({ status: filters.status });
    }
    if (filters.when === 'upcoming' || filters.when === 'past') {
      const t = this.timeFilter(filters.when);
      if (t) and.push(t);
    }
    const where: Prisma.EventWhereInput = and.length ? { AND: and } : {};

    const [rows, total, published, drafts, upcoming] = await Promise.all([
      this.prisma.event.findMany({
        where,
        orderBy: { startsAt: 'desc' },
        take,
        skip,
        include: EVENT_INCLUDE,
      }),
      this.prisma.event.count({ where }),
      this.prisma.event.count({ where: { status: EventStatus.PUBLISHED } }),
      this.prisma.event.count({ where: { status: EventStatus.DRAFT } }),
      this.prisma.event.count({
        where: {
          AND: [
            { status: EventStatus.PUBLISHED },
            this.timeFilter('upcoming')!,
          ],
        },
      }),
    ]);

    return {
      items: rows.map((row) => this.toAdmin(row)),
      total,
      take,
      skip,
      summary: { total: published + drafts, published, drafts, upcoming },
    };
  }

  async getAdmin(id: string) {
    const row = await this.prisma.event.findUnique({
      where: { id },
      include: EVENT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Événement introuvable');
    return this.toAdmin(row);
  }

  async create(dto: CreateEventDto, actorId: string) {
    const title = dto.title.trim();
    const slug = await this.uniqueSlug(dto.slug?.trim() || this.slugify(title));
    const startsAt = this.parseDate(dto.startsAt, 'startsAt');
    const endsAt = dto.endsAt ? this.parseDate(dto.endsAt, 'endsAt') : null;
    this.assertDates(startsAt, endsAt);
    const status = (dto.status as EventStatus) ?? EventStatus.DRAFT;
    const sponsors = await this.resolveSponsors(dto.sponsors);

    const created = await this.prisma.event.create({
      data: {
        title,
        slug,
        summary: this.text(dto.summary),
        description: this.text(dto.description),
        type: (dto.type as EventType) ?? EventType.CONFERENCE,
        format: (dto.format as EventFormat) ?? EventFormat.IN_PERSON,
        status,
        startsAt,
        endsAt,
        organizer: this.text(dto.organizer),
        organizerLogoKey: this.text(dto.organizerLogoKey),
        organizerLogoBg: dto.organizerLogoKey
          ? this.hex(dto.organizerLogoBg)
          : null,
        coOrganizers: this.normalizeCoOrganizers(dto.coOrganizers),
        city: this.text(dto.city),
        country: this.text(dto.country),
        venueName: this.text(dto.venueName),
        venueAddress: this.text(dto.venueAddress),
        mapUrl: this.url(dto.mapUrl, 'mapUrl'),
        onlineUrl: this.url(dto.onlineUrl, 'onlineUrl'),
        ticketUrl: this.url(dto.ticketUrl, 'ticketUrl'),
        themeColor: this.color(dto.themeColor),
        programme: this.normalizeProgramme(dto.programme),
        speakers: this.normalizeSpeakers(dto.speakers),
        ticketTiers: this.normalizeTiers(dto.ticketTiers),
        publishedAt: status === EventStatus.PUBLISHED ? new Date() : null,
        sponsors: sponsors.length ? { create: sponsors } : undefined,
      },
      include: EVENT_INCLUDE,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'event_created',
      entity: 'event',
      entityId: created.id,
      meta: { title: created.title, status: created.status },
    });

    return this.toAdmin(created);
  }

  async update(id: string, dto: UpdateEventDto, actorId: string) {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        status: true,
        publishedAt: true,
        startsAt: true,
        endsAt: true,
      },
    });
    if (!existing) throw new NotFoundException('Événement introuvable');

    const data: Prisma.EventUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.slug !== undefined) {
      const wanted =
        dto.slug.trim() || this.slugify(dto.title?.trim() || existing.slug);
      if (wanted !== existing.slug) {
        data.slug = await this.uniqueSlug(wanted, id);
      }
    }
    if (dto.summary !== undefined) data.summary = this.text(dto.summary);
    if (dto.description !== undefined) {
      data.description = this.text(dto.description);
    }
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.format !== undefined) data.format = dto.format;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === EventStatus.PUBLISHED && !existing.publishedAt) {
        data.publishedAt = new Date();
      }
    }
    const startsAt =
      dto.startsAt !== undefined
        ? this.parseDate(dto.startsAt, 'startsAt')
        : existing.startsAt;
    const endsAt =
      dto.endsAt !== undefined
        ? dto.endsAt
          ? this.parseDate(dto.endsAt, 'endsAt')
          : null
        : existing.endsAt;
    this.assertDates(startsAt, endsAt);
    if (dto.startsAt !== undefined) data.startsAt = startsAt;
    if (dto.endsAt !== undefined) data.endsAt = endsAt;

    if (dto.organizer !== undefined) data.organizer = this.text(dto.organizer);
    if (dto.organizerLogoKey !== undefined) {
      data.organizerLogoKey = this.text(dto.organizerLogoKey);
      data.organizerLogoBg = data.organizerLogoKey
        ? this.hex(dto.organizerLogoBg)
        : null;
    } else if (dto.organizerLogoBg !== undefined) {
      data.organizerLogoBg = this.hex(dto.organizerLogoBg);
    }
    if (dto.coOrganizers !== undefined) {
      data.coOrganizers = this.normalizeCoOrganizers(dto.coOrganizers);
    }
    if (dto.city !== undefined) data.city = this.text(dto.city);
    if (dto.country !== undefined) data.country = this.text(dto.country);
    if (dto.venueName !== undefined) data.venueName = this.text(dto.venueName);
    if (dto.venueAddress !== undefined) {
      data.venueAddress = this.text(dto.venueAddress);
    }
    if (dto.mapUrl !== undefined) data.mapUrl = this.url(dto.mapUrl, 'mapUrl');
    if (dto.onlineUrl !== undefined) {
      data.onlineUrl = this.url(dto.onlineUrl, 'onlineUrl');
    }
    if (dto.ticketUrl !== undefined) {
      data.ticketUrl = this.url(dto.ticketUrl, 'ticketUrl');
    }
    if (dto.themeColor !== undefined) {
      data.themeColor = this.color(dto.themeColor);
    }
    if (dto.programme !== undefined) {
      data.programme = this.normalizeProgramme(dto.programme);
    }
    if (dto.speakers !== undefined) {
      data.speakers = this.normalizeSpeakers(dto.speakers);
    }
    if (dto.ticketTiers !== undefined) {
      data.ticketTiers = this.normalizeTiers(dto.ticketTiers);
    }

    if (dto.sponsors !== undefined) {
      const sponsors = await this.resolveSponsors(dto.sponsors);
      // D1 : pas de transaction interactive — on remplace la liste en deux temps.
      await this.prisma.eventSponsor.deleteMany({ where: { eventId: id } });
      if (sponsors.length) {
        await this.prisma.eventSponsor.createMany({
          data: sponsors.map((s) => ({ ...s, eventId: id })),
        });
      }
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data,
      include: EVENT_INCLUDE,
    });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'event_updated',
      entity: 'event',
      entityId: id,
      meta: { title: updated.title, status: updated.status },
    });

    return this.toAdmin(updated);
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!existing) throw new NotFoundException('Événement introuvable');
    await this.prisma.eventDailyStat.deleteMany({ where: { eventId: id } });
    await this.prisma.eventSponsor.deleteMany({ where: { eventId: id } });
    await this.prisma.event.delete({ where: { id } });

    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'event_deleted',
      entity: 'event',
      entityId: id,
      meta: { title: existing.title },
    });
    return { ok: true as const };
  }

  async uploadCover(id: string, file: UploadFile, actorId: string) {
    await this.assertExists(id);
    const key = await this.uploadImage(id, 'cover', file);
    const updated = await this.prisma.event.update({
      where: { id },
      data: { coverKey: key },
      include: EVENT_INCLUDE,
    });
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'event_cover_uploaded',
      entity: 'event',
      entityId: id,
      meta: { coverKey: key, size: file.size },
    });
    return this.toAdmin(updated);
  }

  /** Image libre (photo intervenant…) — renvoie la clé à stocker dans le JSON. */
  async uploadImageForEvent(id: string, file: UploadFile, actorId: string) {
    await this.assertExists(id);
    const key = await this.uploadImage(id, 'media', file);
    // Couleur de fond (logos organisateurs) — ignorée pour les autres images.
    const bg = await detectLogoBackground(file.buffer);
    void this.activity.log({
      actorType: ActivityActorType.ADMIN,
      adminId: actorId,
      action: 'event_image_uploaded',
      entity: 'event',
      entityId: id,
      meta: { key, size: file.size },
    });
    return { key, url: this.mediaUrl(key), bg };
  }

  /** Visibilité : totaux, top événements et série quotidienne (30 j). */
  async stats(eventId?: string) {
    const since = new Date(Date.now() - (STATS_DAYS - 1) * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const [daily, events] = await Promise.all([
      this.prisma.eventDailyStat.findMany({
        where: { day: { gte: since }, ...(eventId ? { eventId } : {}) },
        select: { day: true, views: true, ticketClicks: true },
      }),
      this.prisma.event.findMany({
        where: eventId ? { id: eventId } : {},
        orderBy: { viewCount: 'desc' },
        take: eventId ? 1 : 50,
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          startsAt: true,
          city: true,
          viewCount: true,
          ticketClicks: true,
          ticketUrl: true,
        },
      }),
    ]);

    const byDay = new Map<string, { views: number; ticketClicks: number }>();
    for (const row of daily) {
      const cur = byDay.get(row.day) ?? { views: 0, ticketClicks: 0 };
      cur.views += row.views;
      cur.ticketClicks += row.ticketClicks;
      byDay.set(row.day, cur);
    }
    const series: { day: string; views: number; ticketClicks: number }[] = [];
    for (let i = STATS_DAYS - 1; i >= 0; i--) {
      const day = new Date(Date.now() - i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      series.push({
        day,
        ...(byDay.get(day) ?? { views: 0, ticketClicks: 0 }),
      });
    }

    const totals = await this.prisma.event.aggregate({
      where: eventId ? { id: eventId } : {},
      _sum: { viewCount: true, ticketClicks: true },
    });

    return {
      totals: {
        views: totals._sum.viewCount ?? 0,
        ticketClicks: totals._sum.ticketClicks ?? 0,
        views30d: series.reduce((n, d) => n + d.views, 0),
        ticketClicks30d: series.reduce((n, d) => n + d.ticketClicks, 0),
      },
      series,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        status: e.status,
        startsAt: e.startsAt.toISOString(),
        city: e.city,
        views: e.viewCount,
        ticketClicks: e.ticketClicks,
        hasTicketing: Boolean(e.ticketUrl),
        clickRate:
          e.viewCount > 0
            ? Math.round((e.ticketClicks / e.viewCount) * 1000) / 10
            : 0,
      })),
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Filtres ville / format communs à la liste et au calendrier publics. */
  private async publicFilters(query: {
    city?: string;
    format?: string;
  }): Promise<Prisma.EventWhereInput[]> {
    const and: Prisma.EventWhereInput[] = [];
    const city = query.city?.trim();
    if (city) and.push({ city: { in: await this.resolveCity(city) } });
    if (query.format === 'IN_PERSON') {
      and.push({ format: { in: [EventFormat.IN_PERSON, EventFormat.HYBRID] } });
    } else if (query.format === 'ONLINE') {
      and.push({ format: { in: [EventFormat.ONLINE, EventFormat.HYBRID] } });
    } else if (query.format === 'HYBRID') {
      and.push({ format: EventFormat.HYBRID });
    }
    return and;
  }

  /**
   * Ville de l’URL (« kinshasa », « Kinshasa ») → noms exacts en base qui
   * ont le même slug. Sans correspondance : la valeur telle quelle (0 résultat).
   */
  private async resolveCity(input: string): Promise<string[]> {
    const slug = this.slugify(input);
    const rows = await this.prisma.event.findMany({
      where: { status: EventStatus.PUBLISHED, city: { not: null } },
      select: { city: true },
      distinct: ['city'],
    });
    const matches = rows
      .map((r) => r.city)
      .filter((c): c is string => !!c && this.slugify(c) === slug);
    return matches.length ? matches : [input];
  }

  /** Événements qui chevauchent [start, end[ (sans fin = jour de début). */
  private overlaps(start: Date, end: Date): Prisma.EventWhereInput {
    return {
      startsAt: { lt: end },
      OR: [
        { endsAt: { gte: start } },
        { AND: [{ endsAt: null }, { startsAt: { gte: start } }] },
      ],
    };
  }

  /** Bornes UTC d’un jour civil à Kinshasa (UTC+1, sans heure d’été). */
  private dayRange(ymd: string): { start: Date; end: Date } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) return null;
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3]) - EVENT_TZ_OFFSET_MS;
    if (Number.isNaN(t)) return null;
    return { start: new Date(t), end: new Date(t + DAY_MS) };
  }

  private dayStartOf(d: Date): number {
    const local = d.getTime() + EVENT_TZ_OFFSET_MS;
    return local - (((local % DAY_MS) + DAY_MS) % DAY_MS) - EVENT_TZ_OFFSET_MS;
  }

  private dayKey(utcDayStart: number): string {
    return new Date(utcDayStart + EVENT_TZ_OFFSET_MS)
      .toISOString()
      .slice(0, 10);
  }

  /** À venir = pas encore terminé ; passé = terminé. */
  private timeFilter(when: string): Prisma.EventWhereInput | null {
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    if (when === 'upcoming') {
      return {
        OR: [
          { endsAt: { gte: now } },
          { AND: [{ endsAt: null }, { startsAt: { gte: startOfDay } }] },
        ],
      };
    }
    if (when === 'past') {
      return {
        OR: [
          { endsAt: { lt: now } },
          { AND: [{ endsAt: null }, { startsAt: { lt: startOfDay } }] },
        ],
      };
    }
    return null;
  }

  private async assertExists(id: string) {
    const row = await this.prisma.event.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Événement introuvable');
  }

  private async resolveSponsors(
    links: CreateEventDto['sponsors'],
  ): Promise<{ sponsorId: string; tier: string | null; position: number }[]> {
    if (!links?.length) return [];
    const seen = new Set<string>();
    const unique = links.filter((l) => {
      if (seen.has(l.sponsorId)) return false;
      seen.add(l.sponsorId);
      return true;
    });
    const found = await this.prisma.sponsor.findMany({
      where: { id: { in: unique.map((l) => l.sponsorId) } },
      select: { id: true },
    });
    const ok = new Set(found.map((s) => s.id));
    const missing = unique.find((l) => !ok.has(l.sponsorId));
    if (missing) throw new BadRequestException('Sponsor introuvable');
    return unique.map((l, position) => ({
      sponsorId: l.sponsorId,
      tier: this.text(l.tier),
      position,
    }));
  }

  private normalizeProgramme(
    items: EventProgrammeItemDto[] | undefined,
  ): EventProgrammeItem[] {
    return (items ?? [])
      .map((item) => ({
        day: this.text(item.day),
        time: item.time.trim(),
        endTime: this.text(item.endTime),
        title: item.title.trim(),
        description: this.text(item.description),
        speakers: (item.speakers ?? []).map((s) => s.trim()).filter(Boolean),
      }))
      .sort((a, b) =>
        `${a.day ?? ''}${a.time}`.localeCompare(`${b.day ?? ''}${b.time}`),
      );
  }

  private normalizeSpeakers(
    items: EventSpeakerDto[] | undefined,
  ): EventSpeaker[] {
    return (items ?? []).map((s) => ({
      id: s.id?.trim() || randomBytes(6).toString('hex'),
      name: s.name.trim(),
      role: this.text(s.role),
      organization: this.text(s.organization),
      photoKey: this.text(s.photoKey),
      bio: this.text(s.bio),
    }));
  }

  private normalizeCoOrganizers(
    items: EventCoOrganizerDto[] | undefined,
  ): EventCoOrganizer[] {
    return (items ?? []).map((o) => ({
      id: o.id?.trim() || randomBytes(6).toString('hex'),
      name: o.name.trim(),
      logoKey: this.text(o.logoKey),
      logoBg: this.text(o.logoKey) ? this.hex(o.logoBg) : null,
      url: this.url(o.url, 'coOrganizers.url'),
    }));
  }

  private hex(raw: string | null | undefined): string | null {
    const v = raw?.trim().toLowerCase();
    return v && /^#[0-9a-f]{6}$/.test(v) ? v : null;
  }

  private normalizeTiers(
    items: EventTicketTierDto[] | undefined,
  ): EventTicketTier[] {
    return (items ?? []).map((t) => {
      const seen = new Set<string>();
      const prices = t.prices
        .filter((p) => {
          if (seen.has(p.currency)) return false;
          seen.add(p.currency);
          return true;
        })
        .map((p) => ({
          currency: p.currency,
          amount: Math.round(Number(p.amount) * 100) / 100,
        }));
      return {
        id: t.id?.trim() || randomBytes(6).toString('hex'),
        name: t.name.trim(),
        description: this.text(t.description),
        prices,
      };
    });
  }

  /** #RRGGBB normalisé en minuscules ; vide / invalide → null. */
  private color(value: string | null | undefined): string | null {
    const v = value?.trim();
    return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null;
  }

  private asArray<T>(value: Prisma.JsonValue | null): T[] {
    return Array.isArray(value) ? (value as unknown as T[]) : [];
  }

  private toCard(row: EventRow) {
    const tiers = this.asArray<EventTicketTier>(row.ticketTiers);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      type: row.type,
      format: row.format,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      city: row.city,
      country: row.country,
      venueName: row.venueName,
      coverUrl: this.mediaUrl(row.coverKey),
      hasTicketing: Boolean(row.ticketUrl),
      isFree:
        tiers.length > 0 &&
        tiers.every((t) => t.prices.every((p) => p.amount === 0)),
      minPrices: this.minPrices(tiers),
      hasFreeTier: tiers.some((t) => t.prices.some((p) => p.amount === 0)),
      sponsorsCount: row.sponsors.length,
    };
  }

  private toDetail(row: EventRow) {
    return {
      ...this.toCard(row),
      description: row.description,
      organizer: row.organizer,
      organizerLogoUrl: this.mediaUrl(row.organizerLogoKey),
      organizerLogoBg: row.organizerLogoBg,
      coOrganizers: this.asArray<EventCoOrganizer>(row.coOrganizers).map(
        (o) => ({
          ...o,
          logoUrl: this.mediaUrl(o.logoKey),
        }),
      ),
      venueAddress: row.venueAddress,
      mapUrl: row.mapUrl,
      onlineUrl: row.onlineUrl,
      ticketUrl: row.ticketUrl,
      themeColor: row.themeColor,
      programme: this.asArray<EventProgrammeItem>(row.programme),
      speakers: this.asArray<EventSpeaker>(row.speakers).map((s) => ({
        ...s,
        photoUrl: this.mediaUrl(s.photoKey),
      })),
      ticketTiers: this.asArray<EventTicketTier>(row.ticketTiers),
      sponsors: row.sponsors.map((link) => ({
        id: link.sponsor.id,
        name: link.sponsor.name,
        url: link.sponsor.url,
        logoUrl: this.mediaUrl(link.sponsor.logoKey),
        tier: link.tier,
      })),
    };
  }

  private toAdmin(row: EventRow) {
    return {
      ...this.toDetail(row),
      status: row.status,
      coverKey: row.coverKey,
      organizerLogoKey: row.organizerLogoKey,
      viewCount: row.viewCount,
      ticketClicks: row.ticketClicks,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Plus petit prix payant par devise (pour « Dès … »). */
  private minPrices(tiers: EventTicketTier[]) {
    const min = new Map<string, number>();
    for (const t of tiers) {
      for (const p of t.prices) {
        if (p.amount <= 0) continue;
        const cur = min.get(p.currency);
        if (cur === undefined || p.amount < cur) min.set(p.currency, p.amount);
      }
    }
    return [...min.entries()].map(([currency, amount]) => ({
      currency,
      amount,
    }));
  }

  private text(raw: string | null | undefined): string | null {
    if (raw === undefined || raw === null) return null;
    const trimmed = raw.trim();
    return trimmed || null;
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

  private parseDate(raw: string, field: string): Date {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Date invalide (${field})`);
    }
    return d;
  }

  private assertDates(startsAt: Date, endsAt: Date | null) {
    if (endsAt && endsAt.getTime() < startsAt.getTime()) {
      throw new BadRequestException('La fin doit être après le début');
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
        .slice(0, 200) || 'evenement'
    );
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = this.slugify(base);
    let candidate = root;
    for (let i = 2; i < 200; i++) {
      const hit = await this.prisma.event.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!hit || hit.id === excludeId) return candidate;
      candidate = `${root}-${i}`;
    }
    return `${root}-${randomBytes(3).toString('hex')}`;
  }

  private async uploadImage(
    id: string,
    folder: 'cover' | 'media',
    file: UploadFile,
  ): Promise<string> {
    if (!file?.buffer?.length)
      throw new BadRequestException('Aucun fichier reçu');
    if (file.size > 8_000_000) {
      throw new BadRequestException('L’image dépasse 8 Mo');
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
    const key = `events/${id}/${folder}/${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
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
