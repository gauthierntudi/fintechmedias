import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import type { SendContactDto } from './dto/send-contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async send(dto: SendContactDto) {
    const name = dto.name.trim();
    const email = dto.email.trim();
    const subject = dto.subject.trim();
    const message = dto.message.trim();

    const row = await this.prisma.contactMessage.create({
      data: { name, email, subject, message },
    });

    try {
      const dest = await this.settings.getContact();
      await this.mail.sendContactMessage({
        name,
        email,
        subject,
        message,
        to: dest.email,
      });
    } catch (err) {
      this.logger.warn(
        `Message ${row.id} enregistré, e-mail non envoyé: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { ok: true, message: 'Votre message a bien été envoyé.' };
  }

  async list(opts: {
    q?: string;
    read?: string;
    take?: number;
    skip?: number;
  }) {
    const take = Math.min(Math.max(opts.take ?? 20, 1), 100);
    const skip = Math.max(opts.skip ?? 0, 0);
    const q = opts.q?.trim();

    const where: Prisma.ContactMessageWhereInput = {
      ...(opts.read === '1'
        ? { isRead: true }
        : opts.read === '0'
          ? { isRead: false }
          : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { subject: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, unread, items] = await this.prisma.$transaction([
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.count({ where: { isRead: false } }),
      this.prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
    ]);

    return {
      items: items.map((row) => this.toPublic(row)),
      total,
      take,
      skip,
      summary: { total, unread },
    };
  }

  async get(id: string) {
    const row = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Message introuvable');
    return this.toPublic(row);
  }

  async setRead(id: string, isRead: boolean) {
    const row = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Message introuvable');
    const updated = await this.prisma.contactMessage.update({
      where: { id },
      data: { isRead },
    });
    return this.toPublic(updated);
  }

  private toPublic(row: {
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    isRead: boolean;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      isRead: row.isRead,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
