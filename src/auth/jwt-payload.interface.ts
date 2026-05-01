import { Role } from "src/enum/role.enum";

export interface JwtPayload {
  username: string;
  sub: number; // The user's ID
  role: Role;
  companyCode: string;
}
