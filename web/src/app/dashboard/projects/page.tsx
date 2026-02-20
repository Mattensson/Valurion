'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import './projects.css';

interface Project {
    id: string;
    name: string;
    description: string | null;
    owner: {
        firstName: string | null;
        lastName: string | null;
    };
    members: any[];
    documentCount: number;
    hasAssistant: boolean;
    createdAt: string;
    updatedAt: string;
}

// SVG Icons
const FolderIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);

const PlusIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const ClipboardIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
);

const UsersIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const FileTextIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

const BotIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
);

export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProject, setNewProject] = useState({
        name: '',
        description: '',
        nonGoals: '',
    });
    const [creating, setCreating] = useState(false);
    const [creatingWithAssistant, setCreatingWithAssistant] = useState(false);

    // Ref to prevent double-clicks
    const isCreatingRef = useRef(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data.projects);
            }
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async (withAssistant: boolean) => {
        if (!newProject.name.trim()) {
            alert('Bitte geben Sie einen Projektnamen ein');
            return;
        }

        // Prevent double-clicks with ref
        if (isCreatingRef.current) {
            console.log('Already creating project, ignoring click');
            return;
        }

        // Prevent double-clicks with state
        if (creating || creatingWithAssistant) {
            return;
        }

        // Set ref immediately
        isCreatingRef.current = true;

        if (withAssistant) {
            setCreatingWithAssistant(true);
        } else {
            setCreating(true);
        }

        try {
            // Create project
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject),
            });

            if (!res.ok) {
                throw new Error('Failed to create project');
            }

            const data = await res.json();
            const projectId = data.project.id;

            // If with assistant, create assistant
            if (withAssistant) {
                const assistantRes = await fetch(`/api/projects/${projectId}/create-assistant`, {
                    method: 'POST',
                });

                if (!assistantRes.ok) {
                    console.error('Failed to create assistant');
                }
            }

            // Reset form and refresh
            setNewProject({ name: '', description: '', nonGoals: '' });
            setShowCreateModal(false);
            await fetchProjects();

            // Navigate to project
            router.push(`/dashboard/projects/${projectId}`);

        } catch (error) {
            console.error('Error creating project:', error);
            alert('Fehler beim Erstellen des Projekts');
        } finally {
            setCreating(false);
            setCreatingWithAssistant(false);
            isCreatingRef.current = false; // Reset ref
        }
    };

    const getProjectEmoji = (index: number) => {
        const emojis = ['🚀', '📊', '💡', '🎯', '🔬', '📱', '🏗️', '⚡', '🌟', '🎨'];
        return emojis[index % emojis.length];
    };

    if (loading) {
        return (
            <div className="projects-page">
                <div className="loading">Lade Projekte...</div>
            </div>
        );
    }

    return (
        <div className="projects-page">
            <div className="projects-header">
                <div className="projects-title">
                    <div className="title-with-icon">
                        <FolderIcon />
                        <h1>Projekte</h1>
                    </div>
                    <p>Organisiere deine Arbeit in dedizierten Projekt-Workspaces</p>
                </div>
                <button
                    className="create-project-btn"
                    onClick={() => setShowCreateModal(true)}
                >
                    <PlusIcon /> Neues Projekt
                </button>
            </div>

            {projects.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon"><ClipboardIcon /></div>
                    <h2>Noch keine Projekte</h2>
                    <p>Erstelle dein erstes Projekt um loszulegen</p>
                    <button
                        className="create-first-btn"
                        onClick={() => setShowCreateModal(true)}
                    >
                        Projekt erstellen
                    </button>
                </div>
            ) : (
                <div className="projects-grid">
                    {projects.map((project, index) => (
                        <div
                            key={project.id}
                            className="project-card"
                            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                        >
                            <div className="project-card-header">
                                <div className="project-icon"><FolderIcon /></div>
                                {project.hasAssistant && (
                                    <div className="assistant-badge" title="KI-Assistent aktiv">
                                        <BotIcon />
                                    </div>
                                )}
                            </div>
                            <h3>{project.name}</h3>
                            {project.description && (
                                <p className="project-description">
                                    {project.description.length > 100
                                        ? project.description.substring(0, 100) + '...'
                                        : project.description}
                                </p>
                            )}
                            <div className="project-stats">
                                <div className="stat">
                                    <UsersIcon />
                                    <span>{project.members.length} Mitglied{project.members.length !== 1 ? 'er' : ''}</span>
                                </div>
                                <div className="stat">
                                    <FileTextIcon />
                                    <span>{project.documentCount} Dokument{project.documentCount !== 1 ? 'e' : ''}</span>
                                </div>
                            </div>
                            <div className="project-owner">
                                von {project.owner.firstName && project.owner.lastName
                                    ? `${project.owner.firstName} ${project.owner.lastName}`
                                    : 'Unbekannt'}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Neues Projekt erstellen</h2>
                            <button
                                className="close-btn"
                                onClick={() => setShowCreateModal(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="modal-body">
                            <div className="form-group">
                                <label>Projektname *</label>
                                <input
                                    type="text"
                                    placeholder="z.B. Marketing Campaign Q1"
                                    value={newProject.name}
                                    onChange={(e) =>
                                        setNewProject({ ...newProject, name: e.target.value })
                                    }
                                />
                            </div>

                            <div className="form-group">
                                <label>Beschreibung & Ziele</label>
                                <textarea
                                    placeholder="Was ist das Ziel dieses Projekts? Was soll erreicht werden?"
                                    rows={4}
                                    value={newProject.description}
                                    onChange={(e) =>
                                        setNewProject({ ...newProject, description: e.target.value })
                                    }
                                />
                            </div>

                            <div className="form-group">
                                <label>Was ist NICHT Teil des Projekts</label>
                                <textarea
                                    placeholder="Was soll explizit nicht gemacht werden?"
                                    rows={3}
                                    value={newProject.nonGoals}
                                    onChange={(e) =>
                                        setNewProject({ ...newProject, nonGoals: e.target.value })
                                    }
                                />
                                <small>Hilft dem KI-Assistenten, den Scope zu verstehen</small>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button
                                className="btn-secondary"
                                onClick={() => handleCreateProject(false)}
                                disabled={creating || creatingWithAssistant}
                            >
                                {creating ? 'Erstelle...' : 'Nur Projekt erstellen'}
                            </button>
                            <button
                                className="btn-primary"
                                onClick={() => handleCreateProject(true)}
                                disabled={creating || creatingWithAssistant}
                            >
                                {creatingWithAssistant ? (
                                    <>
                                        <span className="spinner"></span>
                                        KI-Assistent wird erstellt...
                                    </>
                                ) : (
                                    <>
                                        <BotIcon />
                                        Mit KI-Assistent erstellen
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
