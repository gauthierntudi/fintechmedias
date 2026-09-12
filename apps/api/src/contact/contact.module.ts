import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminContactController } from './admin-contact.controller';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [AuthModule, MailModule, PrismaModule, SettingsModule],
  controllers: [ContactController, AdminContactController],
  providers: [ContactService],
})
export class ContactModule {}
