import { UserRole } from './user-role.enum';

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  role: UserRole;
  light_dark_mode: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  first_name?: string;
  last_name?: string;
  phone_number?: string | null;
  light_dark_mode?: boolean;
  avatar_url?: string | null;
}
