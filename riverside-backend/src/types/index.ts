export type Role = "visitor" | "member" | "staff" | "admin";

export interface AuthedUser {
  id: string;
  email: string | undefined;
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
    accessToken?: string;
  }
}
