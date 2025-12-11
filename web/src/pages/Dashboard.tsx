import { useEffect, useState } from 'react';
import { MessageSquare, Send, Inbox, TrendingUp } from 'lucide-react';
import { getStats } from '../api/messages';
import type { Stats } from '../api/types';

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const data = await getStats();
      setStats(data);
    } catch (error) {
      console.error('获取统计信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: '总短信数',
      value: stats?.totalCount || 0,
      icon: MessageSquare,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: '接收短信',
      value: stats?.incomingCount || 0,
      icon: Inbox,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: '发送短信',
      value: stats?.outgoingCount || 0,
      icon: Send,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: '今日短信',
      value: stats?.todayCount || 0,
      icon: TrendingUp,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">统计面板</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{card.title}</p>
                <p className={`text-3xl font-bold ${card.textColor}`}>{card.value}</p>
              </div>
              <div className={`${card.bgColor} p-3 rounded-lg`}>
                <card.icon className={`w-8 h-8 ${card.textColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">系统信息</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>• 自动接收短信并发送通知到配置的渠道</p>
          <p>• 支持定时发送短信</p>
          <p>• 支持手动发送短信和串口控制</p>
          <p>• 短信记录自动保存到数据库</p>
        </div>
      </div>
    </div>
  );
}
