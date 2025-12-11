import {useEffect, useState} from 'react';
import {RefreshCw, Trash2} from 'lucide-react';
import {toast} from 'sonner';
import {clearMessages, deleteMessage, getMessages} from '../api/messages';
import type {ListQuery, TextMessage} from '../api/types';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from '@/components/ui/select';

export default function Messages() {
    const [messages, setMessages] = useState<TextMessage[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState<ListQuery>({
        pageIndex: 1,
        pageSize: 100,
    });

    useEffect(() => {
        loadMessages();
    }, [query]);

    const loadMessages = async () => {
        setLoading(true);
        try {
            const data = await getMessages(query);
            setMessages(data.items || []);
            setTotal(data.total);
        } catch (error) {
            console.error('获取短信列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这条短信吗？')) return;

        try {
            await deleteMessage(id);
            toast.success('删除成功');
            loadMessages();
        } catch (error) {
            console.error('删除失败:', error);
            toast.error('删除失败');
        }
    };

    const handleClear = async () => {
        if (!confirm('确定要清空所有短信吗？此操作不可恢复！')) return;

        try {
            await clearMessages();
            toast.success('清空成功');
            loadMessages();
        } catch (error) {
            console.error('清空失败:', error);
            toast.error('清空失败');
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('zh-CN');
    };

    const getTypeLabel = (type: string) => {
        return type === 'incoming' ? '接收' : '发送';
    };

    const getTypeBadgeClass = (type: string) => {
        return type === 'incoming'
            ? 'bg-green-100 text-green-800'
            : 'bg-blue-100 text-blue-800';
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'received':
                return 'bg-green-100 text-green-800';
            case 'sent':
                return 'bg-blue-100 text-blue-800';
            case 'failed':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const totalPages = Math.ceil(total / (query.pageSize || 100));

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">短信记录</h1>
                <div className="flex gap-2">
                    <Button
                        onClick={loadMessages}
                        variant="outline"
                    >
                        <RefreshCw className="w-4 h-4 mr-2"/>
                        刷新
                    </Button>
                    <Button
                        onClick={handleClear}
                        variant="destructive"
                    >
                        <Trash2 className="w-4 h-4 mr-2"/>
                        清空
                    </Button>
                </div>
            </div>

            {/* 筛选器 */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            类型
                        </label>
                        <Select
                            value={query.type || 'all'}
                            onValueChange={(value) => setQuery({
                                ...query,
                                type: value === 'all' ? undefined : value,
                                pageIndex: 1
                            })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="全部"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部</SelectItem>
                                <SelectItem value="incoming">接收</SelectItem>
                                <SelectItem value="outgoing">发送</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            发送方
                        </label>
                        <Input
                            type="text"
                            value={query.from || ''}
                            onChange={(e) => setQuery({...query, from: e.target.value, pageIndex: 1})}
                            placeholder="输入手机号"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            接收方
                        </label>
                        <Input
                            type="text"
                            value={query.to || ''}
                            onChange={(e) => setQuery({...query, to: e.target.value, pageIndex: 1})}
                            placeholder="输入手机号"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            内容搜索
                        </label>
                        <Input
                            type="text"
                            value={query.content || ''}
                            onChange={(e) => setQuery({...query, content: e.target.value, pageIndex: 1})}
                            placeholder="输入短信内容关键词"
                        />
                    </div>
                </div>
            </div>

            {/* 短信列表 */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500">暂无短信记录</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        类型
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        发送方
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        接收方
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        内容
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        状态
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        时间
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        操作
                                    </th>
                                </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                {messages.map((msg) => (
                                    <tr key={msg.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                        <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadgeClass(msg.type)}`}>
                          {getTypeLabel(msg.type)}
                        </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {msg.from || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {msg.to || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                                            {msg.content}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                        <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClass(msg.status)}`}>
                          {msg.status}
                        </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatTime(msg.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Button
                                                onClick={() => handleDelete(msg.id)}
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 className="w-4 h-4"/>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>

                        {/* 分页 */}
                        <div
                            className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <Button
                                    onClick={() => setQuery({...query, pageIndex: (query.pageIndex || 1) - 1})}
                                    disabled={(query.pageIndex || 1) <= 1}
                                    variant="outline"
                                >
                                    上一页
                                </Button>
                                <Button
                                    onClick={() => setQuery({...query, pageIndex: (query.pageIndex || 1) + 1})}
                                    disabled={(query.pageIndex || 1) >= totalPages}
                                    variant="outline"
                                >
                                    下一页
                                </Button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        显示 <span
                                        className="font-medium">{((query.pageIndex || 1) - 1) * (query.pageSize || 100) + 1}</span> 到{' '}
                                        <span className="font-medium">
                      {Math.min((query.pageIndex || 1) * (query.pageSize || 100), total)}
                    </span>{' '}
                                        条，共 <span className="font-medium">{total}</span> 条
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex items-center gap-2">
                                        <Button
                                            onClick={() => setQuery({...query, pageIndex: (query.pageIndex || 1) - 1})}
                                            disabled={(query.pageIndex || 1) <= 1}
                                            variant="outline"
                                            size="sm"
                                        >
                                            上一页
                                        </Button>
                                        <span
                                            className="relative inline-flex items-center px-4 py-1 border border-input bg-background text-sm font-medium text-foreground rounded-md">
                      {query.pageIndex || 1} / {totalPages}
                    </span>
                                        <Button
                                            onClick={() => setQuery({...query, pageIndex: (query.pageIndex || 1) + 1})}
                                            disabled={(query.pageIndex || 1) >= totalPages}
                                            variant="outline"
                                            size="sm"
                                        >
                                            下一页
                                        </Button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
