import { IsString, IsNumber, IsBoolean, IsOptional, Min } from 'class-validator';

export class CreateFeeDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
