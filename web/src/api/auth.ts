import apiClient from './client';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
  expiresAt: number;
}

export const login = (request: LoginRequest): Promise<LoginResponse> => {
  return apiClient.post('/login', request);
};
