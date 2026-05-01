import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CompanyService } from './company.service';
import { CreateCompanyWithManagerDto } from './dto/create-company-with-manager.dto';
import { Company } from './entities/company.entity';
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService){}
  @Post('create-company')
  async createCompanyWithManager(
    @Body() dto: CreateCompanyWithManagerDto
  ): Promise<Company> {
    return this.companyService.createCompanyWithManager(dto);
  }
}

