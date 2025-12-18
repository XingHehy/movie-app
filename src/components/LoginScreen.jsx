import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api.js';
import Toast from './Toast.jsx';

const LoginScreen = ({ onLogin }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showClown, setShowClown] = useState(false);

  // 预加载小丑图片 - 在浏览器空闲时进行，不影响初始加载
  useEffect(() => {
    const preloadImage = () => {
      const img = new Image();
      img.src = "/joker.gif";
    };

    // 使用requestIdleCallback确保在浏览器空闲时才预加载
    if (window.requestIdleCallback) {
      const idleCallbackId = window.requestIdleCallback(preloadImage);
      return () => window.cancelIdleCallback(idleCallbackId);
    } else {
      // 兼容不支持requestIdleCallback的浏览器
      const timeoutId = setTimeout(preloadImage, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError(null);
    setShowClown(false);

    try {
      const data = await api.login(password);

      if (data?.success) {
        onLogin(data.role); // 传递用户角色
      } else {
        setError("密码错误，请重试");
        setToastMessage("密码错误，请重试");
        setShowClown(true);
        setTimeout(() => setShowClown(false), 3000);
      }
    } catch (err) {
      console.error('登录失败:', err);
      setError("验证失败，请稍后重试");
      setToastMessage("验证失败，请稍后重试");
      setShowClown(true);
      setTimeout(() => setShowClown(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1014] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-blue-500/50">
            <Lock size={32} className="text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">访问验证</h1>
          <p className="text-slate-400 mt-2">请输入访问密码以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              className="w-full bg-black/30 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-center tracking-widest text-lg"
              autoFocus
            />
          </div>

          {error && (
            <div className="flex items-center justify-center gap-2 text-red-400 text-sm bg-red-500/10 py-2 rounded-lg">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : "解锁进入"}
          </button>
        </form>
      </div>
      <p className="mt-8 text-slate-600 text-xs">© 2025 极影</p>

      {/* 小丑动效 */}
      {showClown && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] pointer-events-none bg-black/20 backdrop-blur-[1px] transition-all duration-300">
          <div className="relative animate-clown-pop">
            <img
              src="/joker.gif"
              alt="joker"
              className="w-[180px] h-[180px] object-contain filter drop-shadow-2xl"
            />
          </div>
        </div>
      )}

      <Toast
        message={toastMessage}
        onClose={() => setToastMessage("")}
      />
    </div>
  );
};

export default LoginScreen;

