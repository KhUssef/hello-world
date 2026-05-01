import { IsDateString } from 'class-validator';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class EventTitleByDateDTO {
  @Field()
  @IsDateString()
  date: string; // ISO-formatted date string (e.g. "2025-06-01")
}
