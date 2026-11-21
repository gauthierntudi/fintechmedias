import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ArticlesModule } from '../articles/articles.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminStatusOffersController } from './admin-status-offers.controller';
import { AdminStatusesController } from './admin-statuses.controller';
import { MyStatusesController } from './my-statuses.controller';
import { PublicStatusesController } from './public-statuses.controller';
import { StatusOffersService } from './status-offers.service';
import { StatusesService } from './statuses.service';

@Module({
  imports: [
    PrismaModule,
    ActivityModule,
    AuthModule,
    ArticlesModule,
    PaymentsModule,
  ],
  controllers: [
    AdminStatusOffersController,
    AdminStatusesController,
    MyStatusesController,
    PublicStatusesController,
  ],
  providers: [StatusesService, StatusOffersService],
})
export class StatusesModule {}
