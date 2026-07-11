import { apiClient } from './client';
import { User } from '../types';

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),

  register: (email: string, password: string, name: string) =>
    apiClient
      .post<AuthResponse>('/auth/register', { email, password, name })
      .then((r) => r.data),
};
