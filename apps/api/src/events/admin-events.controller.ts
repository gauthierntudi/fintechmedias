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
import { CreateEventDto, UpdateEventDto } from './dto/admin-event.dto';
import { EventsService } from './events.service';

type UploadedMemFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const IMAGE_UPLOAD = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 8_000_000 },
});

@Controller('admin/events')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('when') when?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.events.listAdmin({
      q,
      status,
      when,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  /** Déclaré avant `:id` pour ne pas être capturé comme identifiant. */
  @Get('stats')
  stats(@Query('eventId') eventId?: string) {
    return this.events.stats(eventId?.trim() || undefined);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.events.getAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateEventDto, @CurrentAdmin() actor: AdminAuthUser) {
    return this.events.create(dto, actor.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentAdmin() actor: AdminAuthUser,
  ) {
    return this.events.update(id, dto, actor.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentAdmin() actor: AdminAuthUser) {
    return this.events.remove(id, actor.id);
  }

  @Post(':id/cover')
  @UseInterceptors(IMAGE_UPLOAD)
  uploadCover(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.events.uploadCover(id, file, actor.id);
  }

  /** Photo d’intervenant ou autre visuel — renvoie { key, url }. */
  @Post(':id/image')
  @UseInterceptors(IMAGE_UPLOAD)
  uploadImage(
    @Param('id') id: string,
    @CurrentAdmin() actor: AdminAuthUser,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.events.uploadImageForEvent(id, file, actor.id);
  }
}
