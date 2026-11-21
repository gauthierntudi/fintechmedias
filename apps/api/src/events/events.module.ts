import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminEventsController } from './admin-events.controller';
import { EventsService } from './events.service';
import { PublicEventsController } from './public-events.controller';

@Module({
  imports: [PrismaModule, ActivityModule, AuthModule],
  controllers: [PublicEventsController, AdminEventsController],
  providers: [EventsService],
})
export class EventsModule {}
