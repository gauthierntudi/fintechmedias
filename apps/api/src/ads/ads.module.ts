import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAdsController } from './admin-ads.controller';
import { AdminAdsService } from './admin-ads.service';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [AuthModule, ActivityModule],
  controllers: [AdsController, AdminAdsController],
  providers: [AdsService, AdminAdsService],
})
export class AdsModule {}
