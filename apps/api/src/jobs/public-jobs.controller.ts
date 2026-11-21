import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ListJobsQueryDto } from './dto/admin-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class PublicJobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@Query() query: ListJobsQueryDto) {
    return this.jobs.listPublic(query);
  }

  /** Annuaire des entreprises fintech qui recrutent. */
  @Get('companies')
  companies() {
    return this.jobs.publicCompanies();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.jobs.getPublicBySlug(slug);
  }

  /** Appelé une fois par affichage de la fiche (côté navigateur). */
  @Post(':slug/view')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  view(@Param('slug') slug: string) {
    return this.jobs.trackView(slug);
  }

  /** Clic « Postuler » vers le formulaire externe. */
  @Post(':slug/apply-click')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  applyClick(@Param('slug') slug: string) {
    return this.jobs.trackApplyClick(slug);
  }
}
