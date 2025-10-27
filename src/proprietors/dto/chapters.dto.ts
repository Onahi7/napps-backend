import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NAPPS_CHAPTERS } from '../../common/constants/napps-chapters';
import type { NappsChapter } from '../../common/constants/napps-chapters';

export class UpdateChaptersDto {
  @ApiProperty({ 
    example: ['Lafia A', 'Keffi'], 
    enum: NAPPS_CHAPTERS,
    isArray: true,
    description: 'NAPPS chapters to assign to this proprietor'
  })
  @IsArray()
  @IsEnum(NAPPS_CHAPTERS, { each: true })
  chapters: NappsChapter[];
}

export class BulkUpdateChaptersDto {
  @ApiProperty({ 
    example: ['60a1b2c3d4e5f6789012345', '60b2c3d4e5f6789012346'], 
    description: 'Array of proprietor IDs to update',
    isArray: true
  })
  @IsArray()
  @IsString({ each: true })
  proprietorIds: string[];

  @ApiProperty({ 
    example: ['Lafia A', 'Keffi'], 
    enum: NAPPS_CHAPTERS,
    isArray: true,
    description: 'NAPPS chapters to assign to all selected proprietors'
  })
  @IsArray()
  @IsEnum(NAPPS_CHAPTERS, { each: true })
  chapters: NappsChapter[];

  @ApiPropertyOptional({ 
    example: false,
    description: 'If true, replaces existing chapters. If false, adds to existing chapters',
    default: false
  })
  @IsOptional()
  replace?: boolean;
}