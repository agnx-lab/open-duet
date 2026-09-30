'use client';

import React, { useEffect, useState } from 'react';
import { FiX, FiPlus } from 'react-icons/fi';
import { ALL_PROVIDERS } from './ModelPicker';

const MODEL_OPTIONS = ALL_PROVIDERS.flatMap((p) =>
  p.models.map((m) => ({ id: m.id, label: `${p.name} · ${m.name}` })),
);

/**
 * 页内「新建 Bot」表单。
 * 嵌进 Agnx Guest iframe 时 window.prompt 会静默返回 null，故禁止依赖系统对话框。
 */
export default function NewBotModal({
  isOpen,
  onClose,
  onSubmit,
  defaultModel = 'deepseek-chat',
}) {
  const [name, setName] = useState('New Assistant');
  const [role, setRole] = useState('General Intelligence');
  const [model, setModel] = useState(defaultModel);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName('New Assistant');
    setRole('General Intelligence');
    setModel(defaultModel || 'deepseek-chat');
    setSubmitting(false);
    setError('');
  }, [isOpen, defaultModel]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a bot name.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        name: trimmedName,
        role: role.trim() || 'AI Assistant',
        model: model.trim() || defaultModel || 'deepseek-chat',
      });
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to create bot.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none font-sans"
      data-testid="open-dots-new-bot-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-[#11131b] border border-[#222636] rounded-2xl shadow-2xl p-6 relative text-zinc-100 space-y-5"
        data-testid="open-dots-new-bot-form"
      >
        <div className="flex items-center justify-between border-b border-[#1d2130] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1a1d2c] text-emerald-400 border border-[#2b3048] flex items-center justify-center text-base shadow-sm">
              <FiPlus />
            </div>
            <div>
              <h2 className="text-xs font-bold text-zinc-100 tracking-wide">Create New Bot</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Name, role, and model — works inside Agnx Guest (no system prompt)
              </p>
            </div>
          </div>
          <button
            type="button"
            suppressHydrationWarning={true}
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-[#1a1d2c] rounded-lg transition disabled:opacity-40"
            title="Close"
          >
            <FiX />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium text-zinc-400">Name</span>
          <input
            data-testid="open-dots-new-bot-name"
            suppressHydrationWarning={true}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full bg-[#0c0e14] border border-[#2b3048] rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60"
            placeholder="New Assistant"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium text-zinc-400">Role</span>
          <input
            data-testid="open-dots-new-bot-role"
            suppressHydrationWarning={true}
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full bg-[#0c0e14] border border-[#2b3048] rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60"
            placeholder="General Intelligence"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium text-zinc-400">Model</span>
          <select
            data-testid="open-dots-new-bot-model"
            suppressHydrationWarning={true}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-[#0c0e14] border border-[#2b3048] rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/60"
          >
            {!MODEL_OPTIONS.some((m) => m.id === model) && model ? (
              <option value={model}>{model}</option>
            ) : null}
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <p
            className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2"
            data-testid="open-dots-new-bot-error"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            suppressHydrationWarning={true}
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-[#1a1d2c] rounded-lg transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="open-dots-new-bot-submit"
            suppressHydrationWarning={true}
            disabled={submitting}
            className="px-3.5 py-1.5 text-xs font-semibold text-zinc-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
