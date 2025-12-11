// 定时任务配置
import apiClient from "@/api/client.ts";

export interface ScheduledTask {
    id: string;
    name: string;
    enabled: boolean;
    intervalDays: number;
    phoneNumber: string;
    content: string;
    createdAt?: number;
    lastRunAt?: number;
}

// 定时任务 API (RESTful)
// 获取所有定时任务
export const getScheduledTasks = () => {
    return apiClient.get<ScheduledTask[]>('/scheduled-tasks');
};

// 获取单个定时任务
export const getScheduledTask = (id: string) => {
    return apiClient.get<ScheduledTask>(`/scheduled-tasks/${id}`);
};

// 创建定时任务
export const createScheduledTask = (task: Omit<ScheduledTask, 'id' | 'createdAt' | 'lastRunAt'>) => {
    return apiClient.post<ScheduledTask>('/scheduled-tasks', task);
};

// 更新定时任务
export const updateScheduledTask = (id: string, task: Omit<ScheduledTask, 'id' | 'createdAt' | 'lastRunAt'>) => {
    return apiClient.put<ScheduledTask>(`/scheduled-tasks/${id}`, task);
};

// 删除定时任务
export const deleteScheduledTask = (id: string) => {
    return apiClient.delete<{ message: string }>(`/scheduled-tasks/${id}`);
};