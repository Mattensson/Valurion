"use client";

import { useState, useEffect } from 'react';
import { getAIConfigurations, updateAIConfiguration, AIConfigUpdate, getAllUsers, createUser, CreateUserData, updateUserAsAdmin, UpdateUserData, deleteUser } from '@/app/actions/admin';

type ConfigRow = {
    provider: string;
    mode: string;
    modelId: string;
};

export default function AIConfigPage() {
    const [configs, setConfigs] = useState<ConfigRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editedConfigs, setEditedConfigs] = useState<ConfigRow[]>([]);

    // Available models from APIs
    const [availableModels, setAvailableModels] = useState<{ openai: string[], gemini: string[] }>({ openai: [], gemini: [] });
    const [isFetchingModels, setIsFetchingModels] = useState(false);

    // Success Modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // User Management
    const [users, setUsers] = useState<any[]>([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [newUser, setNewUser] = useState<CreateUserData>({
        email: '',
        firstName: '',
        lastName: '',
        jobTitle: '',
        password: '',
        role: 'USER',
    });
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    // Notification Modal
    const [notificationModal, setNotificationModal] = useState<{
        show: boolean;
        message: string;
        type: 'success' | 'error';
        position: { x: number; y: number };
    }>({ show: false, message: '', type: 'success', position: { x: 0, y: 0 } });

    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    // Delete User State
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);

    useEffect(() => {
        loadConfigs();
        loadUsers();
    }, []);

    const loadConfigs = async () => {
        try {
            const data = await getAIConfigurations();
            setConfigs(data);
            setEditedConfigs(JSON.parse(JSON.stringify(data))); // Deep copy
        } catch (error) {
            console.error('Failed to load configs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates: AIConfigUpdate[] = editedConfigs.map(c => ({
                provider: c.provider,
                mode: c.mode,
                modelId: c.modelId,
            }));

            const result = await updateAIConfiguration(updates);
            if (result.success) {
                setConfigs(editedConfigs);
                setShowSuccessModal(true);
            } else {
                alert('Fehler beim Speichern: ' + result.error);
            }
        } catch (error) {
            alert('Fehler beim Speichern');
        } finally {
            setIsSaving(false);
        }
    };

    const fetchAvailableModels = async () => {
        setIsFetchingModels(true);
        try {
            const response = await fetch('/api/admin/models');
            if (response.ok) {
                const data = await response.json();
                console.log('Fetched models:', data);
                setAvailableModels(data);
                console.log('Available models state:', data);
            } else {
                alert('Fehler beim Laden der Modelle');
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            alert('Fehler beim Laden der Modelle');
        } finally {
            setIsFetchingModels(false);
        }
    };

    const updateConfig = (provider: string, mode: string, modelId: string) => {
        setEditedConfigs(prev => {
            const existing = prev.find(c => c.provider === provider && c.mode === mode);
            if (existing) {
                return prev.map(c =>
                    c.provider === provider && c.mode === mode
                        ? { ...c, modelId }
                        : c
                );
            } else {
                return [...prev, { provider, mode, modelId }];
            }
        });
    };

    const getModelId = (provider: string, mode: string) => {
        const config = editedConfigs.find(c => c.provider === provider && c.mode === mode);
        return config?.modelId || '';
    };

    const loadUsers = async () => {
        setIsLoadingUsers(true);
        try {
            const data = await getAllUsers();
            setUsers(data);
        } catch (error) {
            console.error('Failed to load users:', error);
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const showNotification = (message: string, type: 'success' | 'error', event?: React.MouseEvent) => {
        const x = event?.clientX || window.innerWidth / 2;
        const y = event?.clientY || window.innerHeight / 2;
        setNotificationModal({ show: true, message, type, position: { x, y } });
        setTimeout(() => {
            setNotificationModal(prev => ({ ...prev, show: false }));
        }, 3000);
    };

    const openEditUserModal = (user: any) => {
        setNewUser({
            email: user.email,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            jobTitle: user.jobTitle || '',
            company: user.company || '',
            password: '', // Password empty on edit unless changed
            role: user.role,
        });
        setSelectedUserId(user.id);
        setShowAddUserModal(true);
    };

    const openAddUserModal = () => {
        setNewUser({
            email: '',
            firstName: '',
            lastName: '',
            jobTitle: '',
            company: '',
            password: '',
            role: 'USER',
        });
        setSelectedUserId(null);
        setShowAddUserModal(true);
    };

    const handleSaveUser = async (event?: React.MouseEvent) => {
        if (!newUser.email || !newUser.firstName || !newUser.lastName) {
            showNotification('Bitte füllen Sie alle Pflichtfelder aus', 'error', event);
            return;
        }

        if (!selectedUserId && !newUser.password) {
            showNotification('Passwort ist beim Erstellen Pflicht', 'error', event);
            return;
        }

        setIsCreatingUser(true);
        try {
            let result;
            if (selectedUserId) {
                // Update existing user
                result = await updateUserAsAdmin({
                    id: selectedUserId,
                    ...newUser
                });
            } else {
                // Create new user
                result = await createUser(newUser as CreateUserData);
            }

            if (result.success) {
                setShowAddUserModal(false);
                setNewUser({
                    email: '',
                    firstName: '',
                    lastName: '',
                    jobTitle: '',
                    company: '',
                    password: '',
                    role: 'USER',
                });
                setSelectedUserId(null);
                await loadUsers();
                showNotification(selectedUserId ? 'Benutzer aktualisiert!' : 'Benutzer erstellt!', 'success', event);
            } else {
                showNotification(result.error || 'Fehler beim Speichern', 'error', event);
            }
        } catch (error) {
            showNotification('Fehler beim Speichern', 'error', event);
        } finally {
            setIsCreatingUser(false);
        }
    };

    const promptDeleteUser = (userId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        setUserToDeleteId(userId);
        setShowDeleteConfirmModal(true);
    };

    const confirmDeleteUser = async () => {
        if (!userToDeleteId) return;

        try {
            const result = await deleteUser(userToDeleteId);
            if (result.success) {
                showNotification('Benutzer erfolgreich gelöscht', 'success');
                await loadUsers();
            } else {
                showNotification(result.error || 'Fehler beim Löschen', 'error');
            }
        } catch (error) {
            showNotification('Fehler beim Löschen des Benutzers', 'error');
        } finally {
            setShowDeleteConfirmModal(false);
            setUserToDeleteId(null);
        }
    };

    if (isLoading) {
        return (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>Lädt...</div>
            </div>
        );
    }

    return (
        <div style={{ flex: 1, padding: '2rem', maxWidth: '900px', margin: '0 auto', overflowY: 'auto', height: '100vh' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>AI Model Konfiguration</h1>
                    <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Definieren Sie, welche KI-Modelle für die verschiedenen Modi verwendet werden sollen.
                    </p>
                </div>
                <button
                    className="btn btn-ghost"
                    onClick={fetchAvailableModels}
                    disabled={isFetchingModels}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <span>🔄</span>
                    {isFetchingModels ? 'Lade Modelle...' : 'Verfügbare Modelle abrufen'}
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>🤖</span> OpenAI Modelle
                    </h2>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div className="input-group">
                            <label className="label">Fast Mode</label>
                            {availableModels.openai.length > 0 ? (
                                <select
                                    className="input-field"
                                    value={getModelId('OpenAI', 'fast')}
                                    onChange={(e) => updateConfig('OpenAI', 'fast', e.target.value)}
                                >
                                    <option value="">-- Modell auswählen --</option>
                                    {availableModels.openai.map(model => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="z.B. gpt-4o-mini"
                                    value={getModelId('OpenAI', 'fast')}
                                    onChange={(e) => updateConfig('OpenAI', 'fast', e.target.value)}
                                />
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                                Schnelle Antworten für einfache Anfragen
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="label">Thinking Mode</label>
                            {availableModels.openai.length > 0 ? (
                                <select
                                    className="input-field"
                                    value={getModelId('OpenAI', 'thinking')}
                                    onChange={(e) => updateConfig('OpenAI', 'thinking', e.target.value)}
                                >
                                    <option value="">-- Modell auswählen --</option>
                                    {availableModels.openai.map(model => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="z.B. gpt-4o"
                                    value={getModelId('OpenAI', 'thinking')}
                                    onChange={(e) => updateConfig('OpenAI', 'thinking', e.target.value)}
                                />
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                                Tiefgründige Analyse für komplexe Aufgaben
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>✨</span> Google Gemini Modelle
                    </h2>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div className="input-group">
                            <label className="label">Fast Mode</label>
                            {availableModels.gemini.length > 0 ? (
                                <select
                                    className="input-field"
                                    value={getModelId('Gemini', 'fast')}
                                    onChange={(e) => updateConfig('Gemini', 'fast', e.target.value)}
                                >
                                    <option value="">-- Modell auswählen --</option>
                                    {availableModels.gemini.map(model => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="z.B. gemini-2.0-flash-exp"
                                    value={getModelId('Gemini', 'fast')}
                                    onChange={(e) => updateConfig('Gemini', 'fast', e.target.value)}
                                />
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                                Schnelle Antworten für einfache Anfragen
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="label">Thinking Mode</label>
                            {availableModels.gemini.length > 0 ? (
                                <select
                                    className="input-field"
                                    value={getModelId('Gemini', 'thinking')}
                                    onChange={(e) => updateConfig('Gemini', 'thinking', e.target.value)}
                                >
                                    <option value="">-- Modell auswählen --</option>
                                    {availableModels.gemini.map(model => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="z.B. gemini-2.0-pro-exp"
                                    value={getModelId('Gemini', 'thinking')}
                                    onChange={(e) => updateConfig('Gemini', 'thinking', e.target.value)}
                                />
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', marginTop: '0.25rem' }}>
                                Tiefgründige Analyse für komplexe Aufgaben
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button
                        className="btn btn-ghost"
                        onClick={() => setEditedConfigs(JSON.parse(JSON.stringify(configs)))}
                        disabled={isSaving}
                    >
                        Zurücksetzen
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? 'Speichert...' : 'Änderungen speichern'}
                    </button>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '2rem', background: 'rgba(59, 130, 246, 0.1)' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '1.5rem' }}>💡</div>
                    <div>
                        <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Hinweis zu Modellnamen</h3>
                        <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))' }}>
                            Geben Sie die exakte Model-ID an, wie sie von der jeweiligen API erwartet wird.
                            Beispiele: <code style={{ background: 'rgba(0,0,0,0.2)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>gpt-4o</code>,
                            <code style={{ background: 'rgba(0,0,0,0.2)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', marginLeft: '0.5rem' }}>gemini-2.0-flash-exp</code>
                        </p>
                    </div>
                </div>
            </div>

            {/* User Management Section */}
            <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>👥</span> Benutzerverwaltung
                    </h2>
                    <button
                        className="btn btn-primary"
                        onClick={openAddUserModal}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <span>➕</span>
                        Benutzer hinzufügen
                    </button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div className="input-group">
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Suchen nach Name, Email, Position..."
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}
                        />
                    </div>
                </div>

                {isLoadingUsers ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>
                        Lade Benutzer...
                    </div>
                ) : users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>
                        Keine Benutzer gefunden
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>E-Mail</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Name</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Position</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Firma</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Rolle</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>Erstellt am</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>Aktionen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.filter(user => {
                                    if (!userSearchQuery) return true;
                                    const searchLower = userSearchQuery.toLowerCase();
                                    return (
                                        user.email?.toLowerCase().includes(searchLower) ||
                                        user.firstName?.toLowerCase().includes(searchLower) ||
                                        user.lastName?.toLowerCase().includes(searchLower) ||
                                        user.jobTitle?.toLowerCase().includes(searchLower)
                                    );
                                }).map((user) => (
                                    <tr
                                        key={user.id}
                                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'background 0.2s' }}
                                        onClick={() => openEditUserModal(user)}
                                        className="hover:bg-white/5"
                                    >
                                        <td style={{ padding: '0.75rem' }}>{user.email}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            {user.firstName} {user.lastName}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                            {user.jobTitle || '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                                            {user.company || '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '0.5rem',
                                                fontSize: '0.85rem',
                                                fontWeight: 500,
                                                background: user.role === 'SUPER_ADMIN' ? 'rgba(239, 68, 68, 0.2)' :
                                                    user.role === 'ADMIN' ? 'rgba(59, 130, 246, 0.2)' :
                                                        'rgba(34, 197, 94, 0.2)',
                                                color: user.role === 'SUPER_ADMIN' ? '#ef4444' :
                                                    user.role === 'ADMIN' ? '#3b82f6' :
                                                        '#22c55e'
                                            }}>
                                                {user.role === 'SUPER_ADMIN' ? 'Super Admin' :
                                                    user.role === 'ADMIN' ? 'Admin' :
                                                        'Benutzer'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'hsl(var(--muted-foreground))', fontSize: '0.9rem' }}>
                                            {new Date(user.createdAt).toLocaleDateString('de-DE', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit'
                                            })}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            <button
                                                className="btn btn-ghost"
                                                onClick={(e) => promptDeleteUser(user.id, e)}
                                                style={{
                                                    color: '#ef4444',
                                                    padding: '0.5rem',
                                                    borderRadius: '0.5rem',
                                                    opacity: 0.7
                                                }}
                                                title="Benutzer löschen"
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add User Modal */}
            {showAddUserModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => !isCreatingUser && setShowAddUserModal(false)}
                >
                    <div
                        className="glass-panel"
                        style={{
                            padding: '2rem',
                            borderRadius: '1rem',
                            maxWidth: '500px',
                            width: '90%',
                            animation: 'fadeIn 0.2s ease-out'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                            {selectedUserId ? 'Benutzer bearbeiten' : 'Neuen Benutzer hinzufügen'}
                        </h3>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div className="input-group">
                                <label className="label">E-Mail *</label>
                                <input
                                    type="email"
                                    className="input-field"
                                    placeholder="benutzer@beispiel.de"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    style={{ background: '#fff', color: '#000' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="input-group">
                                    <label className="label">Vorname *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Max"
                                        value={newUser.firstName}
                                        onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                                        style={{ background: "#fff", color: "#000" }}
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="label">Nachname *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Mustermann"
                                        value={newUser.lastName}
                                        onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                                        style={{ background: "#fff", color: "#000" }}
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label className="label">Position</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="z.B. Entwickler"
                                    value={newUser.jobTitle}
                                    onChange={(e) => setNewUser({ ...newUser, jobTitle: e.target.value })}
                                    style={{ background: "#fff", color: "#000" }}
                                />
                            </div>

                            <div className="input-group">
                                <label className="label">Firma</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="z.B. Valurion GmbH"
                                    value={newUser.company || ''}
                                    onChange={(e) => setNewUser({ ...newUser, company: e.target.value })}
                                    style={{ background: "#fff", color: "#000" }}
                                />
                            </div>

                            <div className="input-group">
                                <label className="label">Passwort {selectedUserId ? '(leer lassen für keine Änderung)' : '*'}</label>
                                <input
                                    type="password"
                                    className="input-field"
                                    placeholder={selectedUserId ? "Neues Passwort (optional)" : "Sicheres Passwort"}
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    style={{ background: "#fff", color: "#000" }}
                                />
                            </div>

                            <div className="input-group">
                                <label className="label">Rolle *</label>
                                <select
                                    className="input-field"
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'USER' | 'ADMIN' })}
                                    style={{ background: "#fff", color: "#000" }}
                                >
                                    <option value="USER">Benutzer</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowAddUserModal(false)}
                                disabled={isCreatingUser}
                            >
                                Abbrechen
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={(e) => handleSaveUser(e)}
                                disabled={isCreatingUser}
                            >
                                {isCreatingUser ? 'Speichere...' : (selectedUserId ? 'Änderungen speichern' : 'Benutzer erstellen')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Modal (at cursor position) */}
            {notificationModal.show && (
                <div
                    className="glass-panel"
                    style={{
                        position: 'fixed',
                        left: `${notificationModal.position.x}px`,
                        top: `${notificationModal.position.y}px`,
                        transform: 'translate(-50%, -120%)',
                        padding: '1rem 1.5rem',
                        borderRadius: '0.75rem',
                        zIndex: 10000,
                        minWidth: '250px',
                        maxWidth: '400px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        border: notificationModal.type === 'success'
                            ? '2px solid rgba(34, 197, 94, 0.5)'
                            : '2px solid rgba(239, 68, 68, 0.5)',
                        background: notificationModal.type === 'success'
                            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))'
                            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))',
                        animation: 'slideInDown 0.3s ease-out',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            fontSize: '1.5rem',
                            flexShrink: 0
                        }}>
                            {notificationModal.type === 'success' ? '✅' : '❌'}
                        </div>
                        <div style={{
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            color: notificationModal.type === 'success' ? '#22c55e' : '#ef4444'
                        }}>
                            {notificationModal.message}
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setShowSuccessModal(false)}
                >
                    <div
                        className="glass-panel"
                        style={{
                            padding: '2rem',
                            borderRadius: '1rem',
                            maxWidth: '400px',
                            textAlign: 'center',
                            animation: 'fadeIn 0.2s ease-out'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Konfiguration erfolgreich gespeichert!</h3>
                        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>
                            Die neuen Modell-Einstellungen wurden übernommen.
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowSuccessModal(false)}
                            style={{ width: '100%' }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirmModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setShowDeleteConfirmModal(false)}
                >
                    <div
                        className="glass-panel"
                        style={{
                            padding: '2rem',
                            borderRadius: '1rem',
                            maxWidth: '400px',
                            width: '90%',
                            animation: 'fadeIn 0.2s ease-out'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ef4444' }}>
                            Benutzer löschen?
                        </h3>
                        <p style={{ color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                            Möchten Sie diesen Benutzer wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten des Benutzers werden unwiderruflich entfernt.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowDeleteConfirmModal(false)}
                            >
                                Abbrechen
                            </button>
                            <button
                                className="btn"
                                onClick={confirmDeleteUser}
                                style={{
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: 600
                                }}
                            >
                                Löschen bestätigen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
