import {type FormEvent, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '@/contexts/AuthContext';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Lock, User} from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const {login} = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading || !username || !password) {
            return;
        }

        setLoading(true);
        try {
            await login(username, password);
            navigate('/');
        } catch (error) {
            // 错误已在 AuthContext 中处理（toast）
        } finally {
            setLoading(false);
        }
    };

    const submitDisabled = loading || !username || !password;

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-10">
            <Card className="w-full max-w-md shadow-xl border border-slate-100">
                <CardHeader className="space-y-2 text-center pb-2">
                    <CardTitle className="text-3xl font-semibold tracking-tight text-slate-900 mt-6">
                        UART 短信转发器
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 pb-7 space-y-6">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label htmlFor="username" className="text-sm font-medium text-slate-800 block">
                                用户名
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="请输入用户名"
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    className="pl-10 h-11"
                                    disabled={loading}
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-slate-800 block">
                                密码
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="请输入密码"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className="pl-10 h-11"
                                    disabled={loading}
                                    required
                                    autoComplete="current-password"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 text-base font-medium cursor-pointer"
                            disabled={submitDisabled}
                        >
                            {loading ? '登录中...' : '登录'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
