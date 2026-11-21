import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AdminAuthUser } from '../auth/strategies/jwt-admin.strategy';
import {
  CreateStatusOfferDto,
  UpdateStatusOfferDto,
} from './dto/admin-status.dto';
import { StatusOffersService } from './status-offers.service';

/** Tarifs des statuts abonnés + forfaits vendus (pricing : admins seulement). */
@Controller('admin/status-offers')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
export class AdminStatusOffersController {
  constructor(private readonly offers: StatusOffersService) {}

  @Get()
  list() {
    return this.offers.listAll();
  }

  @Get('passes')
  passes(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.offers.listPasses({
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Post()
  create(
    @Body() dto: CreateStatusOfferDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.offers.create(dto, actor.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStatusOfferDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.offers.update(id, dto, actor.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() actor: AdminAuthUser) {
    return this.offers.remove(id, actor.id);
  }
}
