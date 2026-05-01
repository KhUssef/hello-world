import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const type = context.getType();

    if (type === 'http') {
      
      return super.canActivate(context) as Promise<boolean>;
    }

    if (type === 'ws') {
      console.log("jwtauthguardactivated")
      // For WebSocket, custom JWT validation
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.headers['auth-user'];

      if (!token) {
        throw new UnauthorizedException('No token provided in WebSocket handshake');
      }

      try {
        // Handle multiple tokens case
        if (Array.isArray(token)) {
          throw new UnauthorizedException('Multiple tokens provided in WebSocket handshake');
        }

        const payload = this.jwtService.verify(token);
        client.data.user = payload;  // Attach user info to socket
        return true;
      } catch (err) {
        throw new UnauthorizedException('Invalid WebSocket token');
      }
    }

    throw new UnauthorizedException('Unknown context type');
  }
}
