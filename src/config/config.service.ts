import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { Config } from './config.interface';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  get<T>(key: string): T {
    const val = this.configService.get<string>(key);
    if(!val) {
        throw new Error(`Key ${key} not found in the configuration`);
    }
    return val as T;
  }

  getDatabaseConfig(): Config {
    console.log('Fetching database configuration');
    console.log('DATABASE_HOST:', this.configService.get<string>('DATABASE_HOST'));
    console.log('DATABASE_PORT:', this.configService.get<number>('DATABASE_PORT'));
    console.log('DATABASE_USERNAME:', this.configService.get<string>('DATABASE_USERNAME'));
    console.log('DATABASE_PASSWORD:', this.configService.get<string>('DATABASE_PASSWORD'));
    return {
      databaseHost: this.configService.get<string>('DATABASE_HOST') || 'localhost',
      databasePort: this.configService.get<number>('DATABASE_PORT') || 3306,
      databaseUsername: this.configService.get<string>('DATABASE_USERNAME') || 'root',
      databasePassword: this.configService.get<string>('DATABASE_PASSWORD') || 'password',
      databaseName: this.configService.get<string>('DATABASE_NAME') || 'test',
      jwtSecret: this.configService.get<string>('JWT_SECRET') || 'secretkey',
    };
  }
}
