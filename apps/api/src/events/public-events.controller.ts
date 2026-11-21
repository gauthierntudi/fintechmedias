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
import { EventDaysQueryDto, ListEventsQueryDto } from './dto/admin-event.dto';
import { EventsService } from './events.service';

@Controller('events')
export class PublicEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@Query() query: ListEventsQueryDto) {
    return this.events.listPublic(query);
  }

  /** Jours ayant des événements — alimente la barre-semaine de l’agenda. */
  @Get('days')
  days(@Query() query: EventDaysQueryDto) {
    return this.events.listPublicDays(query);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.events.getPublicBySlug(slug);
  }

  /** Appelé une fois par affichage de la fiche (côté navigateur). */
  @Post(':slug/view')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  view(@Param('slug') slug: string) {
    return this.events.trackView(slug);
  }

  /** Clic « Billetterie » — compte le clic et renvoie l’URL externe. */
  @Post(':slug/ticket-click')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  ticketClick(@Param('slug') slug: string) {
    return this.events.trackTicketClick(slug);
  }
}
