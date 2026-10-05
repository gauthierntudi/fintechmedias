import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAdminGuard } from '../auth/guards/jwt-admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateNewsletterActiveDto, UpdateNewsletterSendingDto } from './dto/update-newsletter.dto';
import { NewsletterService } from './newsletter.service';

@Controller('admin/newsletter')
@UseGuards(JwtAdminGuard, RolesGuard)
@Roles(
  AdminRole.SUPERADMIN,
  AdminRole.ADMIN,
  AdminRole.EDITOR,
  AdminRole.REDACTEUR,
)
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('active') active?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.newsletter.list({
      q,
      active,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Patch('sending')
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
  setSending(@Body() dto: UpdateNewsletterSendingDto) {
    return this.newsletter.setSendingEnabled(dto.enabled);
  }

  @Post('test')
  @Roles(AdminRole.SUPERADMIN, AdminRole.ADMIN)
  sendTest() {
    return this.newsletter.sendTest();
  }

  @Patch(':id')
  setActive(@Param('id') id: string, @Body() dto: UpdateNewsletterActiveDto) {
    return this.newsletter.setActive(id, dto.isActive);
  }
}
