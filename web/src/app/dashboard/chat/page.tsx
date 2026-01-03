"use client";

import { useState, useEffect } from 'react';
import { createChat, getChats, getChat, saveMessage, deleteChat } from '@/app/actions/chat';

const renderContent = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

export default function ChatPage() {
    const [input, setInput] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // AI Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState('OpenAI');
    const [selectedMode, setSelectedMode] = useState('Thinking'); // 'Fast' or 'Thinking'
    const [temperature, setTemperature] = useState(0.7);

    // Chat State
    type Message = { role: 'user' | 'assistant'; content: string };
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Saved Chats
    type ChatItem = { id: string; title: string; updatedAt: Date; messages: any[] };
    const [chats, setChats] = useState<ChatItem[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteModalPosition, setDeleteModalPosition] = useState({ x: 0, y: 0 });
    const [chatToDelete, setChatToDelete] = useState<string | null>(null);

    useEffect(() => {
        loadChats();
    }, []);

    const loadChats = async () => {
        try {
            const savedChats = await getChats();
            setChats(savedChats as any);
        } catch (error) {
            console.error('Failed to load chats:', error);
        }
    };

    const loadChatById = async (chatId: string) => {
        try {
            const chat = await getChat(chatId);
            if (chat) {
                setCurrentChatId(chat.id);
                setMessages(chat.messages.map((m: any) => ({ role: m.role, content: m.content })));
            }
        } catch (error) {
            console.error('Failed to load chat:', error);
        }
    };

    const startNewChat = async () => {
        setCurrentChatId(null);
        setMessages([]);
    };

    const handleDeleteChat = async () => {
        if (!chatToDelete) return;

        try {
            await deleteChat(chatToDelete);

            // If we deleted the current chat, clear it
            if (chatToDelete === currentChatId) {
                setCurrentChatId(null);
                setMessages([]);
            }

            // Reload chat list
            await loadChats();

            // Close modal
            setDeleteModalOpen(false);
            setChatToDelete(null);
        } catch (error) {
            console.error('Failed to delete chat:', error);
            alert('Fehler beim Löschen des Chats');
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Create new chat if needed
            let chatId = currentChatId;
            if (!chatId) {
                const newChat = await createChat(input.substring(0, 50));
                chatId = newChat.id;
                setCurrentChatId(chatId);
                await loadChats(); // Refresh sidebar
            }

            // Type guard - chatId is guaranteed to be string here
            if (!chatId) throw new Error('Chat ID is required');

            // Save user message
            await saveMessage(chatId, 'user', userMessage.content);

            // Get AI response
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    provider: selectedProvider,
                    mode: selectedMode.toLowerCase(),
                    temperature
                })
            });

            if (!response.ok) throw new Error('Chat request failed');

            const data = await response.json();
            const assistantMessage: Message = { role: 'assistant', content: data.message };
            setMessages(prev => [...prev, assistantMessage]);

            // Save assistant message
            await saveMessage(chatId, 'assistant', assistantMessage.content);
            await loadChats(); // Refresh sidebar
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = { role: 'assistant', content: 'Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Anfrage.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>

            {/* Inner Chat Sidebar */}
            <div style={{
                width: sidebarOpen ? '280px' : '0px',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                backdropFilter: 'blur(10px)',
                borderRight: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'width 0.3s ease',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '2px 0 12px rgba(0,0,0,0.1)'
            }}>
                {/* Sidebar Header */}
                <div style={{
                    padding: '1rem',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <button
                        className="btn btn-primary"
                        onClick={startNewChat}
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            background: '#01b4d8',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(1, 180, 216, 0.3)'
                        }}
                    >
                        <span style={{ fontSize: '1.2rem' }}>+</span>
                        Neuer Chat
                    </button>
                </div>

                {/* Chat List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                    {chats.length > 0 ? (
                        <>
                            <div style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: 'hsl(var(--muted-foreground))',
                                padding: '0.75rem 0.75rem 0.5rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Verlauf
                            </div>
                            {chats.map((chat) => (
                                <div
                                    key={chat.id}
                                    style={{
                                        position: 'relative',
                                        marginBottom: '0.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.25rem'
                                    }}
                                >
                                    <button
                                        onClick={() => loadChatById(chat.id)}
                                        className="btn btn-ghost"
                                        style={{
                                            flex: 1,
                                            justifyContent: 'flex-start',
                                            fontWeight: currentChatId === chat.id ? 600 : 400,
                                            fontSize: '0.875rem',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            textAlign: 'left',
                                            background: currentChatId === chat.id
                                                ? 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)'
                                                : 'transparent',
                                            borderRadius: '0.5rem',
                                            padding: '0.625rem 0.875rem',
                                            borderLeft: currentChatId === chat.id ? '3px solid hsl(var(--primary))' : '3px solid transparent',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {chat.title}
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setChatToDelete(chat.id);
                                            setDeleteModalPosition({ x: e.clientX, y: e.clientY });
                                            setDeleteModalOpen(true);
                                        }}
                                        className="btn btn-ghost"
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            padding: '0',
                                            minWidth: 'unset',
                                            borderRadius: '0.375rem',
                                            opacity: 0.5,
                                            transition: 'opacity 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div style={{
                            padding: '2rem 1rem',
                            textAlign: 'center',
                            fontSize: '0.875rem',
                            color: 'hsl(var(--muted-foreground))',
                            lineHeight: 1.6
                        }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.3 }}>💬</div>
                            Noch keine Chats vorhanden
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>

                {/* Top Bar */}
                <div style={{
                    height: '3.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 1rem',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ position: 'relative' }}>
                        <div
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                            onClick={() => setShowSettings(!showSettings)}
                        >
                            {!sidebarOpen && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
                                    className="btn btn-ghost"
                                    style={{ padding: '0.5rem', marginRight: '0.5rem' }}
                                >
                                    ◫
                                </button>
                            )}
                            <span style={{ fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                                Valurion AI 4.0 <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({selectedProvider} - {selectedMode})</span>
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>▼</span>
                        </div>

                        {showSettings && (
                            <div className="glass-panel" style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                marginTop: '0.5rem',
                                width: '300px',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--border)',
                                zIndex: 50,
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                            }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>AI Model Provider</label>
                                    <select
                                        className="input-field"
                                        value={selectedProvider}
                                        onChange={(e) => setSelectedProvider(e.target.value)}
                                        style={{ width: '100%' }}
                                    >
                                        <option value="OpenAI">OpenAI GPT</option>
                                        <option value="Gemini">Google Gemini</option>
                                    </select>
                                </div>

                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Mode</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className={`btn ${selectedMode === 'Fast' ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setSelectedMode('Fast')}
                                            style={{ flex: 1, fontSize: '0.875rem' }}
                                        >
                                            ⚡ Fast
                                        </button>
                                        <button
                                            className={`btn ${selectedMode === 'Thinking' ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setSelectedMode('Thinking')}
                                            style={{ flex: 1, fontSize: '0.875rem' }}
                                        >
                                            🧠 Thinking
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                                        <span>Temperature (Kreativität)</span>
                                        <span>{temperature}</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={temperature}
                                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                        style={{ width: '100%', accentColor: 'hsl(var(--primary))' }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                                        <span>Präzise</span>
                                        <span>Kreativ</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {sidebarOpen && (
                        <button onClick={() => setSidebarOpen(false)} className="btn btn-ghost" style={{ padding: '0.5rem' }}>
                            ◫
                        </button>
                    )}
                </div>

                {/* Chat Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                    {messages.length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{
                                background: '#01b4d8',
                                width: '64px',
                                height: '64px',
                                borderRadius: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1rem',
                                boxShadow: '0 8px 24px rgba(1, 180, 216, 0.3)',
                                padding: '12px'
                            }}>
                                <img src="/chatbot-logo.png" alt="Valurion AI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 600 }}>Wie kann ich helfen?</h2>
                        </div>
                    ) : (
                        <div style={{ maxWidth: '768px', width: '100%', margin: '0 auto' }}>
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        marginBottom: '1.5rem',
                                        display: 'flex',
                                        gap: '1rem',
                                        alignItems: 'flex-start'
                                    }}
                                >
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: msg.role === 'user' ? '50%' : '8px',
                                        background: msg.role === 'user' ? 'hsl(var(--primary))' : '#01b4d8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1rem',
                                        flexShrink: 0,
                                        padding: msg.role === 'assistant' ? '6px' : '0'
                                    }}>
                                        {msg.role === 'user' ? '👤' : <img src="/chatbot-logo.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        background: msg.role === 'user' ? 'rgba(59, 130, 246, 0.1)' : 'var(--card)',
                                        padding: '1rem',
                                        borderRadius: '0.75rem',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word'
                                    }}>
                                        {renderContent(msg.content)}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: '#01b4d8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1rem',
                                        padding: '6px'
                                    }}>
                                        <img src="/chatbot-logo.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        background: 'var(--card)',
                                        padding: '1rem',
                                        borderRadius: '0.75rem'
                                    }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <div className="loading-dot"></div>
                                            <div className="loading-dot" style={{ animationDelay: '0.2s' }}></div>
                                            <div className="loading-dot" style={{ animationDelay: '0.4s' }}></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div style={{
                    padding: '0 1rem 2rem',
                    display: 'flex',
                    justifyContent: 'center',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '1rem'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '768px',
                        position: 'relative'
                    }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Nachricht an Valurion AI..."
                            disabled={isLoading}
                            style={{
                                width: '100%',
                                padding: '1rem 3rem 1rem 1.5rem',
                                borderRadius: '9999px',
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                color: 'inherit',
                                fontSize: '1rem',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            style={{
                                position: 'absolute',
                                right: '0.75rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: (input.trim() && !isLoading) ? 'hsl(var(--primary))' : 'var(--muted)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: (input.trim() && !isLoading) ? 'pointer' : 'default',
                                transition: 'background 0.2s'
                            }}
                        >
                            ↑
                        </button>
                        <div style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                            Valurion AI kann Fehler machen. Überprüfen Sie wichtige Informationen.
                        </div>
                    </div>
                </div>

                <style jsx global>{`
                    @keyframes bounce {
                        0%, 80%, 100% { transform: scale(0); }
                        40% { transform: scale(1); }
                    }
                    .loading-dot {
                        width: 8px;
                        height: 8px;
                        background: hsl(var(--muted-foreground));
                        border-radius: 50%;
                        animation: bounce 1.4s infinite ease-in-out both;
                    }
                `}</style>

            </div>

            {/* Delete Confirmation Modal */}
            {deleteModalOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.3)',
                            zIndex: 9998
                        }}
                        onClick={() => {
                            setDeleteModalOpen(false);
                            setChatToDelete(null);
                        }}
                    />

                    {/* Modal */}
                    <div
                        style={{
                            position: 'fixed',
                            left: `${deleteModalPosition.x}px`,
                            top: `${deleteModalPosition.y}px`,
                            transform: 'translate(-50%, -50%)',
                            background: 'hsl(var(--background))',
                            border: '1px solid var(--border)',
                            borderRadius: '0.75rem',
                            padding: '1.5rem',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
                            zIndex: 9999,
                            minWidth: '320px',
                            maxWidth: '400px'
                        }}
                    >
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: 'hsl(var(--foreground))' }}>
                            Chat löschen?
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                            Dieser Chat und alle Nachrichten werden permanent gelöscht.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => {
                                    setDeleteModalOpen(false);
                                    setChatToDelete(null);
                                }}
                                style={{ fontSize: '0.875rem', fontWeight: 500 }}
                            >
                                Abbrechen
                            </button>
                            <button
                                className="btn"
                                onClick={handleDeleteChat}
                                style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none'
                                }}
                            >
                                Löschen
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
