import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { isTomorrow } from 'date-fns';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Company } from '../company/entities/company.entity';
import { User } from '../user/entities/user.entity';
import { SharedService } from '../services/shared.services';
import { CreateEventService } from '../history/create-event.service';
import { TaskSelectOptions } from './dto/task-select.dto';

@Injectable()
export class TaskService {
  private sharedService: SharedService<Task>;

  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventEmitter: EventEmitter2,
    private createEventService: CreateEventService,
  ) {
    this.sharedService = new SharedService<Task>(taskRepository, createEventService);
  }

  async create(createTaskDto: CreateTaskDto, user: JwtPayload): Promise<Task> {
    const company = await this.companyRepository.findOne({
      where: { code: user.companyCode }
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    let assignedTo: User | undefined = undefined;
    if (createTaskDto.assignedToId) {
      const foundUser = await this.userRepository.findOne({
        where: { id: createTaskDto.assignedToId }
      });
      if (!foundUser) {
        throw new NotFoundException('Assigned user not found');
      }
      assignedTo = foundUser;
    }

    const taskData = {
      title: createTaskDto.title,
      description: createTaskDto.description,
      dueDate: createTaskDto.dueDate,
      completed: createTaskDto.completed ?? false,
      company,
      assignedTo
    };

    const savedTask = await this.sharedService.create(taskData, user.sub);
    if (!savedTask) {
      throw new NotFoundException('Failed to create task');
    }

    if (isTomorrow(savedTask.dueDate)) {
      this.eventEmitter.emit('task.dueTomorrow', savedTask);
    }

    return this.findOne(savedTask.id);
  }

  async findAll(): Promise<Task[]> {
    return this.taskRepository.find({
      select: TaskSelectOptions,
      relations: ['company', 'assignedTo'],
    });
  }

  async findOne(id: number): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      select: TaskSelectOptions,
      relations: ['company', 'assignedTo'],
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: number, updateTaskDto: UpdateTaskDto, user: JwtPayload): Promise<Task> {
    const task = await this.findOne(id);

    // Handle user assignment
    let assignedTo: User | undefined = undefined;
    if (updateTaskDto.assignedToId) {
      const foundUser = await this.userRepository.findOne({
        where: { id: updateTaskDto.assignedToId }
      });
      if (!foundUser) {
        throw new NotFoundException('Assigned user not found');
      }
      assignedTo = foundUser;
    }

    const updateData = {
      ...updateTaskDto,
      assignedTo
    };

    const updatedTask = await this.sharedService.update(id, updateData, user.sub);
    if (!updatedTask || !updatedTask.id) {
      throw new NotFoundException('Failed to update task');
    }

    const completeTask = await this.taskRepository.findOne({
      where: { id: updatedTask.id },
      relations: ['company', 'company.users', 'assignedTo'],
    });

    if (!completeTask) {
      throw new NotFoundException('Failed to fetch updated task');
    }

    if (updateTaskDto.completed && !task.completed) {
      this.eventEmitter.emit('task.completed', completeTask);
    }

    if (updateTaskDto.dueDate && isTomorrow(completeTask.dueDate)) {
      this.eventEmitter.emit('task.dueTomorrow', completeTask);
    }

    return this.findOne(updatedTask.id);
  }

  async remove(id: number, user: JwtPayload): Promise<void> {
    await this.sharedService.delete(id, user.sub);
  }

  async getTasksByUser(userId: number): Promise<Task[]> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    return this.taskRepository.find({
      where: [
      {
        assignedTo: { id: userId },
        completed: false,
      },
      {
        assignedTo: { id: userId },
        dueDate: MoreThan(oneWeekAgo),
      },
      
      ],
      select: TaskSelectOptions,
      relations: ['company', 'assignedTo'],
    });
  }

  async getTasksByCompany(companyId: number): Promise<Task[]> {
    return this.taskRepository.find({
      where: { company: { id: companyId } },
      select: TaskSelectOptions,
      relations: ['company', 'assignedTo'],
    });
  }
  async gettasksbyday(date: string, companyCode: string): Promise<Task[]> {
    const endOfDay = new Date(date);
    endOfDay.setHours(0, 0, 0, 0);
    console.log('End of day:', endOfDay);
    const companyId = await this.companyRepository.findOne({
      where: { code: companyCode },
      select: ['id'],
    });
    if (!companyId) {
      throw new NotFoundException('Company not found');
    }
    return this.taskRepository.find({
      where: {
        company: { id: companyId.id },
        dueDate: endOfDay,
      },
      select: TaskSelectOptions,
      relations: ['company', 'assignedTo'],
    });

  }
}
