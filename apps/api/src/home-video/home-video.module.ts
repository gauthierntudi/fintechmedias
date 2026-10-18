import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminHomeVideoController } from './admin-home-video.controller';
import { HomeVideoController } from './home-video.controller';
import { HomeVideoService } from './home-video.service';

@Module({
  imports: [AuthModule],
  controllers: [HomeVideoController, AdminHomeVideoController],
  providers: [HomeVideoService],
  exports: [HomeVideoService],
})
export class HomeVideoModule {}
