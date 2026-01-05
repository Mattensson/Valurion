"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createChat, getChats, getChat, saveMessage, deleteChat, createProject, getProjects, deleteProject, updateProject, getProjectDocuments, deleteDocument } from '@/app/actions/chat';
import { getDocuments } from '@/app/actions/documents';

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
    const searchParams = useSearchParams();
    const [activeAssistant, setActiveAssistant] = useState<{ id: string; name: string; icon?: string; gradient?: string; provider?: string } | null>(null);
    const [systemPrompt, setSystemPrompt] = useState<string | null>(null);

    const [showSettings, setShowSettings] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState('OpenAI');
    const [selectedMode, setSelectedMode] = useState('Thinking'); // 'Fast' or 'Thinking'
    const [temperature, setTemperature] = useState(0.7);

    // Initialize from URL params if present (Assistant Mode)
    useEffect(() => {
        const assistantId = searchParams.get('assistant');
        if (assistantId) {
            setActiveAssistant({
                id: assistantId,
                name: searchParams.get('name') || 'Assistant',
                icon: searchParams.get('icon') || undefined,
                gradient: searchParams.get('gradient') || undefined,
                provider: searchParams.get('provider') || undefined
            });

            const prompt = searchParams.get('prompt');
            if (prompt) setSystemPrompt(prompt);

            const provider = searchParams.get('provider');
            if (provider) setSelectedProvider(provider);

            const model = searchParams.get('model');
            // We don't directly select exact model ID here as UI uses Mode/Provider abstraction, 
            // but we can imply mode maybe? For now trust provider settings.

            const temp = searchParams.get('temp');
            if (temp) setTemperature(parseFloat(temp));

            // Auto close settings if they were open (shouldn't be open by default anyway)
            setShowSettings(false);
        }
    }, [searchParams]);

    // Chat State (Managed by React useState)
    type Message = { role: 'user' | 'assistant'; content: string };
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);


    // Attachments State
    type Attachment =
        | { type: 'file'; file: File; preview: string; id: string }
        | { type: 'repo'; doc: any; id: string };

    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    // Saved Chats & Projects
    type ChatItem = {
        id: string;
        title: string;
        updatedAt: Date;
        messages: any[];
        projectId?: string | null;
        provider?: string | null;
        mode?: string | null;
        assistantId?: string | null;
        assistant?: { id: string; name: string; icon: string; gradient: string } | null;
    };
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

    // Document Picker State
    const [showDocPicker, setShowDocPicker] = useState(false);
    const [docPickerTab, setDocPickerTab] = useState<'my' | 'shared'>('my');
    const [availableDocs, setAvailableDocs] = useState<{ myDocuments: any[], sharedDocuments: any[] } | null>(null);
    const [isLoadingDocs, setIsLoadingDocs] = useState(false);

    // Plus Menu State
    const [showPlusMenu, setShowPlusMenu] = useState(false);
    const [webSearchEnabled, setWebSearchEnabled] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);

            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result) {
                            setAttachments(prev => [...prev, {
                                type: 'file',
                                file: file,
                                preview: event.target!.result as string,
                                id: Math.random().toString(36).substring(7)
                            }]);
                        }
                    };
                    reader.readAsDataURL(file);
                } else {
                    setAttachments(prev => [...prev, {
                        type: 'file',
                        file: file,
                        preview: '',
                        id: Math.random().toString(36).substring(7)
                    }]);
                }
            });

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            setShowPlusMenu(false);
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
                                type: 'file',
                                file: blob,
                                preview: event.target!.result as string,
                                id: Math.random().toString(36).substring(7)
                            }]);
                        }
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Nur setIsDragging(false) wenn wir wirklich den Container verlassen
        // Nicht bei Hover über Kindelemente
        if (e.currentTarget === e.target) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);

        if (files.length > 0) {
            files.forEach(file => {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result) {
                            setAttachments(prev => [...prev, {
                                type: 'file',
                                file: file,
                                preview: event.target!.result as string,
                                id: Math.random().toString(36).substring(7)
                            }]);
                        }
                    };
                    reader.readAsDataURL(file);
                } else {
                    setAttachments(prev => [...prev, {
                        type: 'file',
                        file: file,
                        preview: '',
                        id: Math.random().toString(36).substring(7)
                    }]);
                }
            });
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleOpenDocPicker = async () => {
        setShowDocPicker(true);
        setShowPlusMenu(false);
        if (!availableDocs) {
            setIsLoadingDocs(true);
            try {
                const docs = await getDocuments();
                setAvailableDocs(docs as any);
            } catch (e) {
                console.error("Failed to load documents", e);
            } finally {
                setIsLoadingDocs(false);
            }
        }
    };

    const handleSelectRepoDoc = (doc: any) => {
        // Add to attachments list instead of modifying input text
        setAttachments(prev => [...prev, {
            type: 'repo',
            doc: doc,
            id: doc.id // Use doc ID as unique ID
        }]);

        setShowDocPicker(false);
        // Focus back on input
        inputRef.current?.focus();
    };

    const handleSend = async () => {
        if ((!input.trim() && attachments.length === 0) || isLoading || isUploading) return;

        let finalContent = input;
        setIsUploading(true);

        try {
            const filesToUpload = attachments.filter(a => a.type === 'file') as { type: 'file', file: File, id: string }[];
            const repoDocs = attachments.filter(a => a.type === 'repo') as { type: 'repo', doc: any, id: string }[];

            // Upload new files
            let uploadedUrls: string[] = [];
            if (filesToUpload.length > 0) {
                const uploadPromises = filesToUpload.map(async (att) => {
                    const formData = new FormData();
                    formData.append('file', att.file);

                    const res = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });

                    if (!res.ok) throw new Error('Upload failed');
                    const data = await res.json();

                    if (att.file.type.startsWith('image/')) {
                        return `![${att.file.name}](${data.url})`;
                    } else {
                        return `[Datei: ${att.file.name}](${data.url})`;
                    }
                });

                uploadedUrls = await Promise.all(uploadPromises);
            }

            // Process repo docs (just create markdown links)
            const repoLinks = repoDocs.map(att => `[${att.doc.filename}](/api/documents/${att.doc.id})`);

            // Combine all
            const allAttachments = [...uploadedUrls, ...repoLinks];

            if (allAttachments.length > 0) {
                if (finalContent.trim()) finalContent += '\n\n';
                finalContent += allAttachments.join('\n');
            }

            setAttachments([]);
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
                // If we have an active activeAssistant, use its details
                const currentMode = activeAssistant ? 'assistant' : selectedMode.toLowerCase();
                const currentProvider = activeAssistant ? activeAssistant.provider : selectedProvider;

                const newChat = await createChat(
                    finalContent.substring(0, 50) || (activeProjectId ? 'Projekt Chat' : 'Neuer Chat'),
                    activeProjectId || undefined,
                    selectedProvider,
                    selectedMode.toLowerCase(),
                    activeAssistant?.id
                );
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
                    temperature,
                    systemPrompt // Pass system prompt if set (active assistant)
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
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
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        Neues Projekt
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
                                        <span style={{ marginRight: '0.5rem', display: 'flex', alignItems: 'center', transform: expandedProjects.has(proj.id) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                        </span>
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
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
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
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
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
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                                Neuer Projekt-Chat
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
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <line x1="18" y1="6" x2="6" y2="18" />
                                                            <line x1="6" y1="6" x2="18" y2="18" />
                                                        </svg>
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
                                {chat.assistant ? (
                                    <div style={{
                                        width: '18px', height: '18px', borderRadius: '4px',
                                        background: chat.assistant.gradient || '#6366f1',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginRight: '8px', flexShrink: 0, color: 'white'
                                    }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" strokeLinecap="round" strokeLinejoin="round">
                                            <path d={chat.assistant.icon || "M12 2a10 10 0 1 0 10 10H12V2z"} />
                                        </svg>
                                    </div>
                                ) : chat.mode === 'thinking' ? (
                                    <div style={{
                                        width: '18px', height: '18px', borderRadius: '4px',
                                        background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginRight: '8px', flexShrink: 0
                                    }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
                                            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
                                            <path d="M12 18a6 6 0 0 0-6-6m6 0a6 6 0 0 0 6 6" />
                                        </svg>
                                    </div>
                                ) : chat.mode === 'fast' ? (
                                    <div style={{
                                        width: '18px', height: '18px', borderRadius: '4px',
                                        background: 'rgba(249, 115, 22, 0.15)', color: '#f97316',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginRight: '8px', flexShrink: 0
                                    }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                        </svg>
                                    </div>
                                ) : null}
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
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >

                {/* Top Bar */}
                <div style={{
                    height: '3.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 1rem',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ position: 'relative' }}>
                        {activeAssistant ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {!sidebarOpen && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSidebarOpen(true); }}
                                        className="btn btn-ghost"
                                        style={{ padding: '0.5rem', marginRight: '0.5rem' }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <line x1="9" y1="3" x2="9" y2="21" />
                                        </svg>
                                    </button>
                                )}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: activeAssistant.gradient || 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                                    color: 'white'
                                }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {activeAssistant.icon ? (
                                            <path d={activeAssistant.icon} />
                                        ) : (
                                            <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                                        )}
                                    </svg>
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{activeAssistant.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                        {selectedProvider} • {selectedMode}
                                    </div>
                                </div>
                            </div>
                        ) : (
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
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                            <line x1="9" y1="3" x2="9" y2="21" />
                                        </svg>
                                    </button>
                                )}
                                <span style={{ fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                                    Valurion AI 4.0 <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({selectedProvider} - {selectedMode})</span>
                                </span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </div>
                        )}

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
                                <span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '4px', verticalAlign: 'middle' }}>
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                    </svg>
                                    {currentProjectName}
                                </span>
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
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                            </svg>
                                            Fast
                                        </button>
                                        <button
                                            className={`btn ${selectedMode === 'Thinking' ? 'btn-primary' : 'btn-ghost'}`}
                                            onClick={() => setSelectedMode('Thinking')}
                                            style={{ flex: 1, fontSize: '0.875rem' }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                            </svg>
                                            Thinking
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
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
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
                                        {msg.role === 'user' ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                        ) : <img src="/chatbot-logo.png" alt="AI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
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
                            <div key={index} style={{
                                position: 'relative',
                                width: '64px',
                                height: '64px'
                            }}>
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border)',
                                    overflow: 'hidden',
                                    background: 'rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {att.type === 'file' && att.preview ? (
                                        <img
                                            src={att.preview}
                                            alt={att.file.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <>
                                            <div style={{ color: 'hsl(var(--primary))', marginBottom: '4px' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    {(att.type === 'repo' ? att.doc.mimeType : att.file.type).includes('image') ? (
                                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                    ) : (
                                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    )}
                                                </svg>
                                            </div>
                                            <div style={{ fontSize: '8px', textAlign: 'center', width: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {att.type === 'repo' ? att.doc.filename : att.file.name}
                                            </div>
                                            {att.type === 'repo' && (
                                                <div style={{
                                                    position: 'absolute', bottom: '2px', right: '2px',
                                                    width: '12px', height: '12px', borderRadius: '50%', background: '#22c55e',
                                                    border: '2px solid var(--background)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }} title="Bereits hochgeladen">
                                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => removeAttachment(index)}
                                    style={{
                                        position: 'absolute',
                                        top: '-6px',
                                        right: '-6px',
                                        background: 'hsl(var(--destructive))',
                                        color: 'white',
                                        border: '2px solid var(--background)',
                                        borderRadius: '50%',
                                        width: '20px',
                                        height: '20px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 10,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div style={{
                        width: '100%',
                        maxWidth: '768px',
                        position: 'relative'
                    }}>
                        <div style={{ position: 'relative', width: '100%' }}>
                            {/* Plus Menu Button */}
                            <div style={{ position: 'absolute', left: '0.75rem', top: 'calc(50% - 4px)', transform: 'translateY(-50%)', zIndex: 10, display: 'flex', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowPlusMenu(!showPlusMenu)}
                                    style={{
                                        background: showPlusMenu ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.1)',
                                        color: showPlusMenu ? 'white' : 'hsl(var(--foreground))',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '50%',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        fontSize: '1.2rem',
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    {showPlusMenu ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                    )}
                                </button>

                                {/* Plus Menu Dropdown */}
                                {showPlusMenu && (
                                    <div
                                        className="glass-panel"
                                        style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: 0,
                                            marginBottom: '0.5rem',
                                            minWidth: '220px',
                                            padding: '0.5rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid var(--border)',
                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                fileInputRef.current?.click();
                                                setShowPlusMenu(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem 1rem',
                                                background: 'transparent',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                color: 'inherit',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                fontSize: '0.9rem',
                                                transition: 'background 0.2s',
                                                textAlign: 'left'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                            </svg>
                                            <span>Datei anhängen</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleOpenDocPicker}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem 1rem',
                                                background: 'transparent',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                color: 'inherit',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                fontSize: '0.9rem',
                                                transition: 'background 0.2s',
                                                textAlign: 'left'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                                <polyline points="10 9 9 9 8 9"></polyline>
                                            </svg>
                                            <span>Aus Dokumenten wählen</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setWebSearchEnabled(!webSearchEnabled);
                                                setShowPlusMenu(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem 1rem',
                                                background: webSearchEnabled ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                                border: 'none',
                                                borderRadius: '0.375rem',
                                                color: 'inherit',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                fontSize: '0.9rem',
                                                transition: 'background 0.2s',
                                                textAlign: 'left'
                                            }}
                                            onMouseEnter={(e) => !webSearchEnabled && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                                            onMouseLeave={(e) => !webSearchEnabled && (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="11" cy="11" r="8" />
                                                <path d="m21 21-4.35-4.35" />
                                            </svg>
                                            <span>{webSearchEnabled ? 'Web Search aktiv' : 'Web Search'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Hidden File Input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*,.pdf,.docx,.doc"
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                            />

                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                onPaste={handlePaste}
                                placeholder={currentProjectName ? `Nachricht im Projekt "${currentProjectName}"...` : "Nachricht an Valurion AI..."}
                                disabled={isLoading || isUploading}
                                style={{
                                    width: '100%',
                                    padding: '1rem 3rem 1rem 3.5rem',
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
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="19" x2="12" y2="5" />
                                    <polyline points="5 12 12 5 19 12" />
                                </svg>
                            </button>
                        </div>
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

                {/* Drag & Drop Overlay */}
                {isDragging && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(1, 180, 216, 0.1)',
                            backdropFilter: 'blur(8px)',
                            border: '3px dashed #01b4d8',
                            borderRadius: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999,
                            pointerEvents: 'none',
                            margin: '1rem'
                        }}
                    >
                        <div
                            style={{
                                background: 'linear-gradient(135deg, #01b4d8 0%, #0891b2 100%)',
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '1.5rem',
                                boxShadow: '0 20px 40px rgba(1, 180, 216, 0.4)',
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                            }}
                        >
                            <svg
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="white"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                        <h3
                            style={{
                                fontSize: '1.5rem',
                                fontWeight: 700,
                                color: '#01b4d8',
                                marginBottom: '0.5rem',
                                textShadow: '0 2px 10px rgba(1, 180, 216, 0.3)'
                            }}
                        >
                            Dateien hier ablegen
                        </h3>
                        <p
                            style={{
                                fontSize: '0.95rem',
                                color: 'hsl(var(--muted-foreground))',
                                opacity: 0.9
                            }}
                        >
                            Unterstützt: Bilder, PDFs, Word-Dokumente (.docx/.doc)
                        </p>
                    </div>
                )}

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
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                                <line x1="16" y1="13" x2="8" y2="13" />
                                                <line x1="16" y1="17" x2="8" y2="17" />
                                                <polyline points="10 9 9 9 8 9" />
                                            </svg>
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

            {/* Document Picker Modal */}
            {showDocPicker && (
                <>
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.4)',
                            zIndex: 9998,
                            backdropFilter: 'blur(4px)'
                        }}
                        onClick={() => setShowDocPicker(false)}
                    />
                    <div className="glass-panel"
                        style={{
                            position: 'fixed',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '100%',
                            maxWidth: '600px',
                            height: '600px',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: '1rem',
                            border: '1px solid var(--border)',
                            zIndex: 9999,
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            overflow: 'hidden'
                        }}
                    >
                        {/* Header */}
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dokument auswählen</h2>
                            <button onClick={() => setShowDocPicker(false)} className="btn btn-ghost" style={{ padding: '0.25rem' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                            <button
                                onClick={() => setDocPickerTab('my')}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
                                    background: docPickerTab === 'my' ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    border: 'none',
                                    borderBottom: docPickerTab === 'my' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                                    color: docPickerTab === 'my' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                                    fontWeight: docPickerTab === 'my' ? 600 : 400,
                                    cursor: 'pointer'
                                }}
                            >
                                Meine Dateien
                            </button>
                            <button
                                onClick={() => setDocPickerTab('shared')}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
                                    background: docPickerTab === 'shared' ? 'rgba(255,255,255,0.05)' : 'transparent',
                                    border: 'none',
                                    borderBottom: docPickerTab === 'shared' ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                                    color: docPickerTab === 'shared' ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                                    fontWeight: docPickerTab === 'shared' ? 600 : 400,
                                    cursor: 'pointer'
                                }}
                            >
                                Geteilt
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                            {isLoadingDocs ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>
                                    Lade Dokumente...
                                </div>
                            ) : !availableDocs ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>Fehler beim Laden</div>
                            ) : (
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    {(docPickerTab === 'my' ? availableDocs.myDocuments : availableDocs.sharedDocuments).length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>
                                            Keine Dateien gefunden.
                                        </div>
                                    )}

                                    {(docPickerTab === 'my' ? availableDocs.myDocuments : availableDocs.sharedDocuments).map((doc: any) => (
                                        <div
                                            key={doc.id}
                                            onClick={() => handleSelectRepoDoc(doc)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                padding: '0.75rem',
                                                borderRadius: '0.5rem',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid var(--border)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                userSelect: 'none'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                        >
                                            <div style={{
                                                width: '40px', height: '40px',
                                                borderRadius: '8px',
                                                background: 'hsl(var(--muted))',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'hsl(var(--muted-foreground))'
                                            }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                    <polyline points="14 2 14 8 20 8" />
                                                </svg>
                                            </div>
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.filename}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))', display: 'flex', gap: '0.5rem' }}>
                                                    <span>{Math.round(doc.fileSize / 1024)} KB</span>
                                                    <span>•</span>
                                                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                                                    {doc.uploaderName !== 'Me' && (
                                                        <>
                                                            <span>•</span>
                                                            <span>von {doc.uploaderName}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ color: 'hsl(var(--primary))' }}>
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <line x1="12" y1="8" x2="12" y2="16" />
                                                    <line x1="8" y1="12" x2="16" y2="12" />
                                                </svg>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
