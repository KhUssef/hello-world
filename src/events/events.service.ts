import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DeepPartial, Repository } from 'typeorm';
import { Event  } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateEventService } from 'src/history/create-event.service';
import { OperationDto } from 'src/history/dto/operation.dto';
import { OperationType } from 'src/enum/operation-type';
import { SharedService } from 'src/services/shared.services';
import { Company } from 'src/company/entities/company.entity';
import { UserService } from 'src/user/user.service';

@Injectable()
export class EventsService{

  constructor(
   @InjectRepository(Event)
    protected readonly repo: Repository<Event>,
    @InjectRepository(Company)
    protected readonly companyRepo: Repository<Company>,
    protected readonly createEventService: CreateEventService,
    protected readonly userServie : UserService
  ) {
  }
    async create(data: CreateEventDto,userID : number, companyCode: string): Promise<Event | null> {
      try {
        const user = await this.userServie.findOne(userID);
        if(!user) {
          throw new NotFoundException(`User with ID ${userID} not found`);
        }
        const company = await this.companyRepo.findOne({
          where: { code: companyCode },
          select: ['id'],
        });
        const new1 = {
          ...data,
          company: company,
          createdBy: user,
        }
        const entityt = this.repo.create(new1 as DeepPartial<Event>);
        const entity =  await this.repo.save(entityt);
        this.createEventService.createEvent({
          type: OperationType.CREATE,
          userId : userID,
          data: entity 
        });
        return entity;
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new InternalServerErrorException(
          'An error occurred while creating the entity',
        );
      }
    }

  async findByDate(date: Date): Promise<Event[]> {
    // Format date to yyyy-mm-dd for comparison
    const dateStr = date.toDateString().split('T')[0];
    
    return this.repo.createQueryBuilder('event')
      .where('DATE(event.date) = :dateStr', { dateStr })
      .getMany();
  }

  async getAll(companyCode : string, limit: number = 0, offset: number=0) : Promise<any[]> {
    const companyId = await this.companyRepo.findOne({
      where: { code: companyCode },
      select: ['id'],
    });
    if (!companyId) {
      throw new NotFoundException(`Company with code ${companyCode} not found`);
    }
    console.log('Company ID:', companyId);
    const query = this.repo.createQueryBuilder('event')
      .where('event.companyId = :companyId', { companyId : companyId.id })
      .select([
        'event.id AS event_id',
        'event.title AS event_title',
        'event.date AS event_date',
        'event.description AS event_description',
        'event.createdById AS event_created_by_id',
      ])
      .orderBy('event.date', 'DESC');

    if (limit > 0) {
      query.take(limit);
    }
    if (offset > 0) {
      query.skip(offset);
    }
    console.log('Query:', query.getSql());
    const raw = await query.getRawMany();
    console.log('Raw Events:', raw);
    return raw.map(event => ({
      id: event.event_id,
      title: event.event_title,
      date: event.event_date,
      description: event.event_description,
      createdById: event.event_created_by_id,
  }) );}



  async EventByMonth(companyCode: string, date: Date): Promise<any[]> {
    const companyId = await this.companyRepo.findOne({
      where: { code: companyCode },
      select: ['id'],
    });
    if (!companyId) {
      throw new NotFoundException(`Company with code ${companyCode} not found`);
    }
    console.log(typeof date, date);
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    if (!companyId) {
      throw new NotFoundException(`Company with code ${companyCode} not found`);
    }
    const query =  this.repo.createQueryBuilder('event')
      .where('event.companyId = :companyId', { companyId: companyId.id})
      .andWhere('event.date BETWEEN :startOfMonth AND :endOfMonth', {
        startOfMonth,
        endOfMonth,
      }).select([
        'event.id AS event_id',
        'event.title AS event_title',
        'event.date AS event_date',
        'event.description AS event_description',
        'event.createdById AS event_created_by_id',
      ])

    const raw = await query.getRawMany();
    return raw.map(event => ({
      id: event.event_id,
      title: event.event_title,
      date: event.event_date,
      description: event.event_description,
      createdById: event.event_created_by_id,
    }));
  }
  async EventByDay(companyCode: string,date : Date): Promise<any[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    const companyId = await this.companyRepo.findOne({
      where: { code: companyCode },
      select: ['id'],
    });
    if(!companyId)
    {
      throw new NotFoundException(`Company with ID ${companyId} not found`);
    }
    const query = this.repo.createQueryBuilder('event')
      .where('event.companyId = :companyId', { companyId : companyId.id })
      .andWhere('event.date BETWEEN :startOfDay AND :endOfDay', {
        startOfDay,
        endOfDay,
      }).select([
        'event.id AS event_id',
        'event.title AS event_title',
        'event.date AS event_date',
        'event.description AS event_description',
        'event.createdById AS event_created_by_id',
      ])
        ;
    const raw = await query.getRawMany();
    return raw.map(event => ({
      id: event.event_id,
      title: event.event_title,
      date: event.event_date,
      description: event.event_description,
      createdById: event.event_created_by_id,
    }));

  }

  // async getEventNamesByDate(date: Date): Promise<{ name: string; date: Date }[]> {
  //   const startOfDay = new Date(date);
  //   startOfDay.setHours(0, 0, 0, 0);

  //   const endOfDay = new Date(date);
  //   endOfDay.setHours(23, 59, 59, 999);

  //   const events = await this.repository.find({
  //     where: {
  //       date: Between(startOfDay, endOfDay),
  //     },
  //     select: ['title', 'date'],
  //   });

  //   return events.map(event => ({
  //     name: event.title,
  //     date: event.date,
  //   }));
  // }
}
