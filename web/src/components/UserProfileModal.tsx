"use client";

import { useState } from 'react';
import { updateUserDetails } from '@/app/actions/user';
import { logoutAction } from '@/app/actions/auth';

interface UserProfileModalProps {
    user: {
        id: string;
        email: string;
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        jobTitle?: string | null;
        avatarUrl?: string | null;
        tenantName: string;
        role: string;
    };
    isOpen: boolean;
    onClose: () => void;
}

export function UserProfileModal({ user, isOpen, onClose }: UserProfileModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [firstName, setFirstName] = useState(user.firstName || '');
    const [lastName, setLastName] = useState(user.lastName || '');
    const [jobTitle, setJobTitle] = useState(user.jobTitle || '');

    // New state for avatar
    const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
    const [isUploading, setIsUploading] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const result = await updateUserDetails(user.id, { firstName, lastName, jobTitle, avatarUrl });
            if (!result.success) {
                throw new Error(result.error || 'Unbekannter Fehler');
            }
            setIsEditing(false);
            window.location.reload();
        } catch (error: any) {
            console.error('Save error:', error);
            alert(`Fehler beim Speichern: ${error.message || error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        // Basic validation
        if (file.size > 5 * 1024 * 1024) { // 5MB
            alert('Datei ist zu groß (Max 5MB)');
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload/avatar', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const data = await res.json();
            setAvatarUrl(data.url);
        } catch (error) {
            console.error(error);
            alert('Upload fehlgeschlagen');
        } finally {
            setIsUploading(false);
        }
    };


    return (
        <div style={{
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
        }} onClick={onClose}>
            <div
                className="glass-panel"
                style={{
                    width: '100%',
                    maxWidth: '550px',
                    padding: '2rem',
                    borderRadius: '1rem',
                    position: 'relative',
                    animation: 'fadeIn 0.2s ease-out'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Profil Einstellungen</h2>
                    <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.5rem' }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Header with Avatar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                        <div
                            style={{
                                position: 'relative',
                                width: '80px',
                                height: '80px',
                                cursor: isEditing ? 'pointer' : 'default'
                            }}
                            onClick={() => {
                                if (isEditing) {
                                    document.getElementById('avatar-upload')?.click();
                                }
                            }}
                        >
                            <input
                                id="avatar-upload"
                                type="file"
                                style={{ display: 'none' }}
                                onChange={handleImageUpload}
                                accept="image/*"
                                disabled={!isEditing}
                            />
                            <div style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, #8b5cf6 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2rem',
                                fontWeight: 'bold',
                                color: 'white',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                overflow: 'hidden',
                                opacity: isUploading ? 0.5 : 1
                            }}>
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    (firstName || user.email)[0].toUpperCase()
                                )}
                            </div>
                            {isEditing && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    background: 'var(--background)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.8rem',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}>
                                    📷
                                </div>
                            )}
                        </div>

                        <div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{user.tenantName}</div>
                            <div className="text-muted" style={{ fontSize: '0.9rem' }}>{user.role}</div>
                        </div>
                    </div>

                    {/* Fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="label">Vorname</label>
                            <input
                                type="text"
                                className="input-field"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                disabled={!isEditing}
                                placeholder="Max"
                            />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="label">Nachname</label>
                            <input
                                type="text"
                                className="input-field"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                disabled={!isEditing}
                                placeholder="Mustermann"
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="label">Jobtitel / Rolle</label>
                        <input
                            type="text"
                            className="input-field"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            disabled={!isEditing}
                            placeholder="z.B. Marketing Manager"
                        />
                    </div>

                    <div className="input-group">
                        <label className="label">E-Mail Adresse (Login)</label>
                        <input
                            type="email"
                            className="input-field"
                            value={user.email}
                            disabled
                            style={{ opacity: 0.7, cursor: 'not-allowed' }}
                        />
                        <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'hsl(var(--muted-foreground))', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Benutzername</span>
                            <span>Nicht änderbar</span>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                    {!isEditing && (
                        <button
                            className="btn btn-ghost"
                            style={{ color: '#ef4444', marginRight: 'auto' }}
                            onClick={async () => {
                                await logoutAction();
                            }}
                        >
                            Abmelden
                        </button>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', marginLeft: isEditing ? 'auto' : 0 }}>
                        {isEditing ? (
                            <>
                                <button className="btn btn-ghost" onClick={() => setIsEditing(false)} disabled={isLoading}>
                                    Abbrechen
                                </button>
                                <button className="btn btn-primary" onClick={handleSave} disabled={isLoading}>
                                    {isLoading ? 'Speichert...' : 'Speichern'}
                                </button>
                            </>
                        ) : (
                            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                                Profil Bearbeiten
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <style jsx global>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
