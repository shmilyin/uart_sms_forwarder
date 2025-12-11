import {useEffect, useState} from 'react';
import {Bell, TestTube} from 'lucide-react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from '@/components/ui/select';
import {Textarea} from '@/components/ui/textarea';
import {
    getNotificationChannels,
    type NotificationChannel,
    saveNotificationChannels,
    testNotificationChannel
} from "@/api/property.ts";

interface FormValues {
    // 钉钉
    dingtalkEnabled: boolean;
    dingtalkSecretKey: string;
    dingtalkSignSecret: string;

    // 企业微信
    wecomEnabled: boolean;
    wecomSecretKey: string;

    // 飞书
    feishuEnabled: boolean;
    feishuSecretKey: string;
    feishuSignSecret: string;

    // Webhook
    webhookEnabled: boolean;
    webhookUrl: string;
    webhookMethod: string;
    webhookHeaders: string;
}

export default function NotificationChannels() {
    const queryClient = useQueryClient();
    const [formValues, setFormValues] = useState<FormValues>({
        dingtalkEnabled: false,
        dingtalkSecretKey: '',
        dingtalkSignSecret: '',
        wecomEnabled: false,
        wecomSecretKey: '',
        feishuEnabled: false,
        feishuSecretKey: '',
        feishuSignSecret: '',
        webhookEnabled: false,
        webhookUrl: '',
        webhookMethod: 'POST',
        webhookHeaders: '',
    });

    // 获取通知渠道列表
    const {data: channels = [], isLoading} = useQuery({
        queryKey: ['notificationChannels'],
        queryFn: getNotificationChannels,
    });

    // 保存 mutation
    const saveMutation = useMutation({
        mutationFn: saveNotificationChannels,
        onSuccess: () => {
            toast.success('保存成功');
            queryClient.invalidateQueries({queryKey: ['notificationChannels']});
        },
        onError: (error: unknown) => {
            console.error('保存失败:', error);
            toast.error('保存失败');
        },
    });

    // 测试 mutation
    const testMutation = useMutation({
        mutationFn: testNotificationChannel,
        onSuccess: () => {
            toast.success('测试通知已发送，请检查对应渠道');
        },
        onError: (error: unknown) => {
            console.error('测试失败:', error);
            toast.error('测试失败，请检查配置');
        },
    });

    // 将渠道数组转换为表单值
    useEffect(() => {
        if (channels.length > 0) {
            const newFormValues: FormValues = {...formValues};

            channels.forEach((channel) => {
                if (channel.type === 'dingtalk') {
                    newFormValues.dingtalkEnabled = channel.enabled;
                    newFormValues.dingtalkSecretKey = (channel.config?.secretKey as string) || '';
                    newFormValues.dingtalkSignSecret = (channel.config?.signSecret as string) || '';
                } else if (channel.type === 'wecom') {
                    newFormValues.wecomEnabled = channel.enabled;
                    newFormValues.wecomSecretKey = (channel.config?.secretKey as string) || '';
                } else if (channel.type === 'feishu') {
                    newFormValues.feishuEnabled = channel.enabled;
                    newFormValues.feishuSecretKey = (channel.config?.secretKey as string) || '';
                    newFormValues.feishuSignSecret = (channel.config?.signSecret as string) || '';
                } else if (channel.type === 'webhook') {
                    newFormValues.webhookEnabled = channel.enabled;
                    newFormValues.webhookUrl = (channel.config?.url as string) || '';
                    newFormValues.webhookMethod = (channel.config?.method as string) || 'POST';

                    // 解析 headers 为 JSON 字符串
                    const headers = channel.config?.headers || {};
                    newFormValues.webhookHeaders = JSON.stringify(headers, null, 2);
                }
            });

            setFormValues(newFormValues);
        }
    }, [channels]);

    // 更新表单字段
    const updateField = (field: keyof FormValues, value: any) => {
        setFormValues((prev) => ({...prev, [field]: value}));
    };

    // 保存配置
    const handleSave = async () => {
        const newChannels: NotificationChannel[] = [];

        // 钉钉
        if (formValues.dingtalkEnabled || formValues.dingtalkSecretKey) {
            newChannels.push({
                type: 'dingtalk',
                enabled: formValues.dingtalkEnabled,
                config: {
                    secretKey: formValues.dingtalkSecretKey,
                    signSecret: formValues.dingtalkSignSecret,
                },
            });
        }

        // 企业微信
        if (formValues.wecomEnabled || formValues.wecomSecretKey) {
            newChannels.push({
                type: 'wecom',
                enabled: formValues.wecomEnabled,
                config: {
                    secretKey: formValues.wecomSecretKey,
                },
            });
        }

        // 飞书
        if (formValues.feishuEnabled || formValues.feishuSecretKey) {
            newChannels.push({
                type: 'feishu',
                enabled: formValues.feishuEnabled,
                config: {
                    secretKey: formValues.feishuSecretKey,
                    signSecret: formValues.feishuSignSecret,
                },
            });
        }

        // Webhook
        if (formValues.webhookEnabled || formValues.webhookUrl) {
            let headers = {};
            if (formValues.webhookHeaders) {
                try {
                    headers = JSON.parse(formValues.webhookHeaders);
                } catch (err) {
                    toast.error('Webhook Headers JSON 格式错误');
                    return;
                }
            }

            newChannels.push({
                type: 'webhook',
                enabled: formValues.webhookEnabled,
                config: {
                    url: formValues.webhookUrl,
                    method: formValues.webhookMethod,
                    headers: Object.keys(headers).length > 0 ? headers : undefined,
                },
            });
        }

        saveMutation.mutate(newChannels);
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
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Bell className="w-6 h-6"/>
                    通知渠道管理
                </h1>
            </div>

            <div className="space-y-4">
                {/* 钉钉通知 */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>钉钉通知</CardTitle>
                                <CardDescription className="mt-1">
                                    了解更多：
                                    <a
                                        href="https://open.dingtalk.com/document/robots/custom-robot-access"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline ml-1"
                                    >
                                        钉钉自定义机器人接入文档
                                    </a>
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!formValues.dingtalkEnabled || testMutation.isPending}
                                onClick={() => testMutation.mutate('dingtalk')}
                            >
                                <TestTube className="w-4 h-4 mr-2"/>
                                {testMutation.isPending ? '测试中...' : '测试'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formValues.dingtalkEnabled}
                                onChange={(e) => updateField('dingtalkEnabled', e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            <label className="text-sm font-medium">启用钉钉通知</label>
                        </div>

                        {formValues.dingtalkEnabled && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        访问令牌 (Access Token) <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={formValues.dingtalkSecretKey}
                                        onChange={(e) => updateField('dingtalkSecretKey', e.target.value)}
                                        placeholder="在钉钉机器人配置中获取的 access_token"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        加签密钥（可选）
                                    </label>
                                    <Input
                                        type="password"
                                        value={formValues.dingtalkSignSecret}
                                        onChange={(e) => updateField('dingtalkSignSecret', e.target.value)}
                                        placeholder="SEC 开头的加签密钥"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">如果启用了加签，请填写 SEC 开头的密钥</p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 企业微信通知 */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>企业微信通知</CardTitle>
                                <CardDescription className="mt-1">
                                    了解更多：
                                    <a
                                        href="https://work.weixin.qq.com/api/doc/90000/90136/91770"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline ml-1"
                                    >
                                        企业微信群机器人配置说明
                                    </a>
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!formValues.wecomEnabled || testMutation.isPending}
                                onClick={() => testMutation.mutate('wecom')}
                            >
                                <TestTube className="w-4 h-4 mr-2"/>
                                {testMutation.isPending ? '测试中...' : '测试'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formValues.wecomEnabled}
                                onChange={(e) => updateField('wecomEnabled', e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            <label className="text-sm font-medium">启用企业微信通知</label>
                        </div>

                        {formValues.wecomEnabled && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Webhook Key <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    value={formValues.wecomSecretKey}
                                    onChange={(e) => updateField('wecomSecretKey', e.target.value)}
                                    placeholder="企业微信群机器人的 Webhook Key"
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 飞书通知 */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>飞书通知</CardTitle>
                                <CardDescription className="mt-1">
                                    了解更多：
                                    <a
                                        href="https://www.feishu.cn/hc/zh-CN/articles/360024984973"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline ml-1"
                                    >
                                        在群组中使用机器人
                                    </a>
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!formValues.feishuEnabled || testMutation.isPending}
                                onClick={() => testMutation.mutate('feishu')}
                            >
                                <TestTube className="w-4 h-4 mr-2"/>
                                {testMutation.isPending ? '测试中...' : '测试'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formValues.feishuEnabled}
                                onChange={(e) => updateField('feishuEnabled', e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            <label className="text-sm font-medium">启用飞书通知</label>
                        </div>

                        {formValues.feishuEnabled && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Webhook Token <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={formValues.feishuSecretKey}
                                        onChange={(e) => updateField('feishuSecretKey', e.target.value)}
                                        placeholder="飞书群机器人的 Webhook Token"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        签名密钥（可选）
                                    </label>
                                    <Input
                                        type="password"
                                        value={formValues.feishuSignSecret}
                                        onChange={(e) => updateField('feishuSignSecret', e.target.value)}
                                        placeholder="如果启用了签名验证，请填写密钥"
                                    />
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 自定义 Webhook */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>自定义 Webhook</CardTitle>
                                <CardDescription className="mt-1">
                                    配置自定义 HTTP 回调接口接收短信通知
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!formValues.webhookEnabled || testMutation.isPending}
                                onClick={() => testMutation.mutate('webhook')}
                            >
                                <TestTube className="w-4 h-4 mr-2"/>
                                {testMutation.isPending ? '测试中...' : '测试'}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formValues.webhookEnabled}
                                onChange={(e) => updateField('webhookEnabled', e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            <label className="text-sm font-medium">启用自定义 Webhook</label>
                        </div>

                        {formValues.webhookEnabled && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Webhook URL <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        value={formValues.webhookUrl}
                                        onChange={(e) => updateField('webhookUrl', e.target.value)}
                                        placeholder="https://your-server.com/webhook"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">HTTP 方法</label>
                                    <Select
                                        value={formValues.webhookMethod}
                                        onValueChange={(value) => updateField('webhookMethod', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="GET">GET</SelectItem>
                                            <SelectItem value="POST">POST</SelectItem>
                                            <SelectItem value="PUT">PUT</SelectItem>
                                            <SelectItem value="PATCH">PATCH</SelectItem>
                                            <SelectItem value="DELETE">DELETE</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        自定义请求头 (JSON 格式)
                                    </label>
                                    <Textarea
                                        value={formValues.webhookHeaders}
                                        onChange={(e) => updateField('webhookHeaders', e.target.value)}
                                        placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
                                        rows={4}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        可选，格式为 JSON 对象，例如: {`{"key": "value"}`}
                                    </p>
                                </div>

                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="text-sm font-semibold text-blue-900 mb-2">请求格式说明：</div>
                                    <div className="text-xs text-blue-800 space-y-1">
                                        <p>POST 请求将发送以下 JSON 数据：</p>
                                        <pre className="bg-white border rounded p-2 mt-2 overflow-x-auto">
{`{
  "from": "发送方手机号",
  "to": "接收方手机号",
  "content": "短信内容",
  "timestamp": 1234567890000
}`}
                    </pre>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 保存按钮 */}
                <div className="">
                    <Button onClick={handleSave} disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? '保存中...' : '保存配置'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
