import { useState } from 'react';
import { Plus, Trash2, Edit } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  getScheduledTasks,
  createScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
  type ScheduledTask,
} from '../api/scheduled_task';

interface TaskFormData {
  name: string;
  enabled: boolean;
  intervalDays: number;
  phoneNumber: string;
  content: string;
}

export default function ScheduledTasksConfig() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    name: '',
    enabled: false,
    intervalDays: 90,
    phoneNumber: '',
    content: '',
  });

  // 获取定时任务列表
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['scheduledTasks'],
    queryFn: getScheduledTasks,
  });

  // 创建任务 mutation
  const createMutation = useMutation({
    mutationFn: createScheduledTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      setDialogOpen(false);
      resetForm();
      toast.success('任务创建成功');
    },
    onError: (error: any) => {
      console.error('创建任务失败:', error);
      toast.error(error.response?.data?.error || '创建任务失败');
    },
  });

  // 更新任务 mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, task }: { id: string; task: TaskFormData }) =>
      updateScheduledTask(id, task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      setDialogOpen(false);
      setEditingTask(null);
      resetForm();
      toast.success('任务更新成功');
    },
    onError: (error: any) => {
      console.error('更新任务失败:', error);
      toast.error(error.response?.data?.error || '更新任务失败');
    },
  });

  // 删除任务 mutation
  const deleteMutation = useMutation({
    mutationFn: deleteScheduledTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledTasks'] });
      toast.success('任务删除成功');
    },
    onError: (error: any) => {
      console.error('删除任务失败:', error);
      toast.error(error.response?.data?.error || '删除任务失败');
    },
  });

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      enabled: false,
      intervalDays: 90,
      phoneNumber: '',
      content: '',
    });
  };

  // 打开添加对话框
  const handleOpenAddDialog = () => {
    setEditingTask(null);
    resetForm();
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleOpenEditDialog = (task: ScheduledTask) => {
    setEditingTask(task);
    setFormData({
      name: task.name,
      enabled: task.enabled,
      intervalDays: task.intervalDays,
      phoneNumber: task.phoneNumber,
      content: task.content,
    });
    setDialogOpen(true);
  };

  // 更新表单字段
  const updateFormField = (field: keyof TaskFormData, value: any) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  // 提交表单
  const handleSubmit = () => {
    // 验证必填字段
    if (!formData.name.trim()) {
      toast.warning('请输入任务名称');
      return;
    }
    if (!formData.intervalDays || formData.intervalDays <= 0) {
      toast.warning('请输入有效的执行间隔天数（必须大于0）');
      return;
    }
    if (!formData.phoneNumber.trim()) {
      toast.warning('请输入目标手机号');
      return;
    }
    if (!formData.content.trim()) {
      toast.warning('请输入短信内容');
      return;
    }

    if (editingTask) {
      // 更新任务
      updateMutation.mutate({ id: editingTask.id, task: formData });
    } else {
      // 创建任务
      createMutation.mutate(formData);
    }
  };

  // 删除任务
  const handleDeleteTask = (id: string) => {
    if (confirm('确定要删除这个任务吗？')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">定时任务配置</h2>
          <p className="text-gray-500 mt-2">配置定期发送短信的任务，例如每 90 天发送一次流量查询短信</p>
        </div>
        <Button onClick={handleOpenAddDialog}>
          <Plus className="w-4 h-4 mr-2" />
          添加任务
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">暂无任务，点击"添加任务"开始配置</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task, index) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">任务 #{index + 1}</CardTitle>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        task.enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {task.enabled ? '已启用' : '已禁用'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditDialog(task)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      编辑
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteTask(task.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      删除
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">任务名称：</span>
                    <span className="text-sm text-gray-900">{task.name}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">执行间隔：</span>
                    <span className="text-sm text-gray-900">{task.intervalDays} 天</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">目标手机号：</span>
                    <span className="text-sm text-gray-900">{task.phoneNumber}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">短信内容：</span>
                    <span className="text-sm text-gray-900">{task.content}</span>
                  </div>
                </div>

                {/* 显示任务执行信息 */}
                {task.lastRunAt && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-sm">
                      <span className="text-gray-500">上次执行：</span>
                      <span className="text-gray-900 ml-2">
                        {new Date(task.lastRunAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 添加/编辑任务对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? '编辑任务' : '添加任务'}</DialogTitle>
            <DialogDescription>
              {editingTask ? '修改定时任务的配置信息' : '创建新的定时短信任务'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 任务名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                任务名称 <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                placeholder="例如：90天流量查询"
              />
            </div>

            {/* 启用状态 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => updateFormField('enabled', e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                启用此任务
              </label>
            </div>

            {/* 执行间隔天数 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                执行间隔天数 <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                value={formData.intervalDays}
                onChange={(e) => updateFormField('intervalDays', parseInt(e.target.value) || 0)}
                placeholder="90"
              />
              <p className="text-xs text-gray-500 mt-1">
                例如：90 表示每90天执行一次，1 表示每天执行
              </p>
            </div>

            {/* 目标手机号 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                目标手机号 <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.phoneNumber}
                onChange={(e) => updateFormField('phoneNumber', e.target.value)}
                placeholder="10086"
              />
            </div>

            {/* 短信内容 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                短信内容 <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.content}
                onChange={(e) => updateFormField('content', e.target.value)}
                placeholder="查询流量"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditingTask(null);
                resetForm();
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? '提交中...'
                : editingTask
                ? '更新'
                : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
