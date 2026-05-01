import { PartialType } from '@nestjs/graphql';
import { IsNotEmpty } from 'class-validator';
import { DeepPartial } from 'typeorm';
import { Event } from '../entities/event.entity';
import { User } from 'src/user/entities/user.entity';

export class CreateEventDto implements Partial<Event> {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  description: string;

  @IsNotEmpty()
  date: Date;

  @IsNotEmpty()
  createdById : number;
}
