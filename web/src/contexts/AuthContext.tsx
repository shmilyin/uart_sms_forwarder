import {createContext, type ReactNode, useContext, useEffect, useState} from 'react';
import * as authApi from '@/api/auth';
import {toast} from 'sonner';

interface AuthContextType {
    token: string | null;
    username: string | null;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 初始化时从 localStorage 恢复 token
    useEffect(() => {
        const savedToken = localStorage.getItem('token');
        const savedUsername = localStorage.getItem('username');
        if (savedToken && savedUsername) {
            setToken(savedToken);
            setUsername(savedUsername);
        }
        setIsLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        try {
            const response = await authApi.login({username, password});

            // 保存到 localStorage
            localStorage.setItem('token', response.token);
            localStorage.setItem('username', response.username);

            // 更新状态
            setToken(response.token);
            setUsername(response.username);

            toast.success('登录成功');
        } catch (error) {
            toast.error('登录失败：' + (error instanceof Error ? error.message : '未知错误'));
            throw error;
        }
    };

    const logout = () => {
        // 清除 localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('username');

        // 清除状态
        setToken(null);
        setUsername(null);

        toast.success('已退出登录');
    };

    return (
        <AuthContext.Provider
            value={{
                token,
                username,
                login,
                logout,
                isLoading,
                isAuthenticated: !!token,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
