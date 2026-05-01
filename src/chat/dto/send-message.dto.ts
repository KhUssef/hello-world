import { IsString, IsNotEmpty, IsNumber } from 'class-validator';

export class SendMessageDto {
  @IsNumber()
  chatId: number;

  @IsString()
  @IsNotEmpty()
  content: string;
}