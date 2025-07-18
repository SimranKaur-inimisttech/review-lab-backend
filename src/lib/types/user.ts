export interface User {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  is_email_verified?: boolean;
  role?:string
}