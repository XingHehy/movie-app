import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="bg-white/5 p-6 rounded-full mb-6">
        <AlertCircle size={64} className="text-red-500" />
      </div>
      <h1 className="text-4xl font-bold text-white mb-2">404</h1>
      <p className="text-slate-400 text-lg mb-8">
        抱歉，您访问的页面不存在
      </p>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
      >
        <Home size={20} />
        返回首页
      </button>
    </div>
  );
}
