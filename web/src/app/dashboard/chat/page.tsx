"use client";

import { useState, useEffect } from 'react';
import { createChat, getChats, getChat, saveMessage, deleteChat, createProject, getProjects, deleteProject, updateProject, getProjectDocuments, deleteDocument } from '@/app/actions/chat';

const renderContent = (content: string) => {
    // Split by markdown images and bold text
    const parts = content.split(/(!\[.*?\]\(.*?\))|(\*\*.*?\*\*)/g).filter(p => p !== undefined && p !== "");

    return parts.map((part, index) => {
        if (part.startsWith('![') && part.includes('](') && part.endsWith(')')) {
            const match = part.match(/!\[(.*?)\]\((.*?)\)/);
            if (match) {
                return (
                    <div key={index} style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                        <img
                            src={match[2]}
                            alt={match[1] || 'Uploaded Image'}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '400px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)'
                            }}
                        />
                    </div>
                );
            }
        }

        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>;
        }

        return <span key={index}>{part}</span>;
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
    const [attachments, setAttachments] = useState<{ file: File; preview: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // Saved Chats & Projects
    type ChatItem = { id: string; title: string; updatedAt: Date; messages: any[]; projectId?: string | null };
    type ProjectItem = { id: string; name: string; description?: string; nonGoals?: string };

    const [chats, setChats] = useState<ChatItem[]>([]);
    const [projects, setProjects] = useState<ProjectItem[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

    // Project Editing State
    const [editProjectModalOpen, setEditProjectModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);
    const [editingProjectData, setEditingProjectData] = useState({ name: '', description: '', nonGoals: '' });
    const [editingProjectDocs, setEditingProjectDocs] = useState<{ id: string, filename: string, fileSize: number }[]>([]);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);

    // Modals
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteModalPosition, setDeleteModalPosition] = useState({ x: 0, y: 0 });
    const [chatToDelete, setChatToDelete] = useState<string | null>(null);

    const [createProjectModalOpen, setCreateProjectModalOpen] = useState(false);
    const [deleteProjectModalOpen, setDeleteProjectModalOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
    const [newProjectData, setNewProjectData] = useState({ name: '', description: '', nonGoals: '' });

    // Active Project Context for new chats
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [savedChats, savedProjects] = await Promise.all([getChats(), getProjects()]);
            setChats(savedChats as any);
            setProjects(savedProjects as any);
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };

    const loadChatById = async (chatId: string) => {
        try {
            const chat = await getChat(chatId);
            if (chat) {
                setCurrentChatId(chat.id);
                setMessages(chat.messages.map((m: any) => ({ role: m.role, content: m.content })));
                setActiveProjectId(null); // Reset active project intent when loading existing chat
            }
        } catch (error) {
            console.error('Failed to load chat:', error);
        }
    };

    const startNewChat = async (projectId?: string) => {
        setCurrentChatId(null);
        setMessages([]);
        setActiveProjectId(projectId || null);
        if (projectId && !expandedProjects.has(projectId)) {
            toggleProject(projectId);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectData.name) return;
        try {
            await createProject(newProjectData.name, newProjectData.description, newProjectData.nonGoals);
            setCreateProjectModalOpen(false);
            setNewProjectData({ name: '', description: '', nonGoals: '' });
            await loadData();
        } catch (e) {
            console.error(e);
            alert("Fehler beim Erstellen des Projekts");
        }
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
            await loadData();

            // Close modal
            setDeleteModalOpen(false);
            setChatToDelete(null);
        } catch (error) {
            console.error('Failed to delete chat:', error);
            alert('Fehler beim Löschen des Chats');
        }
    };

    const confirmDeleteProject = async () => {
        if (!projectToDelete) return;
        try {
            await deleteProject(projectToDelete);
            setDeleteProjectModalOpen(false);
            setProjectToDelete(null);
            await loadData();
        } catch (e) {
            console.error(e);
            alert("Fehler beim Löschen");
        }
    };

    const openEditProjectModal = async (project: ProjectItem) => {
        setEditingProject(project);
        setEditingProjectData({
            name: project.name,
            description: project.description || '',
            nonGoals: project.nonGoals || ''
        });

        // Load documents
        try {
            const docs = await getProjectDocuments(project.id);
            setEditingProjectDocs(docs as any);
        } catch (e) {
            console.error("Failed to load docs", e);
        }

        setEditProjectModalOpen(true);
    };

    const handleUpdateProject = async () => {
        if (!editingProject || !editingProjectData.name) return;
        try {
            await updateProject(editingProject.id, editingProjectData.name, editingProjectData.description, editingProjectData.nonGoals);
            setEditProjectModalOpen(false);
            setEditingProject(null);
            await loadData();
        } catch (e) {
            console.error(e);
            alert("Fehler beim Speichern");
        }
    };

    const handleUploadProjectDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files.length || !editingProject) return;
        const file = e.target.files[0];
        setIsUploadingDoc(true);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectId', editingProject.id);

        try {
            const res = await fetch('/api/project/upload', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error("Upload failed");

            // Refresh docs
            const docs = await getProjectDocuments(editingProject.id);
            setEditingProjectDocs(docs as any);
        } catch (error) {
            console.error(error);
            alert("Fehler beim Upload");
        } finally {
            setIsUploadingDoc(false);
            e.target.value = ''; // Reset input
        }
    };

    const handleDeleteProjectDoc = async (docId: string) => {
        try {
            await deleteDocument(docId);
            setEditingProjectDocs(prev => prev.filter(d => d.id !== docId));
        } catch (e) {
            console.error(e);
            alert("Fehler beim Löschen der Datei");
        }
    };

    const toggleProject = (projectId: string) => {
        const newSet = new Set(expandedProjects);
        if (newSet.has(projectId)) {
            newSet.delete(projectId);
        } else {
            newSet.add(projectId);
        }
        setExpandedProjects(newSet);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result) {
                            setAttachments(prev => [...prev, {
                                file: blob,
                                preview: event.target!.result as string
                            }]);
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || isLoading || isUploading) return;

        let finalContent = input;
        setIsUploading(true);

        try {
            // Upload attachments if any
            if (attachments.length > 0) {
                const uploadPromises = attachments.map(async (att) => {
                    const formData = new FormData();
                    formData.append('file', att.file);

                    const res = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });

                    if (!res.ok) throw new Error('Upload failed');
                    const data = await res.json();
                    return `![Image](${data.url})`;
                });

                const uploadedUrls = await Promise.all(uploadPromises);
                if (finalContent.trim()) finalContent += '\n\n';
                finalContent += uploadedUrls.join('\n');

                setAttachments([]);
            }
        } catch (error) {
            console.error('Failed to upload attachments', error);
            alert('Fehler beim Hochladen der Bilder.');
            setIsUploading(false);
            return;
        } finally {
            setIsUploading(false);
        }

        const userMessage: Message = { role: 'user', content: finalContent };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            // Create new chat if needed
            let chatId = currentChatId;
            if (!chatId) {
                // If we have an active project intent, use it
                const newChat = await createChat(finalContent.substring(0, 50) || (activeProjectId ? 'Projekt Chat' : 'Neuer Chat'), activeProjectId || undefined);
                chatId = newChat.id;
                setCurrentChatId(chatId);
                // Don't await loadData here to speed up UI, maybe later?
                // Actually we need to await it so the sidebar updates
                await loadData();
            }

            if (!chatId) throw new Error('Chat ID is required');

            // Save user message
            await saveMessage(chatId, 'user', userMessage.content);

            // Get AI response
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatId,
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

            await saveMessage(chatId, 'assistant', assistantMessage.content);
            await loadData();
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: Message = { role: 'assistant', content: 'Entschuldigung, es gab einen Fehler bei der Verarbeitung Ihrer Anfrage.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Group chats
    const projectChats = (projectId: string) => chats.filter(c => c.projectId === projectId);
    const looseChats = chats.filter(c => !c.projectId);

    const currentProjectName = activeProjectId
        ? projects.find(p => p.id === activeProjectId)?.name
        : (currentChatId ? projects.find(p => p.id === chats.find(c => c.id === currentChatId)?.projectId)?.name : null);


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
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => startNewChat()}
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

                    <button
                        className="btn btn-ghost"
                        onClick={() => setCreateProjectModalOpen(true)}
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            opacity: 0.8
                        }}
                    >
                        + Neues Projekt
                    </button>
                </div>

                {/* Chat List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>

                    {/* Projects Section */}
                    {projects.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                color: 'hsl(var(--muted-foreground))',
                                padding: '0.5rem 0.75rem',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}>
                                Projekte
                            </div>
                            {projects.map(proj => (
                                <div key={proj.id} style={{ marginBottom: '0.5rem' }}>
                                    <div
                                        onClick={() => toggleProject(proj.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.5rem 0.75rem',
                                            cursor: 'pointer',
                                            borderRadius: '0.5rem',
                                            background: expandedProjects.has(proj.id) ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            fontWeight: 500,
                                            fontSize: '0.9rem',
                                            userSelect: 'none'
                                        }}
                                    >
                                        <span style={{ marginRight: '0.5rem', fontSize: '0.7rem', transform: expandedProjects.has(proj.id) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proj.name}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditProjectModal(proj);
                                            }}
                                            className="btn btn-ghost"
                                            style={{ padding: '0 4px', height: '20px', minWidth: 'unset', opacity: 0.4, marginRight: '4px' }}
                                            title="Projekt bearbeiten"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setProjectToDelete(proj.id);
                                                setDeleteModalPosition({ x: e.clientX, y: e.clientY });
                                                setDeleteProjectModalOpen(true);
                                            }}
                                            className="btn btn-ghost"
                                            style={{ padding: '0 4px', height: '20px', minWidth: 'unset', opacity: 0.4 }}
                                            title="Projekt löschen"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    {expandedProjects.has(proj.id) && (
                                        <div style={{ paddingLeft: '1rem', marginTop: '0.25rem' }}>
                                            <button
                                                onClick={() => startNewChat(proj.id)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    width: '100%',
                                                    padding: '0.5rem',
                                                    fontSize: '0.8rem',
                                                    color: 'hsl(var(--primary))',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    textAlign: 'left'
                                                }}
                                            >
                                                <span>+</span> Neuer Projekt-Chat
                                            </button>

                                            {projectChats(proj.id).map(chat => (
                                                <div
                                                    key={chat.id}
                                                    style={{
                                                        position: 'relative',
                                                        marginBottom: '0.1rem',
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
                                                            fontSize: '0.85rem',
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            textAlign: 'left',
                                                            background: currentChatId === chat.id
                                                                ? 'rgba(59, 130, 246, 0.1)'
                                                                : 'transparent',
                                                            borderRadius: '0.5rem',
                                                            padding: '0.4rem 0.75rem',
                                                            color: currentChatId === chat.id ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
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
                                                            width: '24px',
                                                            height: '24px',
                                                            padding: '0',
                                                            minWidth: 'unset',
                                                            opacity: 0.3
                                                        }}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                            {projectChats(proj.id).length === 0 && (
                                                <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', padding: '0.5rem' }}>Keine Chats</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Loose Chats */}
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
                    {looseChats.length > 0 ? looseChats.map((chat) => (
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
                    )) : (
                        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', opacity: 0.6 }}>Keine freien Chats</div>
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

                        {currentProjectName && (
                            <div style={{
                                marginLeft: '1rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontSize: '0.75rem',
                                background: 'rgba(59, 130, 246, 0.1)',
                                color: '#3b82f6',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                gap: '0.5rem'
                            }}>
                                <span>📁 {currentProjectName}</span>
                            </div>
                        )}


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
                            {currentProjectName && (
                                <div style={{
                                    marginTop: '1.5rem',
                                    padding: '1rem',
                                    background: 'var(--card)',
                                    borderRadius: '0.75rem',
                                    maxWidth: '400px',
                                    border: '1px solid var(--border)',
                                    textAlign: 'left'
                                }}>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--primary))' }}>Aktives Projekt: {currentProjectName}</p>
                                    <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                                        Die KI berücksichtigt Ziele und Vorgaben dieses Projekts.
                                    </p>
                                </div>
                            )}
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
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '1rem'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '768px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: attachments.length > 0 ? '0.5rem' : '0'
                    }}>
                        {attachments.map((att, index) => (
                            <div key={index} style={{ position: 'relative', width: '64px', height: '64px' }}>
                                <img
                                    src={att.preview}
                                    alt="Preview"
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        borderRadius: '0.5rem',
                                        border: '1px solid var(--border)'
                                    }}
                                />
                                <button
                                    onClick={() => removeAttachment(index)}
                                    style={{
                                        position: 'absolute',
                                        top: '-6px',
                                        right: '-6px',
                                        background: 'rgba(0,0,0,0.6)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '18px',
                                        height: '18px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>

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
                            onPaste={handlePaste}
                            placeholder={currentProjectName ? `Nachricht im Projekt "${currentProjectName}"...` : "Nachricht an Valurion AI..."}
                            disabled={isLoading || isUploading}
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
                            disabled={(!input.trim() && attachments.length === 0) || isLoading || isUploading}
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

            {/* Create Project Modal */}
            {createProjectModalOpen && (
                <>
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.4)',
                            zIndex: 9998,
                            backdropFilter: 'blur(4px)'
                        }}
                        onClick={() => setCreateProjectModalOpen(false)}
                    />
                    <div className="glass-panel"
                        style={{
                            position: 'fixed',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '100%',
                            maxWidth: '500px',
                            minWidth: '320px',
                            padding: '2rem',
                            borderRadius: '1rem',
                            border: '1px solid var(--border)',
                            zIndex: 9999,
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                        }}
                    >
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Neues Projekt anlegen</h2>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Projekt Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={newProjectData.name}
                                onChange={e => setNewProjectData({ ...newProjectData, name: e.target.value })}
                                style={{ width: '100%' }}
                                placeholder="z.B. Marketing Q1"
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Ziele / Anweisungen (Instructions)</label>
                            <textarea
                                className="input-field"
                                value={newProjectData.description}
                                onChange={e => setNewProjectData({ ...newProjectData, description: e.target.value })}
                                style={{ width: '100%', minHeight: '80px', fontFamily: 'inherit' }}
                                placeholder="Worum geht es? Was soll die KI beachten?"
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem', color: '#f87171' }}>Nicht-Ziele (Was soll ausgeklammert werden?)</label>
                            <textarea
                                className="input-field"
                                value={newProjectData.nonGoals}
                                onChange={e => setNewProjectData({ ...newProjectData, nonGoals: e.target.value })}
                                style={{ width: '100%', minHeight: '80px', fontFamily: 'inherit' }}
                                placeholder="Themen die hier nichts zu suchen haben..."
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="btn btn-ghost" onClick={() => setCreateProjectModalOpen(false)}>Abbrechen</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateProject}
                                disabled={!newProjectData.name.trim()}
                            >
                                Projekt erstellen
                            </button>
                        </div>
                    </div>
                </>
            )}

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

            {/* Edit Project Modal */}
            {editProjectModalOpen && (
                <>
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.4)',
                            zIndex: 9998,
                            backdropFilter: 'blur(4px)'
                        }}
                        onClick={() => setEditProjectModalOpen(false)}
                    />
                    <div className="glass-panel"
                        style={{
                            position: 'fixed',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '100%',
                            maxWidth: '600px',
                            minWidth: '320px',
                            padding: '2rem',
                            borderRadius: '1rem',
                            border: '1px solid var(--border)',
                            zIndex: 9999,
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            maxHeight: '90vh',
                            overflowY: 'auto'
                        }}
                    >
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Projekt bearbeiten</h2>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Projekt Name</label>
                            <input
                                type="text"
                                className="input-field"
                                value={editingProjectData.name}
                                onChange={e => setEditingProjectData({ ...editingProjectData, name: e.target.value })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Ziele / Anweisungen</label>
                            <textarea
                                className="input-field"
                                value={editingProjectData.description}
                                onChange={e => setEditingProjectData({ ...editingProjectData, description: e.target.value })}
                                style={{ width: '100%', minHeight: '80px', fontFamily: 'inherit' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem', color: '#f87171' }}>Nicht-Ziele</label>
                            <textarea
                                className="input-field"
                                value={editingProjectData.nonGoals}
                                onChange={e => setEditingProjectData({ ...editingProjectData, nonGoals: e.target.value })}
                                style={{ width: '100%', minHeight: '80px', fontFamily: 'inherit' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Wissensbasis (RAG)</h3>
                            <p style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1rem' }}>
                                Laden Sie Dateien hoch, die die KI für Antworten in diesem Projekt nutzen soll.
                            </p>

                            <div style={{ marginBottom: '1rem' }}>
                                {editingProjectDocs.map(doc => (
                                    <div key={doc.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.5rem',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '0.5rem',
                                        marginBottom: '0.5rem',
                                        border: '1px solid var(--border)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                                            <span style={{ fontSize: '1.2rem' }}>📄</span>
                                            <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.filename}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>({Math.round(doc.fileSize / 1024)} KB)</span>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteProjectDoc(doc.id)}
                                            className="btn btn-ghost"
                                            style={{ color: '#ef4444', padding: '0.25rem 0.5rem' }}
                                        >
                                            löschen
                                        </button>
                                    </div>
                                ))}
                                {editingProjectDocs.length === 0 && (
                                    <div style={{ fontSize: '0.85rem', fontStyle: 'italic', opacity: 0.5, textAlign: 'center', padding: '1rem' }}>Keine Dateien vorhanden</div>
                                )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <input
                                    type="file"
                                    id="project-file-upload"
                                    style={{ display: 'none' }}
                                    onChange={handleUploadProjectDoc}
                                    disabled={isUploadingDoc}
                                />
                                <label
                                    htmlFor="project-file-upload"
                                    className="btn btn-secondary"
                                    style={{
                                        cursor: isUploadingDoc ? 'wait' : 'pointer',
                                        opacity: isUploadingDoc ? 0.7 : 1,
                                        width: '100%',
                                        justifyContent: 'center',
                                        border: '1px dashed var(--border)'
                                    }}
                                >
                                    {isUploadingDoc ? 'Wird hochgeladen...' : '+ Datei hochladen'}
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="btn btn-ghost" onClick={() => setEditProjectModalOpen(false)}>Abbrechen</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleUpdateProject}
                                disabled={!editingProjectData.name.trim()}
                            >
                                Änderungen speichern
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Project Delete Confirmation Modal */}
            {deleteProjectModalOpen && (
                <>
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.3)',
                            zIndex: 9998
                        }}
                        onClick={() => {
                            setDeleteProjectModalOpen(false);
                            setProjectToDelete(null);
                        }}
                    />
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
                            Projekt löschen?
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                            Projekt wirklich löschen? Alle zugehörigen Chats verlieren ihre Zuordnung.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => {
                                    setDeleteProjectModalOpen(false);
                                    setProjectToDelete(null);
                                }}
                                style={{ fontSize: '0.875rem', fontWeight: 500 }}
                            >
                                Abbrechen
                            </button>
                            <button
                                className="btn"
                                onClick={confirmDeleteProject}
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
