export type Role = "visitor" | "member" | "staff" | "admin";

export interface AuthedUser {
  id: string;
  email: string | undefined;
  role: Role;
}

// Extends Express's Request type with auth context
declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
      accessToken?: string;
    }
  }
}
