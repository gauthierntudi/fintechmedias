import { Controller, Get, Query } from '@nestjs/common';
import { AdsService } from './ads.service';

@Controller('ads')
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Get()
  async pick(
    @Query('format') format?: string,
    @Query('emplacement') emplacement?: string,
    @Query('exclude') exclude?: string,
  ) {
    const skipped = (exclude ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const ad = await this.ads.pick(format ?? '', emplacement ?? '', skipped);
    return { ad };
  }
}
