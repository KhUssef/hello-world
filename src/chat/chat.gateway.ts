import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ConnectedUser } from 'src/auth/decorator/user.decorator';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { JwtExtractorService } from 'src/auth/Jwt.extractor.service';

interface ConnectedUserInfo {
  userId: number;
  username: string;
  companyCode: string;
  socketIds: string[];
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private secret: string;
  private userSockets = new Map<number, Socket[]>();
  private companyRooms = new Map<string, Set<number>>(); 
  private connectedUsers = new Map<string, ConnectedUserInfo>(); // Track by companyCode

  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
    private readonly extractor: JwtExtractorService,
  ) {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not defined');
    this.secret = secret;
  }

  afterInit(server: Server) {
    console.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query.Authorization as string;
      
      if (!token) {
        console.error('No token provided');
        client.disconnect();
        return;
      }

      const decodedJwt = jwt.verify(token, this.secret) as any;
      const user = await this.extractor.validatePayload(decodedJwt);
      
      if (!user) {
        console.error('Invalid user payload');
        client.disconnect();
        return;
      }

      client.data.user = user;
      
      console.log(`Chat connected: ${user.username} (${user.sub})`);

      // Join company room
      const companyRoom = `company-${user.companyCode}`;
      client.join(companyRoom);

      // Track user connections
      if (!this.userSockets.has(user.sub)) {
        this.userSockets.set(user.sub, []);
      }
      (this.userSockets.get(user.sub) as Socket[]).push(client);

      if (!this.companyRooms.has(user.companyCode)) {
        this.companyRooms.set(user.companyCode, new Set());
      }
      (this.companyRooms.get(user.companyCode) as Set<number>).add(user.sub);

      // Update connected users for this company
      this.updateConnectedUsers(user.companyCode);

      // Send current connected users to the newly connected client
      const connectedUsers = this.getConnectedUsersForCompany(user.companyCode);
      client.emit('connectedUsers', connectedUsers);

      // Notify others in company that user is online (but not the user themselves)
      client.to(companyRoom).emit('userOnline', {
        userId: user.sub,
        username: user.username,
      });

      // Broadcast updated connected users list to all users in the company
      this.server.to(companyRoom).emit('connectedUsers', connectedUsers);

    } catch (error) {
      console.error('Socket auth failed:', error.message);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const user: JwtPayload = client.data.user;
      
      if (!user) return;

      console.log(`Chat disconnected: ${user.username} (${user.sub})`);

      // Remove client from user sockets
      const userSockets = this.userSockets.get(user.sub);
      if (userSockets) {
        const index = userSockets.indexOf(client);
        if (index > -1) {
          userSockets.splice(index, 1);
        }

        // If no more sockets for this user, mark as offline
        if (userSockets.length === 0) {
          this.userSockets.delete(user.sub);
          
          const companyUsers = this.companyRooms.get(user.companyCode);
          if (companyUsers) {
            companyUsers.delete(user.sub);
            if (companyUsers.size === 0) {
              this.companyRooms.delete(user.companyCode);
            }
          }

          // Update connected users for this company
          this.updateConnectedUsers(user.companyCode);

          // Notify others in company that user is offline
          const companyRoom = `company-${user.companyCode}`;
          this.server.to(companyRoom).emit('userOffline', {
            userId: user.sub,
            username: user.username,
          });

          // Broadcast updated connected users list
          const connectedUsers = this.getConnectedUsersForCompany(user.companyCode);
          this.server.to(companyRoom).emit('connectedUsers', connectedUsers);
        }
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() data: SendMessageDto,
    @ConnectedSocket() client: Socket,
    @ConnectedUser() user: JwtPayload,
  ) {
    if (!user) return;

    console.log(`Message from ${user.username}:`, data);
    
    try {
      // Validate message content
      if (!data.content?.trim()) {
        client.emit('error', {
          message: 'Message content cannot be empty',
        });
        return { success: false, error: 'Message content cannot be empty' };
      }

      if (data.content.length > 1000) {
        client.emit('error', {
          message: 'Message is too long',
        });
        return { success: false, error: 'Message is too long' };
      }

      const message = await this.chatService.sendMessage(data, user);
      
      // Send to company room (this will include the sender)
      const companyRoom = `company-${user.companyCode}`;
      this.server.to(companyRoom).emit('newMessage', {
        chatId: data.chatId,
        message,
      });

      return { success: true, message };
    } catch (error) {
      console.error('Send message error:', error);
      client.emit('error', {
        message: error.message || 'Failed to send message',
      });
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('joinChat')
  async handleJoinChat(
    @MessageBody() data: { chatId: number },
    @ConnectedSocket() client: Socket,
    @ConnectedUser() user: JwtPayload,
  ) {
    if (!user) return;

    try {
      // Verify user has access to this chat
      const hasAccess = true; // You should implement proper access check here
      if (!hasAccess) {
        client.emit('error', {
          message: 'You do not have access to this chat',
        });
        return { success: false, error: 'Access denied' };
      }

      const chatRoom = `chat-${data.chatId}`;
      client.join(chatRoom);
      
      console.log(`User ${user.username} joined chat room: ${chatRoom}`);
      
      // Notify others in the chat (not the user themselves)
      client.to(chatRoom).emit('userJoinedChat', {
        userId: user.sub,
        username: user.username,
        chatId: data.chatId,
      });

      return { success: true };
    } catch (error) {
      console.error('Join chat error:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('leaveChat')
  async handleLeaveChat(
    @MessageBody() data: { chatId: number },
    @ConnectedSocket() client: Socket,
    @ConnectedUser() user: JwtPayload,
  ) {
    if (!user) return;

    try {
      const chatRoom = `chat-${data.chatId}`;
      client.leave(chatRoom);
      
      console.log(`User ${user.username} left chat room: ${chatRoom}`);
      
      // Notify others in the chat (not the user themselves)
      client.to(chatRoom).emit('userLeftChat', {
        userId: user.sub,
        username: user.username,
        chatId: data.chatId,
      });

      return { success: true };
    } catch (error) {
      console.error('Leave chat error:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody() data: { chatId: number, isTyping: boolean },
    @ConnectedSocket() client: Socket,
    @ConnectedUser() user: JwtPayload,
  ) {
    if (!user) return;

    try {
      const chatRoom = `chat-${data.chatId}`;
      
      // Only send to others in the chat, not the sender
      client.to(chatRoom).emit('userTyping', {
        userId: user.sub,
        username: user.username,
        chatId: data.chatId,
        isTyping: data.isTyping,
      });

      return { success: true };
    } catch (error) {
      console.error('Typing error:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('getOnlineUsers')
  async handleGetOnlineUsers(@ConnectedUser() user: JwtPayload) {
    if (!user) return;

    try {
      const connectedUsers = this.getConnectedUsersForCompany(user.companyCode);
      
      return {
        success: true,
        onlineUsers: connectedUsers,
      };
    } catch (error) {
      console.error('Get online users error:', error);
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('getConnectedUsers')
  async handleGetConnectedUsers(@ConnectedUser() user: JwtPayload) {
    if (!user) return;

    try {
      const connectedUsers = this.getConnectedUsersForCompany(user.companyCode);
      
      return {
        success: true,
        connectedUsers,
      };
    } catch (error) {
      console.error('Get connected users error:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper method to update connected users for a company
  private updateConnectedUsers(companyCode: string) {
    const companyUsers = this.companyRooms.get(companyCode);
    if (!companyUsers) {
      this.connectedUsers.delete(companyCode);
      return;
    }

    const connectedUsersList: ConnectedUserInfo[] = [];
    
    for (const userId of companyUsers) {
      const userSockets = this.userSockets.get(userId);
      if (userSockets && userSockets.length > 0) {
        const user = userSockets[0].data.user as JwtPayload;
        if (user) {
          connectedUsersList.push({
            userId: user.sub,
            username: user.username,
            companyCode: user.companyCode,
            socketIds: userSockets.map(socket => socket.id),
          });
        }
      }
    }

    this.connectedUsers.set(companyCode, connectedUsersList as any);
  }

  // Helper method to get connected users for a company
  private getConnectedUsersForCompany(companyCode: string): Array<{userId: number, username: string}> {
    const companyUsers = this.companyRooms.get(companyCode);
    if (!companyUsers) return [];

    const connectedUsers: Array<{userId: number, username: string}> = [];
    
    for (const userId of companyUsers) {
      const userSockets = this.userSockets.get(userId);
      if (userSockets && userSockets.length > 0) {
        const user = userSockets[0].data.user as JwtPayload;
        if (user) {
          connectedUsers.push({
            userId: user.sub,
            username: user.username,
          });
        }
      }
    }

    return connectedUsers;
  }

  // Helper method to get username from socket (kept for compatibility)
  private getUsernameFromSocket(userId: number): string | null {
    const userSockets = this.userSockets.get(userId);
    if (userSockets && userSockets.length > 0) {
      const user = userSockets[0].data.user as JwtPayload;
      return user?.username || null;
    }
    return null;
  }

  // Cleanup method for memory management
  private cleanupStaleConnections() {
    console.log('Running connection cleanup...');
    
    const companiesUpdated = new Set<string>();
    
    // Check for disconnected sockets
    for (const [userId, sockets] of this.userSockets) {
      const activeSockets = sockets.filter(socket => socket.connected);
      
      if (activeSockets.length === 0) {
        // No active sockets for this user
        this.userSockets.delete(userId);
        
        // Remove from company rooms and track which companies were affected
        for (const [companyCode, userSet] of this.companyRooms) {
          if (userSet.has(userId)) {
            userSet.delete(userId);
            companiesUpdated.add(companyCode);
            if (userSet.size === 0) {
              this.companyRooms.delete(companyCode);
            }
          }
        }
      } else if (activeSockets.length !== sockets.length) {
        // Some sockets are disconnected
        this.userSockets.set(userId, activeSockets);
      }
    }

    // Update connected users for affected companies
    for (const companyCode of companiesUpdated) {
      this.updateConnectedUsers(companyCode);
      const connectedUsers = this.getConnectedUsersForCompany(companyCode);
      this.server.to(`company-${companyCode}`).emit('connectedUsers', connectedUsers);
    }
  }

  // Optional: Add periodic cleanup
  onModuleInit() {
    // Run cleanup every 5 minutes
    setInterval(() => {
      this.cleanupStaleConnections();
    }, 5 * 60 * 1000);
  }
}