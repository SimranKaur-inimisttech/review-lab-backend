export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  is_email_verified?: boolean;
}