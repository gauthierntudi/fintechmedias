import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CompleteStatusVideoDto,
  CreateStatusSlideDto,
  PresignStatusVideoDto,
  ReorderStatusSlidesDto,
  UpdateStatusSlideDto,
} from './dto/admin-status.dto';
import {
  CreateMyStatusDto,
  RetryStatusPaymentDto,
  StatusPassCheckoutDto,
  SubmitMyStatusDto,
} from './dto/my-status.dto';
import { StatusOffersService } from './status-offers.service';
import { StatusesService, type StatusActor } from './statuses.service';

type UploadedMemFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const imageUpload = () =>
  FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 10_000_000 },
  });

const me = (user: AuthUser): StatusActor => ({
  kind: 'subscriber',
  id: user.id,
});

/** Statuts publiés par l’abonné connecté (app mobile, bouton +). */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MyStatusesController {
  constructor(
    private readonly statuses: StatusesService,
    private readonly offers: StatusOffersService,
  ) {}

  // ------------------------------------------------------------- forfaits

  @Get('status-passes')
  passes(@CurrentUser() user: AuthUser) {
    return this.offers.listMyPasses(user.id);
  }

  @Post('status-passes/checkout')
  checkoutPass(
    @CurrentUser() user: AuthUser,
    @Body() dto: StatusPassCheckoutDto,
  ) {
    return this.offers.checkoutPass(user.id, dto.offerId, dto.phone);
  }

  // -------------------------------------------------------------- statuts

  @Get('statuses')
  list(@CurrentUser() user: AuthUser) {
    return this.statuses.listMine(user.id);
  }

  @Post('statuses')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMyStatusDto) {
    return this.statuses.createMine(dto, user.id);
  }

  @Get('statuses/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.statuses.getMine(id, user.id);
  }

  @Delete('statuses/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.statuses.remove(id, me(user));
  }

  /** Soumission à la rédaction (forfait ou paiement unique) */
  @Post('statuses/:id/submit')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitMyStatusDto,
  ) {
    return this.statuses.submitMine(id, dto, user.id);
  }

  @Post('statuses/:id/pay')
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RetryStatusPaymentDto,
  ) {
    return this.statuses.retryPayment(id, dto.phone, user.id);
  }

  // --------------------------------------------------------------- diapos

  @Post('statuses/:id/slides')
  createSlide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateStatusSlideDto,
  ) {
    return this.statuses.createSlide(id, dto, me(user));
  }

  @Put('statuses/:id/slides/order')
  reorderSlides(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReorderStatusSlidesDto,
  ) {
    return this.statuses.reorderSlides(id, dto.ids, me(user));
  }

  @Patch('statuses/slides/:slideId')
  updateSlide(
    @CurrentUser() user: AuthUser,
    @Param('slideId') slideId: string,
    @Body() dto: UpdateStatusSlideDto,
  ) {
    return this.statuses.updateSlide(slideId, dto, me(user));
  }

  @Delete('statuses/slides/:slideId')
  removeSlide(
    @CurrentUser() user: AuthUser,
    @Param('slideId') slideId: string,
  ) {
    return this.statuses.removeSlide(slideId, me(user));
  }

  @Post('statuses/slides/:slideId/image')
  @UseInterceptors(imageUpload())
  uploadImage(
    @CurrentUser() user: AuthUser,
    @Param('slideId') slideId: string,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.statuses.uploadImage(slideId, file, me(user));
  }

  @Post('statuses/slides/:slideId/poster')
  @UseInterceptors(imageUpload())
  uploadPoster(
    @CurrentUser() user: AuthUser,
    @Param('slideId') slideId: string,
    @UploadedFile() file: UploadedMemFile,
  ) {
    return this.statuses.uploadPoster(slideId, file, me(user));
  }

  @Post('statuses/slides/:slideId/video/presign')
  presignVideo(
    @CurrentUser() user: AuthUser,
    @Param('slideId') slideId: string,
    @Body() dto: PresignStatusVideoDto,
  ) {
    return this.statuses.presignVideo(slideId, dto, me(user));
  }

  @Post('statuses/slides/:slideId/video/complete')
  completeVideo(
    @CurrentUser() user: AuthUser,
    @Param('slideId') slideId: string,
    @Body() dto: CompleteStatusVideoDto,
  ) {
    return this.statuses.completeVideo(slideId, dto, me(user));
  }
}
