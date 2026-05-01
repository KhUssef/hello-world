import { Controller, UseGuards, Sse, Get } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConnectedUser } from '../auth/decorator/user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Observable, of } from 'rxjs';
import { UserEvents } from './user.events';
import { User } from './entities/user.entity';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { Role } from 'src/enum/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userEvents: UserEvents
  ) {}
 @Get('company')
  async getUsersByCompany(@ConnectedUser() user: JwtPayload): Promise<User[]> {
    return this.userService.findAll();
  }
  @Sse('events')
  events(@ConnectedUser() user: JwtPayload): Observable<any> {
    if (!user.sub) {
      return of({ type: 'error', data: 'No user ID found' });
    }
    const stream = this.userEvents.getUserStream(user.sub.toString());
    if (!stream) {
      return of({ type: 'error', data: 'Stream not available' });
    }
    return stream;
  }
  @Get("user-names")
  @Roles([Role.MANAGER])
  async getUserNames(@ConnectedUser() user: JwtPayload): Promise<string[]> {
    const res = await this.userService.getUsernames(user.companyCode);
    console.log(res);
    return res;
  }
}
