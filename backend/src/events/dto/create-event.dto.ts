import {
  IsString,
  IsInt,
  IsDateString,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ example: 'Product Launch Meetup' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: 'Join us for demos, networking, and snacks.' })
  @IsString()
  @MinLength(1)
  description: string;

  @ApiProperty({ example: '2026-10-15T18:00:00.000Z' })
  @IsDateString()
  startsAt: string;

  @ApiProperty({ example: 'Bangalore, India' })
  @IsString()
  @MinLength(1)
  location: string;

  @ApiProperty({ example: 100, minimum: 1 })
  @IsInt()
  @Min(1)
  capacity: number;
}
