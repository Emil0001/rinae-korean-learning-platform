export type UserRole = "STUDENT" | "ADMIN";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  courseAccessEnabled: boolean;
};

export type SignInData = {
  email: string;
  password: string;
};

export type SignUpData = {
  name: string;
  email: string;
  password: string;
};
