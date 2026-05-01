import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from '../auth/dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository, Not, IsNull } from 'typeorm';
import { Company } from '../company/entities/company.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtPayload } from '../auth/jwt-payload.interface';
import * as bcrypt from 'bcrypt';
import { Role } from '../enum/role.enum';
import { Operation } from '../history/entities/operation.entity';
import { Target } from '../enum/target.enum';
import { OperationType } from '../enum/operation-type';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(Operation)
    private operationRepository: Repository<Operation>,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['company'],
    });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['company'],
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findOneByUsername(username: string, companyId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { username, company: { id: companyId } },
      relations: ['company'],
    });
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    return this.userRepository.find({
      where: { company: { id: companyId } },
      relations: ['company'],
    });
  }

  async findDeleted(): Promise<User[]> {
    return this.userRepository.find({
      where: { deletedAt: Not(IsNull()) },
      relations: ['company'],
      withDeleted: true,
    });
  }

  private async createOperation(user: User, type: OperationType, data: any): Promise<void> {
    const { company, ...restData } = data;
    try {
    restData.company = company.id;
    }catch (error) {
      console.log("kys");}
    const {salt, password, ...actdata}  = restData;
    
    const operation = this.operationRepository.create({
      type,
      description: JSON.stringify(actdata),
      performedBy: user,
      target: data.id,
      targettype: Target.USER,
      date: new Date(),
      company: user.company,
    });

    await this.operationRepository.save(operation);
    this.eventEmitter.emit(`event.created.${user.company?.code}`, operation);
  }

  async update(id: number, updateUserDto: UpdateUserDto, user: JwtPayload): Promise<User> {
    const existingUser = await this.findOne(id);
    
    const updatedUser = await this.userRepository.save({
      ...existingUser,
      ...updateUserDto
    });

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    const performingUser = await this.findOne(user.sub);
    await this.createOperation(performingUser, OperationType.UPDATE, updatedUser);

    return updatedUser;
  }

  async remove(id: number, user: JwtPayload): Promise<void> {
    const userToDelete = await this.findOne(id);
    await this.userRepository.softDelete(id);
    
    const performingUser = await this.findOne(user.sub);
    await this.createOperation(performingUser, OperationType.DELETE, userToDelete);
  }

  async recover(id: number, user: JwtPayload): Promise<User> {
    const userToRecover = await this.userRepository.findOne({
      where: { id },
      withDeleted: true
    });
    
    if (!userToRecover) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.restore(id);
    
    const performingUser = await this.findOne(user.sub);
    await this.createOperation(performingUser, OperationType.RECOVER, userToRecover);

    return userToRecover;
  }
  async getUsernames(companyCode: string): Promise<string[]> {
    const company = await this.companyRepository.findOne({
      where: { code: companyCode },
      select: ['id'],
    });
    
    const users = await this.userRepository.find({
      where: { company: { id: company?.id } },
      select: ['username'],
    });
    return users.map(user => user.username);
  }
}
