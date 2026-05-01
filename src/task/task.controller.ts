import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Sse } from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConnectedUser } from '../auth/decorator/user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Observable, of } from 'rxjs';
import { TaskEvents } from './task.events';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskEvents: TaskEvents
  ) {}

  @Sse('events')
  events(@ConnectedUser() user: JwtPayload): Observable<any> {
    if (!user.sub) {
      return of({ type: 'error', data: 'No user ID found' });
    }
    const stream = this.taskEvents.getUserStream(user.sub.toString());
    if (!stream) {
      return of({ type: 'error', data: 'Stream not available' });
    }
    return stream;
  }

}
