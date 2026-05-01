import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { CompanyModule } from '../company/company.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { JwtExtractorService } from './Jwt.extractor.service';
import { HistoryModule } from 'src/history/history.module';
import { Operation } from 'src/history/entities/operation.entity';
@Module({
  imports: [TypeOrmModule.forFeature([User, Operation]),PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: process.env.JWT_EXPIRATION || '1h' },
  })],
  exports: [AuthService, JwtExtractorService],
  providers: [AuthService, JwtStrategy, JwtExtractorService],
  controllers: [AuthController]
})
export class AuthModule {}
