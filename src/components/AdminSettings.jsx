import React, { useState, useEffect } from 'react';
import { X, Plus, RefreshCw, Edit, Trash2, Check, X as XIcon } from 'lucide-react';
import { api } from '../api.js';
import Toast from './Toast.jsx';

const AdminSettings = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('sources');
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showRedisSyncPreview, setShowRedisSyncPreview] = useState(false);
  const [redisSources, setRedisSources] = useState([]);
  const [editingSource, setEditingSource] = useState(null);
  const [newSource, setNewSource] = useState({ key: '', name: '', url: '', desc: '', enabled: false });
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success'); // success or error
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null
  });
  const [redisEditingSource, setRedisEditingSource] = useState(null);

  // Security settings state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState(null);
  const [securitySuccess, setSecuritySuccess] = useState(null);

  // Fetch sources when component opens
  useEffect(() => {
    if (isOpen && activeTab === 'sources') {
      fetchSources();
    }
  }, [isOpen, activeTab]);

  const openConfirmDialog = (message, onConfirm, title = '确认操作') => {
    setConfirmDialog({
      open: true,
      title,
      message,
      onConfirm
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      title: '',
      message: '',
      onConfirm: null
    });
  };

  const handleConfirmDialog = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    closeConfirmDialog();
  };

  const fetchSources = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all sources including disabled ones (need to use admin API)
      const data = await api.getSources();
      // Update the state with the fetched sources
      setSources(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = () => {
    const trimmed = {
      key: newSource.key.trim(),
      name: newSource.name.trim(),
      url: newSource.url.trim(),
      desc: newSource.desc.trim(),
      enabled: newSource.enabled
    };

    // Validate new source
    if (!trimmed.key || !trimmed.name || !trimmed.url) {
      setError('请填写所有必填字段');
      return;
    }

    // Check if source key already exists
    if (sources.some(source => source.key === trimmed.key)) {
      setError('源站标识已存在');
      return;
    }

    setError(null);
    const nextSources = [...sources, trimmed];
    setSources(nextSources);
    setNewSource({ key: '', name: '', url: '', desc: '', enabled: false });
    setShowAddSourceModal(false);
    // 保存
    handleSaveSources(nextSources, '新增源站成功');
  };

  const handleEditSource = (source) => {
    setEditingSource({ ...source });
  };

  const handleSaveEdit = () => {
    if (!editingSource) return;
    const trimmed = {
      ...editingSource,
      key: editingSource.key.trim(),
      name: editingSource.name.trim(),
      url: editingSource.url.trim(),
      desc: (editingSource.desc || '').trim()
    };
    // Validate edited source
    if (!trimmed.key || !trimmed.name || !trimmed.url) {
      setError('请填写所有必填字段');
      return;
    }

    const nextSources = sources.map(source =>
      source.key === editingSource.key ? trimmed : source
    );
    setSources(nextSources);
    setEditingSource(null);
    setError(null);
    // 自动保存配置
    handleSaveSources(nextSources, '源站已更新');
  };

  const handleDeleteSource = (sourceKey) => {
    openConfirmDialog(
      '确定要删除此源站吗？此操作不可恢复。',
      () => {
        setSources((prev) => {
          const next = prev.filter(source => source.key !== sourceKey);
          handleSaveSources(next, '已删除源站');
          return next;
        });
      },
      '删除源站'
    );
  };

  const handleToggleSource = (sourceKey) => {
    setSources((prev) => {
      const next = prev.map(source =>
        source.key === sourceKey ? { ...source, enabled: !source.enabled } : source
      );
      handleSaveSources(next, '源站状态已更新');
      return next;
    });
  };

  const moveSource = (sourceKey, direction) => {
    setSources((prev) => {
      const idx = prev.findIndex((s) => s.key === sourceKey);
      if (idx === -1) return prev;
      const swapWith = direction === 'up' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      handleSaveSources(next, '源站顺序已调整');
      return next;
    });
  };

  const handleSyncFromRedis = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getSourcesFromRedis();
      // 确保每个源站都有url字段
      const sourcesWithUrl = response.map(source => ({
        ...source,
        url: source.url || ""
      }));
      setRedisSources(sourcesWithUrl);
      setShowRedisSyncPreview(true);
    } catch (err) {
      setError(err.message);
      console.error('Error syncing from Redis:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRedisSync = () => {
    // 实现合并逻辑：根据key合并源站，保留现有源站的enabled状态
    const mergedSources = [...sources];

    redisSources.forEach(redisSource => {
      // 查找是否已存在相同key的源站
      const existingIndex = mergedSources.findIndex(s => s.key === redisSource.key);

      if (existingIndex !== -1) {
        // 如果存在，合并字段，保留enabled状态
        mergedSources[existingIndex] = {
          ...mergedSources[existingIndex],
          ...redisSource,
          // 保留现有enabled状态
          enabled: mergedSources[existingIndex].enabled
        };
      } else {
        // 如果不存在，添加新源站，默认禁用
        mergedSources.push({
          ...redisSource,
          enabled: false
        });
      }
    });

    setSources(mergedSources);
    setShowRedisSyncPreview(false);
    handleSaveSources(mergedSources, '已从Redis同步源站配置');
  };

  const handleSaveSources = async (nextSources = sources, successMessage = '源站配置已保存') => {
    setLoading(true);
    setError(null);
    try {
      await api.saveSources(nextSources, false);
      setToastType('success');
      setToastMessage(successMessage);
    } catch (err) {
      setError(err.message);
      setToastType('error');
      setToastMessage(err.message);
      console.error('Error saving sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAdminPassword = async () => {
    setSecurityLoading(true);
    try {
      // First verify current password
      const loginResponse = await api.login(currentPassword);
      if (!loginResponse.success) {
        throw new Error('当前密码错误');
      }

      await api.updateAdminPassword(newAdminPassword);
      setToastType('success');
      setToastMessage('管理员密码已更新');
      setCurrentPassword('');
      setNewAdminPassword('');
    } catch (err) {
      setToastType('error');
      setToastMessage(err.message);
      // 清空输入框，避免重复错误输入
      setCurrentPassword('');
      setNewAdminPassword('');
      console.error('Error updating admin password:', err);
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleUpdateUserPassword = async () => {
    setSecurityLoading(true);
    try {
      await api.updateUserPassword(newUserPassword);
      setToastType('success');
      setToastMessage('用户密码已更新');
      setNewUserPassword('');
    } catch (err) {
      setToastType('error');
      setToastMessage(err.message);
      console.error('Error updating user password:', err);
    } finally {
      setSecurityLoading(false);
    }
  };

  const totalSources = sources.length;
  const enabledCount = sources.filter((s) => s.enabled).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 9999px; }
        .custom-scroll::-webkit-scrollbar-track { background: #0f172a; }
        .custom-scroll { scrollbar-width: thin; scrollbar-color: #475569 #0f172a; }
      `}</style>
      <div className="w-full h-full flex items-center justify-center px-3 py-6">
        <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-5 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">管理员设置</h2>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('sources')}
            className={`flex-1 py-3 px-4 text-center text-sm font-medium transition-colors ${activeTab === 'sources' ? 'text-blue-400 bg-blue-600/20 border-b-2 border-blue-500' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
          >
            视频源管理
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-3 px-4 text-center text-sm font-medium transition-colors ${activeTab === 'security' ? 'text-blue-400 bg-blue-600/20 border-b-2 border-blue-500' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
          >
            安全设置
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-5">
          {/* Sources Tab */}
          {activeTab === 'sources' && (
            <div>
              {/* Error and Success Messages */}
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-500/20 text-green-400 rounded-lg text-sm">
                  {success}
                </div>
              )}

              {/* Sources Table */}
              <div className="overflow-x-auto max-h-[60vh] custom-scroll">
                <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-white flex items-center gap-3">
                      源站列表
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-200">
                        共 {totalSources} 个 / 启用 {enabledCount}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">可通过右侧按钮快速同步或新增源站</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSyncFromRedis}
                      disabled={loading}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      title="从Redis同步"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      onClick={() => setShowAddSourceModal(true)}
                      className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center justify-center"
                      title="添加源站"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider w-12">#</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">标识</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">名称</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">URL</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">描述</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">状态</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source, index) => (
                      <tr key={source.key} className="border-b border-white/10 hover:bg-slate-700/50 transition-colors">
                        <td className="py-3 px-4 text-sm text-slate-400">{index + 1}</td>
                        <td className="py-3 px-4 text-sm text-slate-300 font-mono text-slate-200">
                          {source.key}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-200 font-medium min-w-[160px]">{source.name}</td>
                        <td className="py-3 px-4 text-sm text-slate-300 truncate max-w-xs break-all">
                          {source.url}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-300 truncate max-w-xs">{source.desc || '-'}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleSource(source.key)}
                            className={`p-1 rounded hover:bg-slate-700 transition-colors ${source.enabled ? 'text-green-400' : 'text-red-400'}`}
                            title={source.enabled ? '禁用' : '启用'}
                          >
                            {source.enabled ? <Check size={14} /> : <XIcon size={14} />}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => moveSource(source.key, 'up')}
                              className="p-1 text-slate-300 hover:bg-slate-700 rounded transition-colors"
                              title="上移"
                              disabled={sources[0]?.key === source.key}
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveSource(source.key, 'down')}
                              className="p-1 text-slate-300 hover:bg-slate-700 rounded transition-colors"
                              title="下移"
                              disabled={sources[sources.length - 1]?.key === source.key}
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => handleEditSource(source)}
                              className="p-1 text-blue-400 hover:bg-slate-700 rounded transition-colors"
                              title="编辑"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteSource(source.key)}
                              className="p-1 text-red-400 hover:bg-slate-700 rounded transition-colors"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add Source Modal */}
              {showAddSourceModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
                  <div className="w-full h-full flex items-center justify-center px-3 py-6">
                    <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5">
                    <h3 className="text-lg font-medium mb-4 text-white">添加新源站</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">标识 (key)</label>
                        <input
                          type="text"
                          value={newSource.key}
                          onChange={(e) => setNewSource({ ...newSource, key: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="唯一标识"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">名称</label>
                        <input
                          type="text"
                          value={newSource.name}
                          onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="源站名称"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">URL</label>
                        <input
                          type="text"
                          value={newSource.url}
                          onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="源站URL"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">描述</label>
                        <input
                          type="text"
                          value={newSource.desc}
                          onChange={(e) => setNewSource({ ...newSource, desc: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="源站描述"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="new-source-enabled"
                          checked={newSource.enabled}
                          onChange={(e) => setNewSource({ ...newSource, enabled: e.target.checked })}
                          className="rounded text-blue-500 focus:ring-blue-500"
                        />
                        <label htmlFor="new-source-enabled" className="text-xs text-slate-300">启用</label>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-5 justify-end">
                      <button
                        onClick={() => {
                          setShowAddSourceModal(false);
                          setNewSource({ key: '', name: '', url: '', desc: '', enabled: false });
                          setError(null);
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleAddSource}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                      >
                        <Plus size={14} />
                        添加源站
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {/* Edit Source Modal */}
              {editingSource && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
                  <div className="w-full h-full flex items-center justify-center px-3 py-6">
                    <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5">
                    <h3 className="text-lg font-medium mb-4 text-white">编辑源站</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">标识 (key)</label>
                        <input
                          type="text"
                          value={editingSource.key}
                          onChange={(e) => setEditingSource({ ...editingSource, key: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="唯一标识"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">名称</label>
                        <input
                          type="text"
                          value={editingSource.name}
                          onChange={(e) => setEditingSource({ ...editingSource, name: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="源站名称"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">URL</label>
                        <input
                          type="text"
                          value={editingSource.url}
                          onChange={(e) => setEditingSource({ ...editingSource, url: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="源站URL"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">描述</label>
                        <input
                          type="text"
                          value={editingSource.desc}
                          onChange={(e) => setEditingSource({ ...editingSource, desc: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="源站描述"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="edit-source-enabled"
                          checked={editingSource.enabled}
                          onChange={(e) => setEditingSource({ ...editingSource, enabled: e.target.checked })}
                          className="rounded text-blue-500 focus:ring-blue-500"
                        />
                        <label htmlFor="edit-source-enabled" className="text-xs text-slate-300">启用</label>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-5 justify-end">
                      <button
                        onClick={() => setEditingSource(null)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              )}

              {/* Edit Redis Source Modal */}
              {redisEditingSource && (
                <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm">
                  <div className="w-full h-full flex items-center justify-center px-3 py-6">
                    <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-5">
                    <h3 className="text-lg font-medium mb-4 text-white">编辑预览源站</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">标识 (key)</label>
                        <input
                          type="text"
                          value={redisEditingSource.key}
                          onChange={(e) => setRedisEditingSource({ ...redisEditingSource, key: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="唯一标识"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">名称</label>
                        <input
                          type="text"
                          value={redisEditingSource.name}
                          onChange={(e) => setRedisEditingSource({ ...redisEditingSource, name: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="源站名称"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">URL</label>
                        <input
                          type="text"
                          value={redisEditingSource.url}
                          onChange={(e) => setRedisEditingSource({ ...redisEditingSource, url: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="源站URL"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">描述</label>
                        <input
                          type="text"
                          value={redisEditingSource.desc || ''}
                          onChange={(e) => setRedisEditingSource({ ...redisEditingSource, desc: e.target.value })}
                          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="源站描述"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="redis-edit-source-enabled"
                          checked={redisEditingSource.enabled !== false}
                          onChange={(e) => setRedisEditingSource({ ...redisEditingSource, enabled: e.target.checked })}
                          className="rounded text-blue-500 focus:ring-blue-500"
                        />
                        <label htmlFor="redis-edit-source-enabled" className="text-xs text-slate-300">启用</label>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-5 justify-end">
                      <button
                        onClick={() => setRedisEditingSource(null)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => {
                          const trimmed = {
                            ...redisEditingSource,
                            key: redisEditingSource.key.trim(),
                            name: redisEditingSource.name.trim(),
                            url: redisEditingSource.url.trim(),
                            desc: (redisEditingSource.desc || '').trim(),
                            enabled: redisEditingSource.enabled !== false
                          };
                          if (!trimmed.key || !trimmed.name || !trimmed.url) {
                            setToastType('error');
                            setToastMessage('请填写必填字段');
                            return;
                          }
                          setRedisSources((prev) =>
                            prev.map((s) => (s.key === redisEditingSource.key ? trimmed : s))
                          );
                          setRedisEditingSource(null);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              )}

            {/* Redis Sync Preview */}
            {showRedisSyncPreview && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
                <div className="w-full h-full flex items-center justify-center px-3 py-6">
                  <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <div className="flex justify-between items-center p-5 border-b border-white/10">
                      <h3 className="text-lg font-medium text-white">预览</h3>
                      <button
                        onClick={() => setShowRedisSyncPreview(false)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="flex-1 p-5">
                      <p className="text-sm text-slate-300 mb-4">从 Redis 同步以下源站配置？系统将根据源站标识(key)进行合并同步，已存在的源站会显示差异。</p>
                      <div className="overflow-x-auto max-h-[60vh] custom-scroll">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider w-12">#</th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">标识</th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">名称</th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">URL</th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">描述</th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {redisSources.map((source, index) => {
                              // 查找现有源站，比较字段差异
                              const existingSource = sources.find(s => s.key === source.key);
                              return (
                                <tr key={source.key} className="border-b border-white/10 hover:bg-slate-700/50 transition-colors">
                                  <td className="py-3 px-4 text-sm text-slate-400">{index + 1}</td>
                                  <td className="py-3 px-4 text-sm">
                                    <span className={existingSource ? 'text-yellow-400' : 'text-slate-300'}>
                                      {source.key}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-sm">
                                    <span className={existingSource?.name !== source.name ? 'text-blue-400 font-medium' : 'text-slate-300'}>
                                      {source.name}
                                      {existingSource?.name !== source.name && existingSource?.name && (
                                        <span className="text-xs text-slate-500 ml-2">({existingSource.name})</span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-sm">
                                    <span className={existingSource?.url !== source.url ? 'text-blue-400 font-medium' : 'text-slate-300'}>
                                      <span className="truncate max-w-xs">{source.url}</span>
                                      {existingSource?.url !== source.url && existingSource?.url && (
                                        <div className="text-xs text-slate-500 truncate">({existingSource.url})</div>
                                      )}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-sm">
                                    <span className={existingSource?.desc !== source.desc ? 'text-blue-400 font-medium' : 'text-slate-300'}>
                                      <span className="truncate max-w-xs">{source.desc || '-'}</span>
                                      {existingSource?.desc !== source.desc && existingSource?.desc && (
                                        <div className="text-xs text-slate-500 truncate">({existingSource.desc})</div>
                                      )}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setRedisEditingSource({ ...source });
                                        }}
                                        className="p-1 text-blue-400 hover:bg-slate-700 rounded transition-colors"
                                        title="编辑"
                                      >
                                        <Edit size={14} />
                                      </button>
                                      <button
                                        onClick={() => {
                                          // 删除源站
                                          openConfirmDialog(
                                            '确定要删除此源站吗？此操作不可恢复。',
                                            () => {
                                              setRedisSources((prev) => prev.filter((s) => s.key !== source.key));
                                            },
                                            '删除源站'
                                          );
                                        }}
                                        className="p-1 text-red-400 hover:bg-slate-700 rounded transition-colors"
                                        title="删除"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="flex gap-2 p-5 border-t border-white/10 justify-end">
                      <button
                        onClick={() => setShowRedisSyncPreview(false)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleConfirmRedisSync}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm"
                      >
                        确认同步
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              {/* Error and Success Messages */}
              {securityError && (
                <div className="p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">{securityError}</div>
              )}
              {securitySuccess && (
                <div className="p-3 bg-green-500/20 text-green-400 rounded-lg text-sm">{securitySuccess}</div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Admin password card */}
                <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5 shadow-inner space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">管理员密码</h3>
                      <p className="text-xs text-slate-400 mt-1">仅管理员账户可登录和管理源站</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">当前管理员密码</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                        placeholder="请输入当前密码"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">新管理员密码</label>
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                        placeholder="请输入新密码"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>建议使用 8 位以上强密码</span>
                    <button
                      onClick={handleUpdateAdminPassword}
                      disabled={securityLoading || !currentPassword || !newAdminPassword}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {securityLoading ? '修改中...' : '修改管理员密码'}
                    </button>
                  </div>
                </div>

                {/* User password card */}
                <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5 shadow-inner space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">用户访问密码</h3>
                      <p className="text-xs text-slate-400 mt-1">用户登录访问站点所需密码</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">新用户密码</label>
                      <input
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                        placeholder="请输入新的用户访问密码"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>更新后需告知普通用户新密码</span>
                    <button
                      onClick={handleUpdateUserPassword}
                      disabled={securityLoading || !newUserPassword}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {securityLoading ? '修改中...' : '修改用户密码'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-[250] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <p className="text-sm text-white font-medium">{confirmDialog.title || '确认操作'}</p>
                <p className="text-xs text-slate-400 mt-1">{confirmDialog.message}</p>
              </div>
              <button
                onClick={closeConfirmDialog}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 flex justify-end gap-3">
              <button
                onClick={closeConfirmDialog}
                className="px-4 py-2 text-sm rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDialog}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage(null)}
        duration={2200}
      />
    </div>
    </div>
  );
};

export default AdminSettings;