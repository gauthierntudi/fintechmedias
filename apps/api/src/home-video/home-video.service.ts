import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateHomeVideoDto, UpsertHomeVideoDto } from './dto/home-video.dto';

@Injectable()
export class HomeVideoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vidéo active pour l’accueil (la plus récente). */
  async getActive() {
    const row = await this.prisma.homeVideo.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return row ? this.toPublic(row) : null;
  }

  async list() {
    const items = await this.prisma.homeVideo.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { items: items.map((row) => this.toAdmin(row)), total: items.length };
  }

  async create(dto: UpsertHomeVideoDto) {
    const youtubeId = this.normalizeYoutubeId(dto.youtubeId);
    const row = await this.prisma.homeVideo.create({
      data: {
        youtubeId,
        title: dto.title.trim(),
        subtitle: (dto.subtitle ?? '').trim(),
        websiteUrl: this.normalizeUrl(dto.websiteUrl),
        isActive: dto.isActive ?? true,
      },
    });
    return this.toAdmin(row);
  }

  async update(id: string, dto: UpdateHomeVideoDto) {
    await this.assertExists(id);
    const row = await this.prisma.homeVideo.update({
      where: { id },
      data: {
        ...(dto.youtubeId !== undefined
          ? { youtubeId: this.normalizeYoutubeId(dto.youtubeId) }
          : {}),
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.subtitle !== undefined
          ? { subtitle: dto.subtitle.trim() }
          : {}),
        ...(dto.websiteUrl !== undefined
          ? { websiteUrl: this.normalizeUrl(dto.websiteUrl) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toAdmin(row);
  }

  async toggle(id: string) {
    const current = await this.assertExists(id);
    const row = await this.prisma.homeVideo.update({
      where: { id },
      data: { isActive: !current.isActive },
    });
    return this.toAdmin(row);
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.homeVideo.delete({ where: { id } });
    return { ok: true };
  }

  private async assertExists(id: string) {
    const row = await this.prisma.homeVideo.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Vidéo introuvable');
    return row;
  }

  private normalizeYoutubeId(raw: string): string {
    const value = raw.trim();
    const fromUrl = value.match(
      /(?:youtube\.com\/(?:watch\?(?:[^"'&\s]+&)*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i,
    );
    const id = (fromUrl?.[1] ?? value).trim();
    if (!/^[\w-]{6,20}$/.test(id)) {
      throw new BadRequestException(
        'Identifiant YouTube invalide (ex. 8lJ9J3cRb9A ou URL complète)',
      );
    }
    return id;
  }

  private normalizeUrl(raw?: string | null): string | null {
    if (raw == null) return null;
    const value = raw.trim();
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value.slice(0, 500);
    return `https://${value}`.slice(0, 500);
  }

  private toPublic(row: {
    id: string;
    youtubeId: string;
    title: string;
    subtitle: string;
    websiteUrl: string | null;
  }) {
    return {
      id: row.id,
      youtubeId: row.youtubeId,
      title: row.title,
      subtitle: row.subtitle,
      websiteUrl: row.websiteUrl,
      embedUrl: `https://www.youtube.com/embed/${row.youtubeId}`,
    };
  }

  private toAdmin(
    row: {
      id: string;
      legacyId: number | null;
      youtubeId: string;
      title: string;
      subtitle: string;
      websiteUrl: string | null;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
  ) {
    return {
      ...this.toPublic(row),
      legacyId: row.legacyId,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
