'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import ComputerPanel from './ComputerPanel';
import Marketplace from './Marketplace';
import AuditPanel from './AuditPanel';
import AppSettingsDrawer from './AppSettingsDrawer';
import NewBotModal from './NewBotModal';

import { 
  fetchBots, 
  fetchModels, 
  fetchChatHistory, 
  fetchSettings,
  createBot, 
  updateBot 
} from '../lib/api';

export default function Dashboard({ onLogout }) {
  const [bots, setBots] = useState([]);
  const [models, setModels] = useState([]);
  const [activeBotId, setActiveBotId] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'computer' | 'marketplace' | 'audit'
  const [messages, setMessages] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNewBotOpen, setIsNewBotOpen] = useState(false);
  const [defaultModel, setDefaultModel] = useState('gpt-5-mini');
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('open_dots_user_name') || 'You';
    }
    return 'You';
  });

  // Initial Data Fetch
  useEffect(() => {
    async function initData() {
      try {
        const [botsData, modelsData, settingsData] = await Promise.all([fetchBots(), fetchModels(), fetchSettings()]);
        setBots(botsData);
        setModels(modelsData);
        if (settingsData?.default_model) {
          setDefaultModel(settingsData.default_model);
        }
        if (botsData.length > 0) {
          setActiveBotId(botsData[0].id);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    initData();
  }, []);

  // Fetch chat history whenever active bot changes
  useEffect(() => {
    if (!activeBotId) return;
    fetchChatHistory(activeBotId)
      .then((history) => setMessages(history))
      .catch((err) => console.error('Failed to load history:', err));
  }, [activeBotId]);

  const activeBot = bots.find((b) => b.id === activeBotId) || bots[0];

  const handleUpdateBotModel = async (botId, newModel) => {
    try {
      const updated = await updateBot(botId, { model: newModel });
      setBots((prev) => prev.map((b) => (b.id === botId ? updated : b)));
    } catch (err) {
      console.error('Failed to update bot model:', err);
    }
  };

  // Guest iframe 内 window.prompt 不可用，由 NewBotModal 传入字段。
  const handleCreateNewBot = async ({ name, role, model }) => {
    try {
      const modelId = model || defaultModel || 'gpt-5-mini';
      const newBot = await createBot({
        name,
        role: role || 'AI Assistant',
        model: modelId,
        description: `Custom assistant configured to use ${modelId}.`,
        avatar: '🤖',
        system_prompt: `You are ${name}, a helpful AI assistant.`
      });
      setBots((prev) => [...prev, newBot]);
      setActiveBotId(newBot.id);
      setActiveTab('chat');
    } catch (err) {
      console.error('Failed to create bot:', err);
      throw err instanceof Error ? err : new Error(String(err || 'Failed to create bot'));
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] text-zinc-100 font-sans">
      {/* Sidebar Navigation & Bot Roster */}
      <Sidebar
        onLogout={onLogout}
        bots={bots}
        activeBotId={activeBotId}
        userName={userName}
        onSelectBot={(id) => {
          setActiveBotId(id);
          setActiveTab('chat');
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(!isSettingsOpen)}
        onOpenNewBot={() => setIsNewBotOpen(true)}
      />

      {/* Main Workspace Display Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {activeTab === 'chat' && (
          <ChatWindow
            bot={activeBot}
            models={models}
            messages={messages}
            setMessages={setMessages}
            onUpdateBotModel={handleUpdateBotModel}
            onToggleComputer={() => setActiveTab('computer')}
            defaultModel={defaultModel}
          />
        )}

        {activeTab === 'computer' && (
          <ComputerPanel bot={activeBot} onBackToChat={() => setActiveTab('chat')} />
        )}

        {activeTab === 'marketplace' && (
          <Marketplace onOpenSettings={() => setIsSettingsOpen(true)} />
        )}

        {activeTab === 'audit' && <AuditPanel />}
      </main>

      {/* Right Side App Settings Drawer Panel */}
      <AppSettingsDrawer
        models={models}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentModel={defaultModel}
        onUpdateDefaultModel={async (newModel) => {
          setDefaultModel(newModel);
          setModels(await fetchModels());
        }}
        onProfileUpdate={(name) => setUserName(name || 'You')}
      />

      {/* 页内新建 Bot：Guest iframe 内不可用 window.prompt */}
      <NewBotModal
        isOpen={isNewBotOpen}
        onClose={() => setIsNewBotOpen(false)}
        onSubmit={handleCreateNewBot}
        defaultModel={defaultModel}
      />
    </div>
  );
}
