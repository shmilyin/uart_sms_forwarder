import {Link, Outlet, useLocation, useNavigate} from 'react-router-dom';
import {Bell, Clock, LayoutDashboard, LogOut, MessageSquare, Smartphone} from 'lucide-react';
import {Button} from "@/components/ui/button.tsx";
import {useAuth} from "@/contexts/AuthContext.tsx";
import {useQuery} from "@tanstack/react-query";
import {getVersion} from "@/api/property.ts";

export default function Layout() {
    const location = useLocation();
    const navigate = useNavigate();
    const {username, logout} = useAuth();

    const navigation = [
        {name: '统计面板', href: '/', icon: LayoutDashboard},
        {name: '短信记录', href: '/messages', icon: MessageSquare},
        {name: '串口控制', href: '/serial', icon: Smartphone},
        {name: '通知渠道', href: '/notifications', icon: Bell},
        {name: '定时任务', href: '/scheduled-tasks', icon: Clock},
    ];

    // 获取版本信息
    let versionQuery = useQuery({
        queryKey: ['version'],
        queryFn: getVersion,
    });

    const isActive = (path: string) => {
        if (path === '/') {
            return location.pathname === '/';
        }
        return location.pathname.startsWith(path);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* 顶部导航栏 */}
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <h1 className="text-xl font-bold text-gray-900">
                                    UART 短信转发器
                                </h1>
                            </div>
                            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                                {navigation.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item.href);
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            className={`${
                                                active
                                                    ? 'border-blue-500 text-gray-900'
                                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                            } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                                        >
                                            <Icon className="w-4 h-4 mr-2"/>
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="hidden sm:flex sm:items-center sm:space-x-3">
                            <span className="text-sm text-gray-700">
                                用户：<span className="font-medium">{username}</span>
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLogout}
                                className="text-gray-700 hover:text-gray-900"
                            >
                                <LogOut className="w-4 h-4 mr-2"/>
                                登出
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 移动端导航 */}
                <div className="sm:hidden border-t border-gray-200">
                    <div className="flex justify-around py-2">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    className={`${
                                        active ? 'text-blue-600' : 'text-gray-500'
                                    } flex flex-col items-center px-3 py-2 text-xs font-medium transition-colors`}
                                >
                                    <Icon className="w-6 h-6 mb-1"/>
                                    {item.name}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>

            {/* 主要内容区域 */}
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
                <Outlet/>
            </main>

            {/* 页脚 */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="text-center text-sm text-gray-500">
                        <p>UART 短信转发器 © 2025 版权所有 dushixiang - {versionQuery.data?.version}</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
