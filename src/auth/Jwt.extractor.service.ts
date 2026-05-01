import { Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { Repository } from "typeorm";
import { JwtPayload } from "./jwt-payload.interface";

@Injectable()
export class JwtExtractorService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async validatePayload(payload: JwtPayload) {
    const { sub: userId, username, companyCode } = payload;

    const user = await this.userRepository.findOne({
      where: { id: userId, username },
      relations: ['company'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      sub: user.id,
      username: user.username,
      companyCode: user.company?.code,
      role : user.role,
    };
  }
}
