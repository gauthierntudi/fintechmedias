import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdDiffusionStatus, AdFormat, AdValidationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatSlug, publicFormat } from './ad-catalog';

type Row = {
  id: string;
  legacyId: number | null;
  title: string;
  imageKey: string;
  targetUrl: string;
  format: AdFormat;
  isLocked: boolean;
};

@Injectable()
export class AdsService {
  private cache = new Map<string, { at: number; rows: Row[] }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  clearCache() {
    this.cache.clear();
  }

  async pick(formatRaw: string, placeRaw: string, exclude: string[]) {
    const format = publicFormat(formatRaw);
    const place = placeRaw.trim();
    if (!format || !place) return null;

    const rows = await this.candidates(format, place);
    if (rows.length === 0) return null;

    const locked = rows.find((row) => row.isLocked);
    if (locked) return this.view(locked);

    const skipped = new Set(exclude);
    const fresh = rows.filter(
      (row) => !skipped.has(row.id) && !skipped.has(String(row.legacyId ?? '')),
    );
    const pool = fresh.length > 0 ? fresh : rows;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return chosen ? this.view(chosen) : null;
  }

  private view(row: Row) {
    return {
      id: row.legacyId ?? row.id,
      title: row.title,
      imageUrl: this.imageUrl(row.imageKey),
      href: row.targetUrl || '#',
      format: formatSlug(row.format),
    };
  }

  private async candidates(
    format: NonNullable<ReturnType<typeof publicFormat>>,
    place: string,
  ): Promise<Row[]> {
    const key = `${format}:${place}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < 20_000) return hit.rows;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const found = await this.prisma.advertisement.findMany({
      where: {
        validationStatus: AdValidationStatus.APPROVED,
        diffusionStatus: AdDiffusionStatus.ACTIVE,
        format,
        placement: place,
        startsOn: { lte: today },
        endsOn: { gte: today },
      },
      select: {
        id: true,
        legacyId: true,
        title: true,
        imageKey: true,
        targetUrl: true,
        format: true,
        isLocked: true,
      },
    });

    const rows = found.filter((row) => this.imageUrl(row.imageKey));
    this.cache.set(key, { at: Date.now(), rows });
    return rows;
  }

  imageUrl(raw: string) {
    const value = raw.trim();
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    const path = value.replace(/^\/publication\//, '').replace(/^\//, '');
    const cdn = (
      this.config.get<string>('R2_PUBLIC_URL') ||
      this.config.get<string>('R2_URL') ||
      ''
    ).replace(/\/$/, '');
    if (cdn) return `${cdn}/${path}`;
    if (path.startsWith('uploads/')) return `/${path}`;
    return `/publication/${path}`;
  }
}
