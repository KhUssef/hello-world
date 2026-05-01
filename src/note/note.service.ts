import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateNoteDto } from './dto/create-note.dto';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { SharedService } from 'src/services/shared.services';
import { Note } from './entities/note.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateEventService } from 'src/history/create-event.service';
import { DeepPartial, Repository } from 'typeorm';
import { NoteLine } from './entities/noteline.entity';
import { OperationType } from 'src/enum/operation-type';
import { Task } from 'src/task/entities/task.entity';
import { User } from 'src/user/entities/user.entity';
import { CompanyService } from 'src/company/company.service';
import { Company } from 'src/company/entities/company.entity';

@Injectable()
export class NoteService extends SharedService<Note>{
  constructor(
    @InjectRepository(Note) private readonly repo: Repository<Note>,
    @InjectRepository(Company) private readonly companyRepo: Repository<Company>,
    private readonly cEventService: CreateEventService
  ) {
    super(repo, cEventService);
  }

      async lineCount(noteId: number): Promise<number> {
        const note = await this.repo.findOne({
            where: { id: noteId },
            relations: ['lines'],
        });
        return note ? note.lines.length : 0;
}
async updateWithoutEvent(id: number, data: DeepPartial<Note>, userID?): Promise<DeepPartial<Note> | null> {
  const entity = await this.findOne(id);
  console.log('Entity found for update:', entity);
  if (!entity) {
    throw new NotFoundException(`Entity with id ${id} not found`);
  }
  const updated = this.repository.merge(entity, data);
  console.log('Updated entity:', updated);
  const savedEntity = await this.repository.save(updated);
  return savedEntity;
}

async getNoteById(noteId: number): Promise<Note | null> {
  const temp = await this.repo.findOne({
    where: { id: noteId },
    relations: ['company'],
  });
    return temp;
  }

  async getnoteId(user: JwtPayload): Promise<Note | null> {
    const companyCode = user.companyCode;
    if (!companyCode) {
      throw new InternalServerErrorException('Company code is required');
    }
    const company = await this.companyRepo.findOne({
      where: { code: companyCode },
  });
    const companyId = company?.id;
    if (!companyId) {
      return null;
    }
    const temp = await this.repo.findOne({
      where: { company: { id: companyId } },
    });
    console.log('Note found for company:', temp);
    return temp;
  }
}