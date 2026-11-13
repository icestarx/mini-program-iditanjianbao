import { IsInt, IsUUID, Min } from 'class-validator';

export class PurchaseDto {
  @IsUUID()
  request_id!: string;

  @IsInt()
  @Min(1)
  price_c!: number;
}
