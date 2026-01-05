"use client";

import { useState, useEffect } from 'react';
import { getAssistants, createAssistant, updateAssistant, deleteAssistant, AssistantData } from '@/app/actions/admin';

export function AssistantManagement() {
    const [assistants, setAssistants] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAssistant, setEditingAssistant] = useState<any | null>(null);
    const [formData, setFormData] = useState<Partial<AssistantData>>({
        name: '',
        icon: '🤖',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        description: '',
        category: '',
        systemPrompt: '',
        provider: 'OpenAI',
        modelId: 'gpt-4o',
        temperature: 0.7,
        isActive: true,
        sortOrder: 0
    });
    const [isSaving, setIsSaving] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [availableModels, setAvailableModels] = useState<{ openai: string[], gemini: string[] }>({ openai: [], gemini: [] });
    const [isFetchingModels, setIsFetchingModels] = useState(false);

    useEffect(() => {
        loadAssistants();
    }, []);

    const loadAssistants = async () => {
        setIsLoading(true);
        try {
            const data = await getAssistants();
            setAssistants(data);
        } catch (error) {
            console.error('Failed to load assistants:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (assistant?: any) => {
        if (assistant) {
            setEditingAssistant(assistant);
            setFormData(assistant);
        } else {
            setEditingAssistant(null);
            setFormData({
                name: '',
                icon: '🤖',
                gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                description: '',
                category: '',
                systemPrompt: '',
                provider: 'OpenAI',
                modelId: 'gpt-4o',
                temperature: 0.7,
                isActive: true,
                sortOrder: 0
            });
        }
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.systemPrompt) {
            alert('Name und System-Prompt sind erforderlich');
            return;
        }

        setIsSaving(true);
        try {
            const result = editingAssistant
                ? await updateAssistant({ ...formData, id: editingAssistant.id } as AssistantData)
                : await createAssistant(formData as AssistantData);

            if (result.success) {
                setShowModal(false);
                await loadAssistants();
            } else {
                alert(result.error || 'Fehler beim Speichern');
            }
        } catch (error) {
            alert('Fehler beim Speichern');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const result = await deleteAssistant(id);
            if (result.success) {
                setDeleteConfirmId(null);
                await loadAssistants();
            } else {
                alert(result.error || 'Fehler beim Löschen');
            }
        } catch (error) {
            alert('Fehler beim Löschen');
        }
    };

    if (isLoading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Lade Assistenten...</div>;
    }

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <button
                    className="btn btn-primary"
                    onClick={() => handleOpenModal()}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <span>➕</span>
                    Assistent hinzufügen
                </button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
                {assistants.map((assistant) => (
                    <div
                        key={assistant.id}
                        className="glass-panel"
                        style={{
                            padding: '1.5rem',
                            display: 'flex',
                            alignItems: 'start',
                            gap: '1rem',
                            border: assistant.isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.05)',
                            opacity: assistant.isActive ? 1 : 0.5
                        }}
                    >
                        <div
                            style={{
                                width: '60px',
                                height: '60px',
                                background: assistant.gradient,
                                borderRadius: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2rem',
                                flexShrink: 0
                            }}
                        >
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d={assistant.icon} />
                            </svg>
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{assistant.name}</h3>
                                <span
                                    style={{
                                        fontSize: '0.75rem',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '0.25rem',
                                        background: 'rgba(59, 130, 246, 0.2)',
                                        color: '#3b82f6'
                                    }}
                                >
                                    {assistant.category}
                                </span>
                                {!assistant.isActive && (
                                    <span
                                        style={{
                                            fontSize: '0.75rem',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '0.25rem',
                                            background: 'rgba(239, 68, 68, 0.2)',
                                            color: '#ef4444'
                                        }}
                                    >
                                        Inaktiv
                                    </span>
                                )}
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--muted-foreground))', margin: '0 0 0.75rem 0' }}>
                                {assistant.description}
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
                                <span>📡 {assistant.provider}</span>
                                <span>🔧 {assistant.modelId}</span>
                                <span>🌡️ {assistant.temperature}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => handleOpenModal(assistant)}
                                style={{ padding: '0.5rem 1rem' }}
                                title="Bearbeiten"
                            >
                                ✎
                            </button>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setDeleteConfirmId(assistant.id)}
                                style={{ padding: '0.5rem 1rem', color: '#ef4444' }}
                                title="Löschen"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}

                {assistants.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'hsl(var(--muted-foreground))' }}>
                        Keine Assistenten vorhanden. Erstellen Sie einen neuen Assistenten.
                    </div>
                )}
            </div>

            {/* Edit/Create Modal */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '2rem'
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="glass-panel"
                        style={{
                            maxWidth: '900px',
                            width: '100%',
                            maxHeight: '75vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '2rem', borderBottom: '1px solid var(--border)' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
                                {editingAssistant ? 'Assistent bearbeiten' : 'Neuer Assistent'}
                            </h2>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '2rem' }}>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div className="input-group">
                                    <label className="label">Name *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="z.B. Vertrags-Analyst"
                                        style={{ background: 'white', color: 'black' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="input-group">
                                        <label className="label">Icon (Emoji)</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.icon}
                                            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                            placeholder="📝"
                                            style={{ background: 'white', color: 'black' }}
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label className="label">Kategorie</label>
                                        <input
                                            type="text"
                                            className="input-field"
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            placeholder="z.B. Legal, Business"
                                            style={{ background: 'white', color: 'black' }}
                                        />
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label className="label">Gradient (CSS)</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={formData.gradient}
                                        onChange={(e) => setFormData({ ...formData, gradient: e.target.value })}
                                        placeholder="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                                        style={{ background: 'white', color: 'black' }}
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="label">Beschreibung</label>
                                    <textarea
                                        className="input-field"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Kurze Beschreibung des Assistenten..."
                                        rows={2}
                                        style={{ background: 'white', color: 'black' }}
                                    />
                                </div>

                                <div className="input-group">
                                    <label className="label">System-Prompt *</label>
                                    <textarea
                                        className="input-field"
                                        value={formData.systemPrompt}
                                        onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                                        placeholder="Du bist ein spezialisierter Assistent..."
                                        rows={8}
                                        style={{ fontFamily: 'monospace', fontSize: '0.9rem', background: 'white', color: 'black' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    <div className="input-group">
                                        <label className="label">Provider</label>
                                        <select
                                            className="input-field"
                                            value={formData.provider}
                                            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                            style={{ background: 'white', color: 'black' }}
                                        >
                                            <option value="OpenAI">OpenAI</option>
                                            <option value="Gemini">Gemini</option>
                                        </select>
                                    </div>

                                    <div className="input-group">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <label className="label" style={{ margin: 0 }}>Modell</label>
                                            <button
                                                type="button"
                                                className="btn btn-ghost"
                                                onClick={async () => {
                                                    setIsFetchingModels(true);
                                                    try {
                                                        const response = await fetch('/api/admin/models');
                                                        if (response.ok) {
                                                            const data = await response.json();
                                                            setAvailableModels(data);
                                                        }
                                                    } catch (error) {
                                                        console.error('Failed to fetch models:', error);
                                                    } finally {
                                                        setIsFetchingModels(false);
                                                    }
                                                }}
                                                disabled={isFetchingModels}
                                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', height: 'auto' }}
                                            >
                                                {isFetchingModels ? '...' : '🔄'}
                                            </button>
                                        </div>
                                        {(formData.provider === 'OpenAI' && availableModels.openai.length > 0) ||
                                            (formData.provider === 'Gemini' && availableModels.gemini.length > 0) ? (
                                            <select
                                                className="input-field"
                                                value={formData.modelId}
                                                onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                                                style={{ background: 'white', color: 'black' }}
                                            >
                                                <option value="">-- Modell wählen --</option>
                                                {(formData.provider === 'OpenAI' ? availableModels.openai : availableModels.gemini).map(model => (
                                                    <option key={model} value={model}>{model}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                className="input-field"
                                                value={formData.modelId}
                                                onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                                                placeholder="gpt-4o"
                                                style={{ background: 'white', color: 'black' }}
                                            />
                                        )}
                                    </div>

                                    <div className="input-group">
                                        <label className="label">Temperature</label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            value={formData.temperature}
                                            onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            style={{ background: 'white', color: 'black' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="input-group">
                                        <label className="label">Reihenfolge</label>
                                        <input
                                            type="number"
                                            className="input-field"
                                            value={formData.sortOrder}
                                            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
                                            style={{ background: 'white', color: 'black' }}
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.isActive}
                                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                            />
                                            <span>Aktiv</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'rgba(0,0,0,0.02)' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setShowModal(false)}
                                disabled={isSaving}
                            >
                                Abbrechen
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Speichert...' : 'Speichern'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setDeleteConfirmId(null)}
                >
                    <div
                        className="glass-panel"
                        style={{ maxWidth: '400px', padding: '2rem' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
                            Assistent löschen?
                        </h3>
                        <p style={{ marginBottom: '1.5rem', color: 'hsl(var(--muted-foreground))' }}>
                            Sind Sie sicher, dass Sie diesen Assistenten löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={() => setDeleteConfirmId(null)}
                            >
                                Abbrechen
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => handleDelete(deleteConfirmId)}
                                style={{ background: '#ef4444' }}
                            >
                                Löschen
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
