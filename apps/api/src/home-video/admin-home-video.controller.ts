import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateHomeVideoDto, UpsertHomeVideoDto } from './dto/home-video.dto';
import { HomeVideoService } from './home-video.service';

@Controller('admin/home-videos')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN, AdminRole.EDITOR)
export class AdminHomeVideoController {
  constructor(private readonly homeVideo: HomeVideoService) {}

  @Get()
  list() {
    return this.homeVideo.list();
  }

  @Post()
  create(@Body() dto: UpsertHomeVideoDto) {
    return this.homeVideo.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHomeVideoDto) {
    return this.homeVideo.update(id, dto);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.homeVideo.toggle(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.homeVideo.remove(id);
  }
}
