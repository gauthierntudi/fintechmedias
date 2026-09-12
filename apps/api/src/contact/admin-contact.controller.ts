import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ContactService } from './contact.service';
import { UpdateContactReadDto } from './dto/update-contact-read.dto';

@Controller('admin/contact')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('read') read?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.contact.list({
      q,
      read,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.contact.get(id);
  }

  @Patch(':id')
  setRead(@Param('id') id: string, @Body() dto: UpdateContactReadDto) {
    return this.contact.setRead(id, dto.isRead);
  }
}
