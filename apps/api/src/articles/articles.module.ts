import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { NewsletterModule } from '../newsletter/newsletter.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminArticlesController } from './admin-articles.controller';
import { ArticlesService } from './articles.service';
import { PublicArticlesController } from './public-articles.controller';

@Module({
  imports: [PrismaModule, ActivityModule, AuthModule, NewsletterModule],
  controllers: [AdminArticlesController, PublicArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
