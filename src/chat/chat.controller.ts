import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/role-guard';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { ConnectedUser } from 'src/auth/decorator/user.decorator';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { Role } from 'src/enum/role.enum';


@Controller('chat')

@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles([Role.MANAGER, Role.MANAGER])
  async createChat(
    @Body() createChatDto: CreateChatDto,
    @ConnectedUser() user: JwtPayload,
  ) {
    return this.chatService.createChat(createChatDto, user);
  }

  @Get()
  async getChats(@ConnectedUser() user: JwtPayload) {
    return this.chatService.getCompanyChats(user);
  }

  @Get(':id/messages')
  async getChatMessages(
    @Param('id', ParseIntPipe) chatId: number,
  @ConnectedUser() user: JwtPayload,
    @Query('limit') limit?: number,
     
    
  ) {
    return this.chatService.getChatMessages(chatId, user, limit || 50);
  }

  @Post('message')
  async sendMessage(
    @Body() sendMessageDto: SendMessageDto,
    @ConnectedUser() user: JwtPayload,
  ) {
    return this.chatService.sendMessage(sendMessageDto, user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles([Role.MANAGER])
  async deleteChat(
    @Param('id', ParseIntPipe) chatId: number,
    @ConnectedUser() user: JwtPayload,
  ) {

    return this.chatService.deleteChat(chatId, user);
  }
}