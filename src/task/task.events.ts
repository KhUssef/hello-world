import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Task } from './entities/task.entity';
import { Subject } from 'rxjs';

@Injectable()
export class TaskEvents {
  private userStreams: Map<string, Subject<any>> = new Map();

  getUserStream(userId: string) {
    if (!this.userStreams.has(userId)) {
      this.userStreams.set(userId, new Subject());
    }
    return this.userStreams.get(userId);
  }

  emitToUser(userId: string, event: any) {
    const stream = this.getUserStream(userId);
    if (stream) {
      stream.next(event);
    }
  }

  @OnEvent('task.completed')
  handleTaskCompleted(task: Task) {
    if (task.company?.users) {
      task.company.users.forEach(user => {
        this.emitToUser(user.id.toString(), {
          type: 'task.completed',
          data: {
            taskId: task.id,
            title: task.title,
            message: `Task "${task.title}" has been completed!`,
          },
        });
      });
    }
  }

  @OnEvent('task.dueTomorrow')
  handleTaskDueTomorrow(task: Task) {
    if (task.assignedTo) {
      this.emitToUser(task.assignedTo.id.toString(), {
        type: 'task.dueTomorrow',
        data: {
          taskId: task.id,
          title: task.title,
          message: `Task "${task.title}" is due tomorrow!`,
        },
      });
    }
  }
} 