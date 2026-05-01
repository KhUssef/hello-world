// connected-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';

export const ConnectedUserSocket = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const client: Socket = context.switchToWs().getClient();
    return client.data.user;
  },
);
