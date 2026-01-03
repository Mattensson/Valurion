"use client";

import { useState, useEffect, useRef } from 'react';
import { getDocuments, uploadDocument, deleteDocument, DocumentDTO, getDocumentShares, searchUsersForSharing, shareDocument, unshareDocument, UserDTO } from '@/app/actions/documents';

export default function DocumentsPage() {
    const [activeTab, setActiveTab] = useState<'mine' | 'shared'>('mine');
    const [myDocs, setMyDocs] = useState<DocumentDTO[]>([]);
    const [sharedDocs, setSharedDocs] = useState<DocumentDTO[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // Drag & Drop
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteModalPosition, setDeleteModalPosition] = useState({ x: 0, y: 0 });
    const [docToDelete, setDocToDelete] = useState<string | null>(null);

    // Share Modal State
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const [shareModalPosition, setShareModalPosition] = useState({ x: 0, y: 0 });
    const [docToShare, setDocToShare] = useState<string | null>(null);
    const [sharedUsers, setSharedUsers] = useState<UserDTO[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserDTO[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        loadDocs();
    }, []);

    const loadDocs = async () => {
        setIsLoading(true);
        try {
            const data = await getDocuments();
            setMyDocs(data.myDocuments as DocumentDTO[]);
            setSharedDocs(data.sharedDocuments as DocumentDTO[]);
        } catch (error) {
            console.error('Failed to load documents', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await uploadFile(e.target.files[0]);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await uploadFile(e.dataTransfer.files[0]);
        }
    };

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await uploadDocument(formData);
            if (res.error) {
                alert('Upload failed: ' + res.error);
            } else {
                await loadDocs();
            }
        } catch (error) {
            alert('Upload error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleShareClick = async (e: React.MouseEvent, id: string) => {
        setDocToShare(id);
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setShareModalPosition({ x: rect.left, y: rect.bottom + 10 });
        setShareModalOpen(true);

        // Load current shares
        try {
            const shares = await getDocumentShares(id);
            setSharedUsers(shares);
        } catch (error) {
            console.error('Failed to load shares', error);
        }
    };

    const handleSearchUsers = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const results = await searchUsersForSharing(query);
            // Filter out already shared users
            const filtered = results.filter(r => !sharedUsers.some(s => s.id === r.id));
            setSearchResults(filtered);
        } catch (error) {
            console.error('Search failed', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddShare = async (userId: string) => {
        if (!docToShare) return;

        const res = await shareDocument(docToShare, userId);
        if (res.error) {
            alert('Teilen fehlgeschlagen: ' + res.error);
        } else {
            // Reload shares
            const shares = await getDocumentShares(docToShare);
            setSharedUsers(shares);
            setSearchQuery('');
            setSearchResults([]);
            await loadDocs(); // Refresh doc list to update share count
        }
    };

    const handleRemoveShare = async (userId: string) => {
        if (!docToShare) return;

        const res = await unshareDocument(docToShare, userId);
        if (res.error) {
            alert('Freigabe entfernen fehlgeschlagen: ' + res.error);
        } else {
            const shares = await getDocumentShares(docToShare);
            setSharedUsers(shares);
            await loadDocs();
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, id: string) => {
        setDocToDelete(id);
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setDeleteModalPosition({ x: rect.left, y: rect.bottom + 10 });
        setDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!docToDelete) return;
        setDeleteModalOpen(false);
        await deleteDocument(docToDelete);
        await loadDocs();
        setDocToDelete(null);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getIcon = (mimeType: string) => {
        if (mimeType.includes('pdf')) return '📄';
        if (mimeType.includes('image')) return '🖼️';
        if (mimeType.includes('text')) return '📝';
        if (mimeType.includes('spreadsheet') || mimeType.includes('csv') || mimeType.includes('excel')) return '📊';
        return '📁';
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', color: '#000' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Dokumente</h1>
                    <p style={{ opacity: 0.7 }}>Verwalten und teilen Sie Ihre Unternehmensdokumente.</p>
                </div>
            </div>

            {/* Upload Area */}
            <div
                className={`glass-panel ${isDragging ? 'bg-blue-500/10 borderColor-blue-500' : ''}`}
                style={{
                    padding: '2rem',
                    marginBottom: '2rem',
                    borderStyle: 'dashed',
                    borderWidth: '2px',
                    borderColor: isDragging ? '#3b82f6' : 'rgba(0,0,0,0.1)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'rgba(0,0,0,0.02)'
                }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                />
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>☁️</div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {isUploading ? 'Wird hochgeladen...' : 'Datei hier ablegen oder klicken zum Hochladen'}
                </h3>
                <p style={{ opacity: 0.5 }}>Unterstützt PDF, Word, Excel, Bilder, TXT</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '0.5rem' }}>
                <button
                    onClick={() => setActiveTab('mine')}
                    style={{
                        padding: '0.5rem 1rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'mine' ? '2px solid #a855f7' : '2px solid transparent',
                        color: activeTab === 'mine' ? '#000' : 'rgba(0,0,0,0.5)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        fontSize: '1rem', fontWeight: 500
                    }}
                >
                    🔒 Meine Dokumente ({myDocs.length})
                </button>
                <button
                    onClick={() => setActiveTab('shared')}
                    style={{
                        padding: '0.5rem 1rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'shared' ? '2px solid #3b82f6' : '2px solid transparent',
                        color: activeTab === 'shared' ? '#000' : 'rgba(0,0,0,0.5)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        fontSize: '1rem', fontWeight: 500
                    }}
                >
                    👥 Mit mir geteilt ({sharedDocs.length})
                </button>
            </div>

            {/* Share Modal */}
            {shareModalOpen && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
                        onClick={() => {
                            setShareModalOpen(false);
                            setSearchQuery('');
                            setSearchResults([]);
                        }}
                    />
                    <div className="glass-panel" style={{
                        position: 'fixed',
                        left: shareModalPosition.x,
                        top: shareModalPosition.y,
                        zIndex: 1001,
                        padding: '1.5rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        background: 'white',
                        color: 'black',
                        minWidth: '320px',
                        maxWidth: '400px',
                        transform: 'translateX(-50%)',
                        maxHeight: '500px',
                        overflow: 'auto'
                    }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Dokument teilen</h3>

                        {/* Currently Shared With */}
                        {sharedUsers.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <p style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem', opacity: 0.7 }}>Geteilt mit:</p>
                                {sharedUsers.map(user => (
                                    <div key={user.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.5rem',
                                        background: 'rgba(59, 130, 246, 0.05)',
                                        borderRadius: '4px',
                                        marginBottom: '0.25rem'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{user.name}</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{user.email}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveShare(user.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                padding: '0.25rem 0.5rem'
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Search Input */}
                        <div style={{ marginBottom: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="User suchen (Name oder E-Mail)..."
                                value={searchQuery}
                                onChange={(e) => handleSearchUsers(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid rgba(0,0,0,0.2)',
                                    borderRadius: '4px',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <div style={{ marginTop: '0.5rem' }}>
                                {searchResults.map(user => (
                                    <div
                                        key={user.id}
                                        onClick={() => handleAddShare(user.id)}
                                        style={{
                                            padding: '0.5rem',
                                            background: 'rgba(0,0,0,0.02)',
                                            borderRadius: '4px',
                                            marginBottom: '0.25rem',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                                    >
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{user.name}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{user.email}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {isSearching && (
                            <div style={{ textAlign: 'center', padding: '1rem', opacity: 0.5, fontSize: '0.85rem' }}>
                                Suche...
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Delete Modal */}
            {deleteModalOpen && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
                        onClick={() => setDeleteModalOpen(false)}
                    />
                    <div className="glass-panel" style={{
                        position: 'fixed',
                        left: deleteModalPosition.x,
                        top: deleteModalPosition.y,
                        zIndex: 1001,
                        padding: '1rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        background: 'white',
                        color: 'black',
                        minWidth: '200px',
                        transform: 'translateX(-50%)'
                    }}>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', textAlign: 'center' }}>Dokument löschen?</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setDeleteModalOpen(false)}
                                className="btn btn-ghost"
                                style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem', justifyContent: 'center' }}
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="btn"
                                style={{
                                    flex: 1,
                                    fontSize: '0.8rem',
                                    padding: '0.4rem',
                                    justifyContent: 'center',
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

            {/* Document List */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>Lade Dokumente...</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {activeTab === 'mine' ? (
                        myDocs.length === 0 ? (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                                Keine eigenen Dokumente vorhanden. Laden Sie welche hoch!
                            </div>
                        ) : myDocs.map(doc => (
                            <DocumentCard
                                key={doc.id}
                                doc={doc}
                                isOwner={true}
                                onShareClick={(e: React.MouseEvent) => handleShareClick(e, doc.id)}
                                onDeleteClick={(e: React.MouseEvent) => handleDeleteClick(e, doc.id)}
                                getIcon={getIcon}
                                formatSize={formatSize}
                            />
                        ))
                    ) : (
                        sharedDocs.length === 0 ? (
                            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
                                Keine geteilten Dokumente gefunden.
                            </div>
                        ) : sharedDocs.map(doc => (
                            <DocumentCard
                                key={doc.id}
                                doc={doc}
                                isOwner={false}
                                onShareClick={() => { }}
                                onDeleteClick={() => { }}
                                getIcon={getIcon}
                                formatSize={formatSize}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function DocumentCard({ doc, isOwner, onShareClick, onDeleteClick, getIcon, formatSize }: any) {
    return (
        <div className="glass-panel" style={{
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            position: 'relative',
            transition: 'transform 0.2s',
            border: (doc.sharedWithCount && doc.sharedWithCount > 0) ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(0,0,0,0.1)',
            background: 'rgba(255,255,255,0.7)',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
        }}>
            {/* Top Row: Icon & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '2.5rem' }}>{getIcon(doc.mimeType)}</div>

                {isOwner && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); onShareClick(e); }}
                            title="Teilen"
                            className="btn btn-ghost btn-sm"
                            style={{
                                padding: '0.25rem',
                                color: (doc.sharedWithCount && doc.sharedWithCount > 0) ? '#3b82f6' : 'rgba(0,0,0,0.3)',
                                opacity: 0.6,
                                transition: 'opacity 0.2s',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                            </svg>
                            {doc.sharedWithCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '-4px',
                                    right: '-4px',
                                    background: '#3b82f6',
                                    color: 'white',
                                    borderRadius: '50%',
                                    width: '14px',
                                    height: '14px',
                                    fontSize: '9px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold'
                                }}>
                                    {doc.sharedWithCount}
                                </span>
                            )}
                        </a>
                        <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); onDeleteClick(e); }}
                            title="Löschen"
                            className="btn btn-ghost btn-sm"
                            style={{
                                padding: '0.25rem',
                                color: '#ef4444',
                                opacity: 0.6,
                                transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                            </svg>
                        </a>
                    </div>
                )}
            </div>

            {/* Info */}
            <div>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.25rem', color: '#000' }} title={doc.filename}>
                    {doc.filename}
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.5, color: '#000' }}>
                    {formatSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                </div>
                {!isOwner && doc.uploaderName && (
                    <div style={{ fontSize: '0.8rem', color: '#3b82f6', marginTop: '0.25rem' }}>
                        Von: {doc.uploaderName}
                    </div>
                )}
            </div>

            {/* Download Button */}
            <a
                href={`/api/documents/${doc.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
                style={{
                    marginTop: 'auto',
                    textAlign: 'center',
                    background: 'rgba(0,0,0,0.05)',
                    fontSize: '0.9rem',
                    color: '#000'
                }}
            >
                Herunterladen
            </a>
        </div>
    );
}
