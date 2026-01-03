"use client";

import { useState, useEffect } from 'react';
import { getAIConfigurations, updateAIConfiguration, AIConfigUpdate, getAllUsers, createUser, CreateUserData, updateUserAsAdmin, UpdateUserData, deleteUser, getTenants, createTenant, updateTenant, deleteTenant, getUsersByTenant, getUserTokenUsage, getTenantTokenUsage, TokenUsageReport, TenantTokenUsageReport } from '@/app/actions/admin';

type ConfigRow = {
    provider: string;
    mode: string;
    modelId: string;
};

type User = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
    company: string | null;
    role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
    createdAt: Date | string;
};

type Tenant = {
    id: string;
    name: string;
    createdAt: Date | string;
    _count?: {
        users: number;
    };
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
    const [users, setUsers] = useState<User[]>([]);
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

    // Tenant Management
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoadingTenants, setIsLoadingTenants] = useState(false);
    const [showTenantModal, setShowTenantModal] = useState(false);
    const [editingTenant, setEditingTenant] = useState<{ id: string, name: string } | null>(null);
    const [newTenantName, setNewTenantName] = useState('');
    const [showDeleteTenantModal, setShowDeleteTenantModal] = useState(false);
    const [tenantToDelete, setTenantToDelete] = useState<string | null>(null);

    // Tenant Users Modal State
    const [showTenantUsersModal, setShowTenantUsersModal] = useState(false);
    const [selectedTenantForUsers, setSelectedTenantForUsers] = useState<Tenant | null>(null);
    const [tenantUsers, setTenantUsers] = useState<User[]>([]);
    const [isLoadingTenantUsers, setIsLoadingTenantUsers] = useState(false);

    // Collapsible Sections State
    // Reporting State
    // Reporting State
    const [tokenReport, setTokenReport] = useState<TokenUsageReport[]>([]);
    const [tenantReport, setTenantReport] = useState<TenantTokenUsageReport[]>([]);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

    // Collapsible Sections State
    const [openSections, setOpenSections] = useState({
        aiConfig: true,
        userMgmt: false,
        tenantMgmt: false,
        reporting: false
    });

    const toggleSection = (section: 'aiConfig' | 'userMgmt' | 'tenantMgmt' | 'reporting') => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    useEffect(() => {
        loadConfigs();
        loadUsers();
        loadTenants();
        // loadTokenReport is called by its own useEffect based on toggle
    }, []);

    const loadTokenReport = async () => {
        setIsLoadingReport(true);
        try {
            const [userData, tenantData] = await Promise.all([
                getUserTokenUsage(reportMonth, reportYear),
                getTenantTokenUsage(reportMonth, reportYear)
            ]);
            setTokenReport(userData as TokenUsageReport[]);
            setTenantReport(tenantData);
        } catch (error) {
            console.error('Failed to load token report', error);
        } finally {
            setIsLoadingReport(false);
        }
    };

    // Trigger reload when month/year changes
    useEffect(() => {
        if (openSections.reporting) {
            loadTokenReport();
        }
    }, [reportMonth, reportYear, openSections.reporting]);

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

    const loadTenants = async () => {
        setIsLoadingTenants(true);
        try {
            const data = await getTenants();
            setTenants(data);
        } catch (error) {
            console.error('Failed to load tenants:', error);
        } finally {
            setIsLoadingTenants(false);
        }
    };

    const handleSaveTenant = async () => {
        if (!newTenantName.trim()) return;

        try {
            if (editingTenant) {
                const res = await updateTenant(editingTenant.id, newTenantName);
                if (res.success) {
                    showNotification('Unternehmen aktualisiert', 'success');
                    setShowTenantModal(false);
                    setNewTenantName('');
                    setEditingTenant(null);
                    loadTenants();
                } else {
                    showNotification(res.error || 'Fehler', 'error');
                }
            } else {
                const res = await createTenant(newTenantName);
                if (res.success) {
                    showNotification('Unternehmen erstellt', 'success');
                    setShowTenantModal(false);
                    setNewTenantName('');
                    loadTenants();
                } else {
                    showNotification(res.error || 'Fehler', 'error');
                }
            }
        } catch (e) {
            showNotification('Fehler beim Speichern', 'error');
        }
    };

    const confirmDeleteTenant = async () => {
        if (!tenantToDelete) return;
        try {
            const res = await deleteTenant(tenantToDelete);
            if (res.success) {
                showNotification('Unternehmen gelöscht', 'success');
                loadTenants();
            } else {
                showNotification(res.error || 'Fehler', 'error');
            }
        } catch (e) {
            showNotification('Fehler beim Löschen', 'error');
        } finally {
            setShowDeleteTenantModal(false);
            setTenantToDelete(null);
        }
    };

    const handleShowTenantUsers = async (tenant: Tenant) => {
        setSelectedTenantForUsers(tenant);
        setShowTenantUsersModal(true);
        setIsLoadingTenantUsers(true);
        setTenantUsers([]);
        try {
            const users = await getUsersByTenant(tenant.id);
            setTenantUsers(users as User[]); // Cast because basic User type matches the reduced select
        } catch (error) {
            console.error(error);
            showNotification('Fehler beim Laden der Benutzer', 'error');
        } finally {
            setIsLoadingTenantUsers(false);
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

    const openEditUserModal = (user: User) => {
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
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Administration</h1>
                    <p style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Verwalten Sie AI-Konfigurationen, Benutzer und Unternehmensstrukturen.
                    </p>
                </div>
            </div>

            {/* AI Model Configuration Section */}
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', marginBottom: '2rem' }}>
                <div
                    onClick={() => toggleSection('aiConfig')}
                    style={{
                        padding: '1.5rem 2rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        borderBottom: openSections.aiConfig ? '1px solid var(--border)' : 'none'
                    }}
                >
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <span>🤖</span> AI Model Konfiguration
                    </h2>
                    <button
                        className="btn btn-ghost"
                        onClick={(e) => { e.stopPropagation(); fetchAvailableModels(); }}
                        disabled={isFetchingModels}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '1rem', fontSize: '0.8rem' }}
                    >
                        <span>🔄</span>
                        {isFetchingModels ? 'Lade...' : 'Modelle abrufen'}
                    </button>
                    <span style={{ transform: openSections.aiConfig ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>▼</span>
                </div>

                {openSections.aiConfig && (
                    <div style={{ padding: '2rem', animation: 'slideIn 0.3s ease-out' }}>
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

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem', marginBottom: '2rem' }}>
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

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Speichert...' : 'Änderungen speichern'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* User Management Section */}
            <div className="glass-panel" style={{ padding: '0', marginBottom: '2rem', overflow: 'hidden' }}>
                <div
                    onClick={() => toggleSection('userMgmt')}
                    style={{
                        padding: '1.5rem 2rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        borderBottom: openSections.userMgmt ? '1px solid var(--border)' : 'none'
                    }}
                >
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <span>👥</span> Benutzerverwaltung
                    </h2>
                    <span style={{ transform: openSections.userMgmt ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>▼</span>
                </div>

                {openSections.userMgmt && (
                    <div style={{ padding: '2rem', animation: 'slideIn 0.3s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
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
                                                <td style={{ padding: '0.75rem' }}>{user.firstName} {user.lastName}</td>
                                                <td style={{ padding: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{user.jobTitle || '-'}</td>
                                                <td style={{ padding: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{user.company || '-'}</td>
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
                                                        style={{ color: '#ef4444', padding: '0.5rem', borderRadius: '0.5rem', opacity: 0.7 }}
                                                        title="Benutzer löschen"
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
                )}
            </div>


            {/* Tenant Management Section (New) */}
            <div className="glass-panel" style={{ padding: '0', marginTop: '2rem', overflow: 'hidden' }}>
                <div
                    onClick={() => toggleSection('tenantMgmt')}
                    style={{
                        padding: '1.5rem 2rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        borderBottom: openSections.tenantMgmt ? '1px solid var(--border)' : 'none'
                    }}
                >
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <span>🏢</span> Unternehmen verwalten
                    </h2>
                    <span style={{ transform: openSections.tenantMgmt ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>▼</span>
                </div>

                {openSections.tenantMgmt && (
                    <div style={{ padding: '2rem', animation: 'slideIn 0.3s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setEditingTenant(null);
                                    setNewTenantName('');
                                    setShowTenantModal(true);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                <span>➕</span> Unternehmen anlegen
                            </button>
                        </div>

                        {isLoadingTenants ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>Lade Unternehmen...</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>ID</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'center' }}>Benutzer</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Erstellt am</th>
                                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Aktionen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tenants.map(tenant => (
                                            <tr key={tenant.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td
                                                    style={{ padding: '0.75rem', fontWeight: 600, cursor: 'pointer', color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                                                    onClick={() => handleShowTenantUsers(tenant)}
                                                    title="Klicken um Benutzer anzuzeigen"
                                                >
                                                    {tenant.name}
                                                </td>
                                                <td style={{ padding: '0.75rem', fontSize: '0.8rem', opacity: 0.6, fontFamily: 'monospace' }}>{tenant.id}</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{tenant._count?.users || 0}</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.9rem', opacity: 0.7 }}>
                                                    {new Date(tenant.createdAt).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                    <button
                                                        className="btn btn-ghost"
                                                        style={{ padding: '0.25rem 0.5rem', marginRight: '0.5rem' }}
                                                        onClick={() => {
                                                            setEditingTenant(tenant);
                                                            setNewTenantName(tenant.name);
                                                            setShowTenantModal(true);
                                                        }}
                                                    >
                                                        ✎
                                                    </button>
                                                    <button
                                                        className="btn btn-ghost"
                                                        style={{ color: '#ef4444', padding: '0.25rem 0.5rem' }}
                                                        onClick={() => {
                                                            setTenantToDelete(tenant.id);
                                                            setShowDeleteTenantModal(true);
                                                        }}
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
                )}
            </div>

            {/* SECTION: Reporting / Cost Analysis */}
            <div className={`glass-panel p-0 mb-8 overflow-hidden transition-all duration-300 ${openSections.reporting ? 'opacity-100' : 'opacity-95'}`} style={{ borderLeft: '4px solid #a855f7' }}>
                <div
                    onClick={() => toggleSection('reporting')}
                    style={{
                        padding: '1.5rem 2rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        borderBottom: openSections.reporting ? '1px solid var(--border)' : 'none'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>📊</span>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>KI-Nutzung & Reporting</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                loadTokenReport();
                            }}
                            title="Aktualisieren"
                            style={{ fontSize: '1.2rem', padding: '0.25rem 0.5rem' }}
                        >
                            ↻
                        </button>
                        <span style={{ transform: openSections.reporting ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>▼</span>
                    </div>
                </div>

                {openSections.reporting && (
                    <div style={{ padding: '2rem', animation: 'slideIn 0.3s ease-out' }}>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '0.5rem' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="label" style={{ marginBottom: '0.25rem' }}>Monat</label>
                                <select
                                    className="input-field"
                                    value={reportMonth}
                                    onChange={(e) => setReportMonth(parseInt(e.target.value))}
                                    style={{ background: "#fff", color: "#000", minWidth: '150px' }}
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleString('de-DE', { month: 'long' })}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="label" style={{ marginBottom: '0.25rem' }}>Jahr</label>
                                <select
                                    className="input-field"
                                    value={reportYear}
                                    onChange={(e) => setReportYear(parseInt(e.target.value))}
                                    style={{ background: "#fff", color: "#000", minWidth: '100px' }}
                                >
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}></div>
                            <button
                                className="btn btn-primary"
                                onClick={loadTokenReport}
                            >
                                Bericht aktualisieren
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                            {/* Company Summary Card */}
                            <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#a855f7' }}>Gesamt Token (Monat)</h3>
                                <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                                    {tenantReport.reduce((acc, curr) => acc + curr.totalTokens, 0).toLocaleString()}
                                </div>
                            </div>

                            <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem', color: '#3b82f6' }}>Aktive Nutzer (Monat)</h3>
                                <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                                    {tokenReport.filter(u => u.totalTokens > 0).length} <span style={{ fontSize: '1rem', opacity: 0.6 }}>/ {users.length}</span>
                                </div>
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', marginTop: '2rem' }}>🏢 Nutzung nach Unternehmen</h3>

                        {isLoadingReport ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>Lade Daten...</div>
                        ) : (
                            <div style={{ overflowX: 'auto', marginBottom: '3rem' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', opacity: 0.7 }}>
                                            <th style={{ padding: '1rem' }}>Unternehmen</th>
                                            <th style={{ padding: '1rem', textAlign: 'center' }}>Nutzer</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Anfragen</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Total Tokens</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tenantReport.map((row) => (
                                            <tr key={row.tenantId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '1rem', fontWeight: 600 }}>{row.name}</td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>{row.userCount}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace' }}>{row.usageCount}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', color: '#a855f7', fontWeight: 'bold' }}>
                                                    {row.totalTokens.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                        {tenantReport.length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Keine Daten für diesen Zeitraum.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>👤 Nutzung nach Benutzer</h3>

                        {isLoadingReport ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>Lade Daten...</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', opacity: 0.7 }}>
                                            <th style={{ padding: '1rem' }}>Benutzer</th>
                                            <th style={{ padding: '1rem' }}>Unternehmen</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Anfragen</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Total Tokens</th>
                                            <th style={{ padding: '1rem', textAlign: 'right' }}>Zuletzt Aktiv</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tokenReport.map((row) => (
                                            <tr key={row.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '1rem', fontWeight: 600 }}>
                                                    {row.firstName} {row.lastName}
                                                    <div style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 400 }}>{row.email}</div>
                                                </td>
                                                <td style={{ padding: '1rem', opacity: 0.9 }}>{row.company || '-'}</td>
                                                <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace' }}>
                                                    {row.usageCount}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', color: '#a855f7', fontWeight: 'bold' }}>
                                                    {row.totalTokens.toLocaleString()}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'right', fontSize: '0.9rem', opacity: 0.7 }}>
                                                    {row.lastActive ? new Date(row.lastActive).toLocaleDateString() + ' ' + new Date(row.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                        {tokenReport.length === 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                                    Keine Nutzungsdaten vorhanden.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Tenant Modal */}
            {
                showTenantModal && (
                    <div
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}
                        onClick={() => setShowTenantModal(false)}
                    >
                        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '1rem', width: '400px' }} onClick={e => e.stopPropagation()}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                                {editingTenant ? 'Unternehmen bearbeiten' : 'Neues Unternehmen'}
                            </h3>
                            <div className="input-group">
                                <label className="label">Name des Unternehmens *</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={newTenantName}
                                    onChange={e => setNewTenantName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                <button className="btn btn-ghost" onClick={() => setShowTenantModal(false)}>Abbrechen</button>
                                <button className="btn btn-primary" onClick={handleSaveTenant} disabled={!newTenantName.trim()}>Speichern</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Delete Tenant Modal */}
            {
                showDeleteTenantModal && (
                    <div
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}
                        onClick={() => setShowDeleteTenantModal(false)}
                    >
                        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '1rem', width: '400px', border: '1px solid #ef4444' }} onClick={e => e.stopPropagation()}>
                            <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: '1rem' }}>⚠️</div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', textAlign: 'center' }}>Unternehmen löschen?</h3>
                            <p style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'hsl(var(--muted-foreground))' }}>
                                Dadurch werden <strong>alle Benutzer, Chats und Daten</strong> dieses Unternehmens unwiderruflich gelöscht.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                                <button className="btn btn-ghost" onClick={() => setShowDeleteTenantModal(false)}>Abbrechen</button>
                                <button
                                    className="btn"
                                    style={{ background: '#ef4444', color: 'white', border: 'none' }}
                                    onClick={confirmDeleteTenant}
                                >
                                    Ja, alles löschen
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add User Modal */}
            {
                showAddUserModal && (
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
                                    <label className="label">Unternehmen (Tenant)</label>
                                    <select
                                        className="input-field"
                                        value={newUser.tenantId || ''}
                                        onChange={(e) => {
                                            const selectedTenantId = e.target.value;
                                            const selectedTenant = tenants.find(t => t.id === selectedTenantId);
                                            setNewUser({
                                                ...newUser,
                                                tenantId: selectedTenantId,
                                                company: selectedTenant ? selectedTenant.name : (selectedTenantId === '' ? '' : newUser.company)
                                            });
                                        }}
                                        style={{ background: "#fff", color: "#000" }}
                                    >
                                        <option value="">-- Keine Zuordnung (Standard) --</option>
                                        {tenants.map(tenant => (
                                            <option key={tenant.id} value={tenant.id}>
                                                {tenant.name}
                                            </option>
                                        ))}
                                    </select>
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
                )
            }

            {/* Notification Modal (at cursor position) */}
            {
                notificationModal.show && (
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
                )
            }

            {/* Success Modal */}
            {
                showSuccessModal && (
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
                )
            }

            {/* Delete Confirmation Modal */}
            {
                showDeleteConfirmModal && (
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
                )
            }
            {/* Tenant Users Modal */}
            {
                showTenantUsersModal && selectedTenantForUsers && (
                    <div
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                        }}
                        onClick={() => setShowTenantUsersModal(false)}
                    >
                        <div
                            className="glass-panel"
                            style={{ padding: '2rem', borderRadius: '1rem', width: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                                        Benutzer von {selectedTenantForUsers.name}
                                    </h3>
                                    <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))' }}>
                                        {selectedTenantForUsers.id}
                                    </p>
                                </div>
                                <button className="btn btn-ghost" onClick={() => setShowTenantUsersModal(false)}>✕</button>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {isLoadingTenantUsers ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>Lade Benutzer...</div>
                                ) : tenantUsers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(var(--muted-foreground))' }}>
                                        Keine Benutzer in diesem Unternehmen gefunden.
                                    </div>
                                ) : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Name</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Email</th>
                                                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Rolle</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tenantUsers.map(u => (
                                                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
                                                    <td style={{ padding: '0.5rem' }}>{u.firstName} {u.lastName}</td>
                                                    <td style={{ padding: '0.5rem' }}>{u.email}</td>
                                                    <td style={{ padding: '0.5rem' }}>
                                                        <span style={{
                                                            padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem',
                                                            background: u.role === 'ADMIN' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                                            color: u.role === 'ADMIN' ? '#3b82f6' : '#22c55e'
                                                        }}>
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                                <button className="btn btn-primary" onClick={() => setShowTenantUsersModal(false)}>Schließen</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
