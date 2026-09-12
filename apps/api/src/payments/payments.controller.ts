import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateFlexpaieDto,
  CreateFlexpaiePurchaseDto,
} from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('flexpaie/create')
  createFlexpaie(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFlexpaieDto,
  ) {
    return this.payments.createFlexpaiePayment(user.id, dto.planId, dto.phone);
  }

  @UseGuards(JwtAuthGuard)
  @Post('flexpaie/purchase')
  createFlexpaiePurchase(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFlexpaiePurchaseDto,
  ) {
    return this.payments.createFlexpaiePurchase(
      user.id,
      dto.magazineId,
      dto.phone,
    );
  }

  @Post('flexpaie/callback')
  flexpaieCallback(@Body() body: Record<string, unknown>) {
    return this.payments.handleFlexpaieCallback(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  status(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.getStatus(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/check')
  checkFlexpaie(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.checkFlexpaieStatus(id, user.id);
  }
}
