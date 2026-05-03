import { api } from './client';
import type { Baby, CreateBabyInput, UpdateBabyInput } from '@/types/baby';

interface ApiResponse<T> { status: string; message?: string; data: T; }

export const getBabies = async (): Promise<Baby[]> => { const response = await api.get<ApiResponse<Baby[]>>('/babies'); return response.data.data; };
export const getBabyById = async (id: number): Promise<Baby> => { const response = await api.get<ApiResponse<Baby>>(`/babies/${id}`); return response.data.data; };
export const createBaby = async (data: CreateBabyInput): Promise<Baby> => { const response = await api.post<ApiResponse<Baby>>('/babies', data); return response.data.data; };
export const updateBaby = async (id: number, data: UpdateBabyInput): Promise<Baby> => { const response = await api.put<ApiResponse<Baby>>(`/babies/${id}`, data); return response.data.data; };
export const deleteBaby = async (id: number): Promise<void> => { await api.delete(`/babies/${id}`); };
