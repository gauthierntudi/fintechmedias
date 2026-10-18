import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import { CurrentAdmin } from '../auth/decorators/current-admin.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AdminAuthUser } from '../auth/strategies/jwt-admin.strategy';
import { AdminAdsService } from './admin-ads.service';
import {
  CreateAdDto,
  RefuseAdDto,
  UpdateAdDto,
  UpdateAdRateDto,
} from './dto/admin-ad.dto';

type UploadedMemFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('admin/ads')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
export class AdminAdsController {
  constructor(private readonly ads: AdminAdsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('validation') validation?: string,
    @Query('payment') payment?: string,
    @Query('diffusion') diffusion?: string,
    @Query('placement') placement?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.ads.list({
      q,
      validation,
      payment,
      diffusion,
      placement,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get('rates')
  rates() {
    return this.ads.rates();
  }

  @Patch('rates/:id')
  updateRate(
    @Param('id') id: string,
    @Body() dto: UpdateAdRateDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.ads.updateRate(id, dto, actor.id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.ads.getById(id);
  }

  @Post()
  create(@Body() dto: CreateAdDto, @CurrentAdmin() actor: AdminAuthUser) {
    return this.ads.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.ads.update(id, dto, actor);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8_000_000 },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.ads.uploadImage(id, file, actor.id);
  }

  @Post(':id/validate')
  validate(@Param('id') id: string, @CurrentAdmin() actor: AdminAuthUser) {
    return this.ads.validate(id, actor.id);
  }

  @Post(':id/refuse')
  refuse(
    @Param('id') id: string,
    @Body() dto: RefuseAdDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.ads.refuse(id, dto, actor.id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentAdmin() actor: AdminAuthUser) {
    return this.ads.setDiffusion(id, true, actor.id);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentAdmin() actor: AdminAuthUser) {
    return this.ads.setDiffusion(id, false, actor.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() actor: AdminAuthUser) {
    return this.ads.remove(id, actor.id);
  }
}
