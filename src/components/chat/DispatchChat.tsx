import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, AlertTriangle, Radio } from 'lucide-react';
import { useFuelStore } from '../../context/FuelDataContext';

export const DispatchChat: React.FC = () => {
  const { t } = useTranslation(['chat', 'common']);
  const { messages, addMessage } = useFuelStore();
  const [inputText, setInputText] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    addMessage(inputText.trim(), isEmergency);
    setInputText('');
    setIsEmergency(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Radio className="w-6 h-6 text-blue-600 animate-pulse" />
            <span>{t('chat:dispatch.title')}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {t('chat:dispatch.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>{t('chat:dispatch.secure')}</span>
        </div>
      </div>

      {/* Chat Container */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-soft-card overflow-hidden flex flex-col h-[520px]">
        {/* Messages Feed */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/40 dark:bg-slate-950/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-2xl max-w-lg transition-all ${
                msg.isEmergency
                  ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 ms-auto'
                  : msg.sender.includes('ali')
                  ? 'bg-blue-600 text-white ms-auto shadow-md shadow-blue-500/20'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 me-auto'
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  {msg.isEmergency && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                  <span className={msg.sender.includes('ali') ? 'text-blue-100' : 'text-slate-900 dark:text-white'}>
                    {msg.sender}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                    msg.sender.includes('ali') ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  }`}>
                    {msg.role}
                  </span>
                </div>
                <span className={`text-[10px] font-mono ${msg.sender.includes('ali') ? 'text-blue-200' : 'text-slate-400'}`}>
                  {msg.timestamp}
                </span>
              </div>

              <p className={`text-xs sm:text-sm leading-relaxed ${
                msg.sender.includes('ali') ? 'text-white' : 'text-slate-700 dark:text-slate-300'
              }`}>
                {msg.text}
              </p>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setIsEmergency(!isEmergency)}
              className={`text-[11px] font-bold px-3 py-1 rounded-xl flex items-center gap-1 transition-all ${
                isEmergency
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{t('chat:dispatch.urgent')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t('chat:dispatch.placeholder')}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none"
            />
            <button
              type="submit"
              className="p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">{t('chat:send')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
