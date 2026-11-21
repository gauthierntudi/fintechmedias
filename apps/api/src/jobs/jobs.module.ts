import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminJobsController } from './admin-jobs.controller';
import { JobsService } from './jobs.service';
import { PublicJobsController } from './public-jobs.controller';

@Module({
  imports: [PrismaModule, ActivityModule, AuthModule],
  controllers: [PublicJobsController, AdminJobsController],
  providers: [JobsService],
})
export class JobsModule {}
