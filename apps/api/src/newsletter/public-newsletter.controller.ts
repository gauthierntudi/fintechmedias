import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class PublicNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  subscribe(@Body() dto: SubscribeNewsletterDto) {
    return this.newsletter.subscribe(dto);
  }

  @Get('unsubscribe')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unsubscribe(@Query('token') token?: string) {
    return this.newsletter.unsubscribeByToken(token ?? '');
  }

  @Post('unsubscribe')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unsubscribePost(
    @Query('token') token?: string,
    @Body() body?: { token?: string },
  ) {
    return this.newsletter.unsubscribeByToken(token || body?.token || '');
  }
}
