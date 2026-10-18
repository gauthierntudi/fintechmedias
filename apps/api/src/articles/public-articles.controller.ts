import { Controller, Get, Header, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { ArticlesService } from './articles.service';

@Controller('articles')
export class PublicArticlesController {
  constructor(
    private readonly articles: ArticlesService,
    private readonly jwt: JwtService,
  ) {}

  @Get('home')
  @Header('Cache-Control', 'no-store')
  home() {
    return this.articles.getHomeFeed();
  }

  @Get('recent')
  recent(@Query('take') take?: string) {
    const n = take ? Number(take) : 3;
    return this.articles.listRecentPublished(Number.isFinite(n) ? n : 3);
  }

  @Get('random')
  random(@Query('take') take?: string) {
    const n = take ? Number(take) : 10;
    return this.articles.listRandomPublished(Number.isFinite(n) ? n : 10);
  }

  @Get('related')
  related(
    @Query('slug') slug?: string,
    @Query('take') take?: string,
  ) {
    const n = take ? Number(take) : 6;
    return this.articles.listRelatedPublished(
      slug?.trim() || '',
      Number.isFinite(n) ? n : 6,
    );
  }

  @Get('search')
  search(
    @Query('q') q?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('category') category?: string,
  ) {
    const n = take ? Number(take) : 10;
    const s = skip ? Number(skip) : 0;
    return this.articles.searchPublished(
      q ?? '',
      Number.isFinite(n) ? n : 10,
      category,
      Number.isFinite(s) ? s : 0,
    );
  }

  @Get('most-read')
  mostRead(@Query('take') take?: string) {
    const n = take ? Number(take) : 5;
    return this.articles.listMostReadPublished(Number.isFinite(n) ? n : 5);
  }

  @Get('feed')
  feed(@Query('take') take?: string, @Query('skip') skip?: string) {
    const t = take ? Number(take) : 12;
    const s = skip ? Number(skip) : 0;
    return this.articles.listPublishedFeed(
      Number.isFinite(t) ? t : 12,
      Number.isFinite(s) ? s : 0,
    );
  }

  @Get('category/:slug')
  byCategory(
    @Param('slug') slug: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const t = take ? Number(take) : 12;
    const s = skip ? Number(skip) : 0;
    return this.articles.listByCategory(
      slug,
      Number.isFinite(t) ? t : 12,
      Number.isFinite(s) ? s : 0,
    );
  }

  @Get('legacy/:legacyId')
  byLegacyId(@Param('legacyId') legacyId: string) {
    return this.articles.getPublishedSlugByLegacyId(legacyId);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  bySlug(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | null,
    @Req() req: Request & { cookies?: Record<string, string> },
  ) {
    return this.articles.getPublishedBySlug(slug, {
      subscriberId: user?.type === 'subscriber' ? user.id : null,
      staff: this.isStaff(req),
    });
  }

  private isStaff(req: Request & { cookies?: Record<string, string> }) {
    const token = req.cookies?.admin_access_token;
    if (!token) return false;
    try {
      const payload = this.jwt.verify<{ type?: string; sub?: string }>(token);
      return payload.type === 'admin' && Boolean(payload.sub);
    } catch {
      return false;
    }
  }
}
