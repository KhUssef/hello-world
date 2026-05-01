// src/company/company.service.ts

import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateCompanyWithManagerDto } from './dto/create-company-with-manager.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '../enum/role.enum';
import { randomBytes } from 'crypto';
import { CreateEventService } from 'src/history/create-event.service';
import { OperationType } from 'src/enum/operation-type';
import { Note } from 'src/note/entities/note.entity';
import { NoteLine } from 'src/note/entities/noteline.entity';
import { NoteService } from 'src/note/note.service';
import { NoteLineService } from 'src/note/noteLine.service';
@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly NoteService: NoteService,
    private readonly NoteLineService: NoteLineService,
    private readonly createEventService: CreateEventService,
  ) {}

  async createCompanyWithManager(dto: CreateCompanyWithManagerDto): Promise<Company> {
    const { companyName, managerUsername, managerPassword } = dto;

    const companyCode = randomBytes(8).toString('hex');

    const existing = await this.companyRepository.findOne({ where: { code: companyCode } });
    while (existing) {
      const companyCode = randomBytes(8).toString('hex');

    }

    const company = this.companyRepository.create({
      code: companyCode,
      name: companyName,
    });

    const savedCompany = await this.companyRepository.save(company);

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(managerPassword, salt);
    const user = await this.userRepository.create({
      username: managerUsername,
      password: hashedPassword,
      salt,
      role: Role.MANAGER,
      company: savedCompany,
    });
    const manager = await this.userRepository.save(user);
    const Note = await this.NoteService.create({
      title: 'Welcome Note',
      company: savedCompany,
      lines: [],
      lineCount: 0,
    }, manager.id);
    if(Note==null) {
      throw new ConflictException('Note already exists');
    }
    for (let i = 0; i < 10; i++) {
      const noteLine = await this.NoteLineService.create({
        lineNumber: i + 1,
        content: `Welcome to ${companyName}! This is line ${i + 1}.`,
        note: Note,
      }, manager.id);
      if(noteLine == null) {
        throw new ConflictException('Note line already exists');
      }
      Note.lines.push(noteLine);
    }
    Note.lineCount = Note.lines.length;
    await this.NoteService.updateWithoutEvent(Note.id, Note, manager.id);

    return savedCompany;
  }
  async findByCode(code: string): Promise<Company | null> {
    console.log(`Searching for company with code: ${code}`);
    return this.companyRepository.findOne({ where: { code } });
  }
  
  async getCompanyById(id: number): Promise<Company | null> {
    return this.companyRepository.findOne({ where: { id } });
  }
}
