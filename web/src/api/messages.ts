import apiClient from './client';
import type { ListQuery, ListResult, Stats } from './types';

// 获取短信列表
export const getMessages = (query?: ListQuery): Promise<ListResult> => {
  return apiClient.get('/messages', { params: query });
};

// 获取统计信息
export const getStats = (): Promise<Stats> => {
  return apiClient.get('/messages/stats');
};

// 获取单条短信
export const getMessage = (id: string) => {
  return apiClient.get(`/messages/${id}`);
};

// 删除单条短信
export const deleteMessage = (id: string) => {
  return apiClient.delete(`/messages/${id}`);
};

// 清空所有短信
export const clearMessages = () => {
  return apiClient.delete('/messages');
};
