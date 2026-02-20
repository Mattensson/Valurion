'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import './project-detail.css';

interface ProjectMember {
    id: string;
    role: string;
    user: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
        jobTitle: string | null;
    };
}

interface FeedMessage {
    id: string;
    content: string;
    type: string;
    createdAt: string;
    user: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        avatarUrl: string | null;
    };
    assistant?: {
        id: string;
        name: string;
        icon: string;
    };
}

interface Project {
    id: string;
    name: string;
    description: string | null;
    nonGoals: string | null;
    owner: {
        id: string;
        firstName: string | null;
        lastName: string | null;
    };
    members: ProjectMember[];
    documents: any[];
    projectAssistant: any;
}

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'docs' | 'feed'>('overview');

    // Team tab state
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [addingMember, setAddingMember] = useState(false);

    // Feed tab state
    const [feedMessages, setFeedMessages] = useState<FeedMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);
    const [loadingFeed, setLoadingFeed] = useState(false);

    const [currentUserId, setCurrentUserId] = useState<string>('');

    useEffect(() => {
        fetchProject();
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        if (activeTab === 'feed') {
            fetchFeed();
        }
    }, [activeTab]);

    const fetchCurrentUser = async () => {
        try {
            const res = await fetch('/api/user/me');
            if (res.ok) {
                const data = await res.json();
                setCurrentUserId(data.user.id);
            }
        } catch (error) {
            console.error('Error fetching current user:', error);
        }
    };

    const fetchProject = async () => {
        try {
            const res = await fetch(`/api/projects/${params.id}`);
            if (res.ok) {
                const data = await res.json();
                setProject(data.project);
            } else {
                router.push('/dashboard/projects');
            }
        } catch (error) {
            console.error('Error fetching project:', error);
            router.push('/dashboard/projects');
        } finally {
            setLoading(false);
        }
    };

    const fetchFeed = async () => {
        setLoadingFeed(true);
        try {
            const res = await fetch(`/api/projects/${params.id}/feed`);
            if (res.ok) {
                const data = await res.json();
                setFeedMessages(data.messages);
            }
        } catch (error) {
            console.error('Error fetching feed:', error);
        } finally {
            setLoadingFeed(false);
        }
    };

    const handleAddMember = async () => {
        if (!newMemberEmail.trim()) return;

        setAddingMember(true);
        try {
            const res = await fetch(`/api/projects/${params.id}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEmail: newMemberEmail }),
            });

            if (res.ok) {
                setNewMemberEmail('');
                await fetchProject();
            } else {
                const data = await res.json();
                alert(data.error || 'Fehler beim Hinzufügen des Mitglieds');
            }
        } catch (error) {
            console.error('Error adding member:', error);
            alert('Fehler beim Hinzufügen des Mitglieds');
        } finally {
            setAddingMember(false);
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm('Möchten Sie dieses Mitglied wirklich entfernen?')) return;

        try {
            const res = await fetch(`/api/projects/${params.id}/members/${userId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                await fetchProject();
            } else {
                const data = await res.json();
                alert(data.error || 'Fehler beim Entfernen des Mitglieds');
            }
        } catch (error) {
            console.error('Error removing member:', error);
            alert('Fehler beim Entfernen des Mitglieds');
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        setSendingMessage(true);
        try {
            const res = await fetch(`/api/projects/${params.id}/feed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newMessage }),
            });

            if (res.ok) {
                const data = await res.json();
                setFeedMessages([...feedMessages, ...data.messages]);
                setNewMessage('');

                // Scroll to bottom
                setTimeout(() => {
                    const feedContainer = document.querySelector('.feed-messages');
                    if (feedContainer) {
                        feedContainer.scrollTop = feedContainer.scrollHeight;
                    }
                }, 100);
            } else {
                alert('Fehler beim Senden der Nachricht');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Fehler beim Senden der Nachricht');
        } finally {
            setSendingMessage(false);
        }
    };

    const getUserName = (user: any) => {
        if (user.firstName && user.lastName) {
            return `${user.firstName} ${user.lastName}`;
        }
        return user.email || 'Unbekannt';
    };

    const isOwner = project?.members.find(m => m.user.id === currentUserId)?.role === 'OWNER';

    if (loading) {
        return (
            <div className="project-detail-page">
                <div className="loading">Lade Projekt...</div>
            </div>
        );
    }

    if (!project) {
        return null;
    }

    return (
        <div className="project-detail-page">
            <div className="project-header">
                <button className="back-btn" onClick={() => router.push('/dashboard/projects')}>
                    ← Zurück
                </button>
                <div className="project-info">
                    <h1>📋 {project.name}</h1>
                    {project.projectAssistant && (
                        <div className="assistant-active">
                            <span>🤖</span>
                            {project.projectAssistant.name}
                        </div>
                    )}
                </div>
            </div>

            <div className="tabs">
                <button
                    className={activeTab === 'overview' ? 'active' : ''}
                    onClick={() => setActiveTab('overview')}
                >
                    📝 Übersicht
                </button>
                <button
                    className={activeTab === 'team' ? 'active' : ''}
                    onClick={() => setActiveTab('team')}
                >
                    👥 Team ({project.members.length})
                </button>
                <button
                    className={activeTab === 'docs' ? 'active' : ''}
                    onClick={() => setActiveTab('docs')}
                >
                    📁 Dokumente ({project.documents.length})
                </button>
                <button
                    className={activeTab === 'feed' ? 'active' : ''}
                    onClick={() => setActiveTab('feed')}
                >
                    💬 Feed
                </button>
            </div>

            <div className="tab-content">
                {activeTab === 'overview' && (
                    <div className="overview-tab">
                        <div className="info-card">
                            <h3>Projekt-Beschreibung</h3>
                            <p>{project.description || 'Keine Beschreibung vorhanden'}</p>
                        </div>

                        {project.nonGoals && (
                            <div className="info-card">
                                <h3>Nicht-Ziele</h3>
                                <p>{project.nonGoals}</p>
                            </div>
                        )}

                        {project.projectAssistant && (
                            <div className="info-card assistant-card">
                                <h3>🤖 Projekt-Assistent</h3>
                                <div className="assistant-info">
                                    <div className="assistant-detail">
                                        <strong>Name:</strong> {project.projectAssistant.name}
                                    </div>
                                    <div className="assistant-detail">
                                        <strong>Provider:</strong> {project.projectAssistant.provider}
                                    </div>
                                    <div className="assistant-detail">
                                        <strong>Model:</strong> {project.projectAssistant.modelId}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'team' && (
                    <div className="team-tab">
                        {isOwner && (
                            <div className="add-member-section">
                                <h3>Mitglied hinzufügen</h3>
                                <div className="add-member-form">
                                    <input
                                        type="email"
                                        placeholder="E-Mail-Adresse des Mitarbeiters"
                                        value={newMemberEmail}
                                        onChange={(e) => setNewMemberEmail(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddMember()}
                                    />
                                    <button
                                        onClick={handleAddMember}
                                        disabled={addingMember || !newMemberEmail.trim()}
                                    >
                                        {addingMember ? 'Hinzufügen...' : 'Hinzufügen'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="members-list">
                            <h3>Team-Mitglieder</h3>
                            {project.members.map((member) => (
                                <div key={member.id} className="member-item">
                                    <div className="member-avatar">
                                        {member.user.avatarUrl ? (
                                            <img src={member.user.avatarUrl} alt="" />
                                        ) : (
                                            <div className="avatar-placeholder">
                                                {(member.user.firstName?.[0] || member.user.email[0]).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="member-info">
                                        <div className="member-name">{getUserName(member.user)}</div>
                                        {member.user.jobTitle && (
                                            <div className="member-title">{member.user.jobTitle}</div>
                                        )}
                                    </div>
                                    <div className="member-role-badge">{member.role === 'OWNER' ? 'Owner' : 'Mitglied'}</div>
                                    {isOwner && member.role !== 'OWNER' && (
                                        <button
                                            className="remove-btn"
                                            onClick={() => handleRemoveMember(member.user.id)}
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'docs' && (
                    <div className="docs-tab">
                        <div className="docs-header">
                            <h3>Projekt-Dokumente</h3>
                            <button className="upload-btn">+ Dokument hochladen</button>
                        </div>

                        {project.documents.length === 0 ? (
                            <div className="empty-state-small">
                                <p>📄 Noch keine Dokumente vorhanden</p>
                            </div>
                        ) : (
                            <div className="documents-list">
                                {project.documents.map((doc) => (
                                    <div key={doc.id} className="document-item">
                                        <div className="doc-icon">📄</div>
                                        <div className="doc-info">
                                            <div className="doc-name">{doc.filename}</div>
                                            <div className="doc-meta">
                                                {(doc.fileSize / 1024).toFixed(1)} KB • {new Date(doc.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'feed' && (
                    <div className="feed-tab">
                        {loadingFeed ? (
                            <div className="loading">Lade Feed...</div>
                        ) : (
                            <>
                                <div className="feed-messages">
                                    {feedMessages.length === 0 ? (
                                        <div className="empty-state-small">
                                            <p>💬 Noch keine Nachrichten im Feed</p>
                                            <small>Erwähne @ProjectAssistant oder andere Assistenten für KI-Unterstützung</small>
                                        </div>
                                    ) : (
                                        feedMessages.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`feed-message ${msg.type === 'ASSISTANT_MENTION' ? 'assistant-message' : ''}`}
                                            >
                                                <div className="message-avatar">
                                                    {msg.type === 'ASSISTANT_MENTION' ? (
                                                        <div className="ai-avatar">{msg.assistant?.icon || '🤖'}</div>
                                                    ) : msg.user.avatarUrl ? (
                                                        <img src={msg.user.avatarUrl} alt="" />
                                                    ) : (
                                                        <div className="avatar-placeholder">
                                                            {(msg.user.firstName?.[0] || 'U').toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="message-content">
                                                    <div className="message-header">
                                                        <span className="message-author">
                                                            {msg.type === 'ASSISTANT_MENTION'
                                                                ? (msg.assistant?.name || 'KI-Assistent')
                                                                : getUserName(msg.user)}
                                                        </span>
                                                        <span className="message-time">
                                                            {new Date(msg.createdAt).toLocaleTimeString('de-DE', {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="message-text">{msg.content}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="feed-input">
                                    <input
                                        type="text"
                                        placeholder="Nachricht eingeben... (@ProjectAssistant, @Vertrags-Analyst, etc.)"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={sendingMessage || !newMessage.trim()}
                                    >
                                        {sendingMessage ? '...' : '➤'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
