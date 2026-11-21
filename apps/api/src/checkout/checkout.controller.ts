import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCheckoutDto, PayCheckoutDto } from './checkout.dto';
import { CheckoutService } from './checkout.service';

/**
 * Paiement hors de l’app : l’app (ou le site) crée une session, puis
 * l’abonné la règle sur la page web /paiement/<id>. Les routes publiques
 * ne demandent pas de connexion : l’identifiant aléatoire fait foi.
 */
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.checkout.create(user.id, dto);
  }

  @Get(':id')
  view(@Param('id') id: string) {
    return this.checkout.view(id);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 6, ttl: 600_000 } })
  @Post(':id/pay')
  pay(@Param('id') id: string, @Body() dto: PayCheckoutDto) {
    return this.checkout.pay(id, dto.phone);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post(':id/check')
  check(@Param('id') id: string) {
    return this.checkout.check(id);
  }
}
