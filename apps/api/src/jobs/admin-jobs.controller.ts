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
import {
  CreateJobDto,
  UpdateJobCompanyDto,
  UpdateJobDto,
} from './dto/admin-job.dto';
import { JobsService } from './jobs.service';

type UploadedMemFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller('admin/jobs')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminJobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('when') when?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.jobs.listAdmin({
      q,
      status,
      when,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  /** Déclaré avant `:id` pour ne pas être capturé comme identifiant. */
  @Get('companies')
  companies() {
    return this.jobs.companies();
  }

  @Patch('companies/:id')
  updateCompany(
    @Param('id') id: string,
    @Body() dto: UpdateJobCompanyDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.jobs.updateCompany(id, dto, actor.id);
  }

  @Post('companies/:id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4_000_000 },
    }),
  )
  uploadCompanyLogo(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.jobs.uploadCompanyLogo(id, file, actor.id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.jobs.getAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateJobDto, @CurrentAdmin() actor: AdminAuthUser) {
    return this.jobs.create(dto, actor.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.jobs.update(id, dto, actor.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() actor: AdminAuthUser) {
    return this.jobs.remove(id, actor.id);
  }

  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4_000_000 },
    }),
  )
  uploadLogo(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.jobs.uploadLogo(id, file, actor.id);
  }
}
