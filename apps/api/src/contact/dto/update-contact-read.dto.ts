import { IsBoolean } from 'class-validator';

export class UpdateContactReadDto {
  @IsBoolean()
  isRead!: boolean;
}
