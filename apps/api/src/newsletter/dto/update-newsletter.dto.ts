import { IsBoolean } from 'class-validator';

export class UpdateNewsletterActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateNewsletterSendingDto {
  @IsBoolean()
  enabled!: boolean;
}
