'use client';

import { useState, useEffect } from 'react';
import styles from './companies.module.css';

interface Company {
    id: string;
    name: string;
    logo?: string;
    industry?: string;
    foundedDate?: string;
    employeeCount: number;
    description?: string;
    news: CompanyNews[];
    strategies: CompanyStrategy[];
}

interface CompanyNews {
    id: string;
    title: string;
    summary: string;
    sourceUrls: string[];
    researchDate: string;
}

interface CompanyStrategy {
    id: string;
    title: string;
    description: string;
    type: 'GOAL' | 'STRATEGY' | 'INITIATIVE' | 'VALUE';
    priority: number;
    isActive: boolean;
}

export default function CompaniesPage() {
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'news' | 'strategy'>('overview');
    const [editMode, setEditMode] = useState(false);
    const [editedCompany, setEditedCompany] = useState<Partial<Company>>({});

    // News expand/collapse state
    const [expandedNewsIds, setExpandedNewsIds] = useState<string[]>([]);

    // Delete modal state
    const [deleteNewsModalOpen, setDeleteNewsModalOpen] = useState(false);
    const [deleteModalPosition, setDeleteModalPosition] = useState({ x: 0, y: 0 });
    const [newsToDelete, setNewsToDelete] = useState<string | null>(null);

    // Strategy form
    const [showStrategyForm, setShowStrategyForm] = useState(false);
    const [newStrategy, setNewStrategy] = useState({
        title: '',
        description: '',
        type: 'GOAL' as const,
        priority: 0
    });

    // TODO: Replace with proper authentication
    const isAdmin = true;

    // Helper function to check if today's news already exists
    const hasTodaysNews = () => {
        if (!company?.news || company.news.length === 0) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return company.news.some(news => {
            const newsDate = new Date(news.researchDate);
            newsDate.setHours(0, 0, 0, 0);
            return newsDate.getTime() === today.getTime();
        });
    };

    // Helper function to toggle news expansion
    const toggleNewsExpand = (newsId: string) => {
        setExpandedNewsIds(prev =>
            prev.includes(newsId)
                ? prev.filter(id => id !== newsId)
                : [...prev, newsId]
        );
    };

    // Helper function to extract headlines from summary
    const extractHeadlines = (summary: string): string[] => {
        // Try to extract bullet points (•, -, *)
        const lines = summary.split('\n');
        const headlines: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            // Skip empty lines
            if (!trimmed) continue;

            // Skip headers (lines with ** or ending with :)
            if (trimmed.startsWith('**') || trimmed.endsWith(':') || trimmed.endsWith(':**')) continue;

            // Extract bullet points
            const bulletMatch = trimmed.match(/^[•\-\*]\s*(.+)/);
            if (bulletMatch && bulletMatch[1]) {
                const content = bulletMatch[1].trim();
                // Only add if it's substantial (more than 20 chars and doesn't look like a fragment)
                if (content.length > 20 && !content.match(/^[a-z]/)) {
                    headlines.push(content);
                }
            }
        }

        // If we found bullet points, return them
        if (headlines.length > 0) {
            return headlines;
        }

        // Fallback: Find lines that look like complete sentences
        const sentences: string[] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 30 &&
                !trimmed.startsWith('**') &&
                !trimmed.endsWith(':') &&
                !trimmed.match(/^[a-z]/) && // Don't start with lowercase (likely fragment)
                (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?'))) {
                sentences.push(trimmed);
            }
        }

        return sentences.length > 0 ? sentences : ['Keine Details verfügbar'];
    };

    useEffect(() => {
        fetchCompany();
    }, []);

    const fetchCompany = async () => {
        try {
            const res = await fetch('/api/company');
            if (res.ok) {
                const data = await res.json();
                setCompany(data);
                setEditedCompany(data);
            }
        } catch (error) {
            console.error('Error fetching company:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCompany = async () => {
        try {
            const res = await fetch('/api/company', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editedCompany)
            });

            if (res.ok) {
                const updated = await res.json();
                setCompany(updated);
                setEditMode(false);
            }
        } catch (error) {
            console.error('Error updating company:', error);
        }
    };

    const handleGenerateNews = async () => {
        try {
            const res = await fetch('/api/company/news', {
                method: 'POST'
            });

            if (res.ok) {
                await fetchCompany();
            }
        } catch (error) {
            console.error('Error generating news:', error);
        }
    };

    const handleDeleteNews = async () => {
        if (!newsToDelete) return;

        try {
            console.log('Deleting news with ID:', newsToDelete);

            const res = await fetch(`/api/company/news/${newsToDelete}`, {
                method: 'DELETE'
            });

            console.log('Delete response status:', res.status);

            if (res.ok) {
                console.log('News deleted successfully, refreshing...');
                await fetchCompany(); // Refresh to update button state
                setDeleteNewsModalOpen(false);
                setNewsToDelete(null);
            } else {
                const errorData = await res.json();
                console.error('Delete failed:', errorData);
                alert(`Fehler beim Löschen: ${errorData.error || 'Unbekannter Fehler'}`);
            }
        } catch (error) {
            console.error('Error deleting news:', error);
            alert('Fehler beim Löschen der News');
        }
    };

    const handleAddStrategy = async () => {
        try {
            const res = await fetch('/api/company/strategy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newStrategy)
            });

            if (res.ok) {
                await fetchCompany();
                setShowStrategyForm(false);
                setNewStrategy({ title: '', description: '', type: 'GOAL', priority: 0 });
            }
        } catch (error) {
            console.error('Error adding strategy:', error);
        }
    };

    const handleDeleteStrategy = async (id: string) => {
        if (!confirm('Möchten Sie diese Strategie wirklich löschen?')) return;

        try {
            const res = await fetch(`/api/company/strategy/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                await fetchCompany();
            }
        } catch (error) {
            console.error('Error deleting strategy:', error);
        }
    };

    const handleToggleStrategy = async (id: string, isActive: boolean) => {
        try {
            const res = await fetch(`/api/company/strategy/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive })
            });

            if (res.ok) {
                await fetchCompany();
            }
        } catch (error) {
            console.error('Error toggling strategy:', error);
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Lädt...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Unternehmen</h1>
                <div className={styles.tabs}>
                    <button
                        className={activeTab === 'overview' ? styles.tabActive : styles.tab}
                        onClick={() => setActiveTab('overview')}
                    >
                        Übersicht
                    </button>
                    <button
                        className={activeTab === 'news' ? styles.tabActive : styles.tab}
                        onClick={() => setActiveTab('news')}
                    >
                        Aktuelles
                    </button>
                    <button
                        className={activeTab === 'strategy' ? styles.tabActive : styles.tab}
                        onClick={() => setActiveTab('strategy')}
                    >
                        Strategie
                    </button>
                </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className={styles.content}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2>Unternehmensübersicht</h2>
                            {isAdmin && (
                                <button
                                    className={styles.btnSecondary}
                                    onClick={() => setEditMode(!editMode)}
                                >
                                    {editMode ? 'Abbrechen' : 'Bearbeiten'}
                                </button>
                            )}
                        </div>

                        {editMode ? (
                            <div className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label>Unternehmensname</label>
                                    <input
                                        type="text"
                                        value={editedCompany.name || ''}
                                        onChange={(e) => setEditedCompany({ ...editedCompany, name: e.target.value })}
                                        className={styles.input}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Branche</label>
                                    <input
                                        type="text"
                                        value={editedCompany.industry || ''}
                                        onChange={(e) => setEditedCompany({ ...editedCompany, industry: e.target.value })}
                                        className={styles.input}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Gründungsdatum</label>
                                    <input
                                        type="date"
                                        value={editedCompany.foundedDate ? new Date(editedCompany.foundedDate).toISOString().split('T')[0] : ''}
                                        onChange={(e) => setEditedCompany({ ...editedCompany, foundedDate: e.target.value })}
                                        className={styles.input}
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Beschreibung</label>
                                    <textarea
                                        value={editedCompany.description || ''}
                                        onChange={(e) => setEditedCompany({ ...editedCompany, description: e.target.value })}
                                        className={styles.textarea}
                                        rows={4}
                                    />
                                </div>

                                <button className={styles.btnPrimary} onClick={handleSaveCompany}>
                                    Speichern
                                </button>
                            </div>
                        ) : (
                            <div className={styles.overview}>
                                <div className={styles.infoGrid}>
                                    <div className={styles.infoItem}>
                                        <div className={styles.infoLabel}>Name</div>
                                        <div className={styles.infoValue}>{company?.name || '-'}</div>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <div className={styles.infoLabel}>Branche</div>
                                        <div className={styles.infoValue}>{company?.industry || '-'}</div>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <div className={styles.infoLabel}>Mitarbeiter</div>
                                        <div className={styles.infoValue}>{company?.employeeCount || 0}</div>
                                    </div>

                                    <div className={styles.infoItem}>
                                        <div className={styles.infoLabel}>Gegründet</div>
                                        <div className={styles.infoValue}>
                                            {company?.foundedDate
                                                ? new Date(company.foundedDate).toLocaleDateString('de-DE')
                                                : '-'
                                            }
                                        </div>
                                    </div>
                                </div>

                                {company?.description && (
                                    <div className={styles.description}>
                                        <h3>Beschreibung</h3>
                                        <p>{company.description}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* News Tab */}
            {activeTab === 'news' && (
                <div className={styles.content}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2>Aktuelles</h2>
                            {isAdmin && (
                                <button
                                    className={styles.btnPrimary}
                                    onClick={handleGenerateNews}
                                    disabled={hasTodaysNews()}
                                    style={{
                                        opacity: hasTodaysNews() ? 0.5 : 1,
                                        cursor: hasTodaysNews() ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {hasTodaysNews() ? 'Heute bereits recherchiert' : 'Neue Recherche starten'}
                                </button>
                            )}
                        </div>

                        {company?.news && company.news.length > 0 ? (
                            <div className={styles.newsList}>
                                {company.news.map((news) => {
                                    const isExpanded = expandedNewsIds.includes(news.id);
                                    const headlines = extractHeadlines(news.summary);


                                    return (
                                        <div key={news.id} className={styles.newsItem}>
                                            <div className={styles.newsDateRow}>
                                                <div className={styles.newsDate}>
                                                    {new Date(news.researchDate).toLocaleDateString('de-DE', {
                                                        day: '2-digit',
                                                        month: 'long',
                                                        year: 'numeric'
                                                    })}
                                                </div>
                                                {isAdmin && (
                                                    <button
                                                        className={styles.btnDeleteNews}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setNewsToDelete(news.id);
                                                            setDeleteModalPosition({ x: e.clientX, y: e.clientY });
                                                            setDeleteNewsModalOpen(true);
                                                        }}
                                                        title="News löschen"
                                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>

                                            <div
                                                className={styles.newsHeader}
                                                onClick={() => toggleNewsExpand(news.id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <h3>{news.title}</h3>
                                                <span className={styles.expandIcon}>
                                                    {isExpanded ? '▼' : '▶'}
                                                </span>
                                            </div>

                                            {!isExpanded && headlines.length > 0 && (
                                                <div className={styles.newsPreview}>
                                                    <strong>TOP 3 Schlagzeilen:</strong>
                                                    <ul>
                                                        {headlines.slice(0, 3).map((headline, idx) => (
                                                            <li key={idx}>{headline}</li>
                                                        ))}
                                                    </ul>
                                                    <div className={styles.clickHint}>
                                                        Klicken Sie für Details...
                                                    </div>
                                                </div>
                                            )}

                                            {isExpanded && (
                                                <>
                                                    <div className={styles.newsSummary}>{news.summary}</div>
                                                    {news.sourceUrls && news.sourceUrls.length > 0 && (
                                                        <div className={styles.sources}>
                                                            <strong>Quellen:</strong>
                                                            <ul>
                                                                {news.sourceUrls.map((url, idx) => (
                                                                    <li key={idx}>
                                                                        <a href={url} target="_blank" rel="noopener noreferrer">
                                                                            {url}
                                                                        </a>
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className={styles.empty}>
                                <p>Noch keine Nachrichten verfügbar.</p>
                                {isAdmin && (
                                    <p className={styles.hint}>
                                        Klicken Sie auf "Neue Recherche starten", um aktuelle Informationen zu generieren.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Strategy Tab */}
            {activeTab === 'strategy' && (
                <div className={styles.content}>
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2>Unternehmensstrategie</h2>
                            {isAdmin && (
                                <button
                                    className={styles.btnPrimary}
                                    onClick={() => setShowStrategyForm(!showStrategyForm)}
                                >
                                    {showStrategyForm ? 'Abbrechen' : '+ Neue Strategie'}
                                </button>
                            )}
                        </div>

                        {showStrategyForm && (
                            <div className={styles.form}>
                                <div className={styles.formGroup}>
                                    <label>Titel</label>
                                    <input
                                        type="text"
                                        value={newStrategy.title}
                                        onChange={(e) => setNewStrategy({ ...newStrategy, title: e.target.value })}
                                        className={styles.input}
                                        placeholder="z.B. Marktführerschaft in DACH-Region"
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Typ</label>
                                    <select
                                        value={newStrategy.type}
                                        onChange={(e) => setNewStrategy({ ...newStrategy, type: e.target.value as any })}
                                        className={styles.select}
                                    >
                                        <option value="GOAL">Ziel</option>
                                        <option value="STRATEGY">Strategie</option>
                                        <option value="INITIATIVE">Initiative</option>
                                        <option value="VALUE">Wert</option>
                                    </select>
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Priorität (0-100)</label>
                                    <input
                                        type="number"
                                        value={newStrategy.priority}
                                        onChange={(e) => setNewStrategy({ ...newStrategy, priority: parseInt(e.target.value) })}
                                        className={styles.input}
                                        min="0"
                                        max="100"
                                    />
                                </div>

                                <div className={styles.formGroup}>
                                    <label>Beschreibung</label>
                                    <textarea
                                        value={newStrategy.description}
                                        onChange={(e) => setNewStrategy({ ...newStrategy, description: e.target.value })}
                                        className={styles.textarea}
                                        rows={4}
                                        placeholder="Detaillierte Beschreibung der Strategie..."
                                    />
                                </div>

                                <button className={styles.btnPrimary} onClick={handleAddStrategy}>
                                    Hinzufügen
                                </button>
                            </div>
                        )}

                        <div className={styles.strategyInfo}>
                            <p className={styles.infoBox}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }}>
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <strong>Hinweis:</strong> Diese Strategien werden automatisch als Kontext in allen
                                Chats und bei der Protokollerstellung verwendet, um sicherzustellen, dass die KI
                                Ihre Unternehmensziele berücksichtigt.
                            </p>
                        </div>

                        {company?.strategies && company.strategies.length > 0 ? (
                            <div className={styles.strategiesList}>
                                {['GOAL', 'STRATEGY', 'INITIATIVE', 'VALUE'].map((type) => {
                                    const items = company.strategies.filter((s) => s.type === type);
                                    if (items.length === 0) return null;

                                    const typeLabels: Record<string, string> = {
                                        GOAL: 'Ziele',
                                        STRATEGY: 'Strategien',
                                        INITIATIVE: 'Initiativen',
                                        VALUE: 'Werte'
                                    };

                                    return (
                                        <div key={type} className={styles.strategySection}>
                                            <h3>{typeLabels[type]}</h3>
                                            {items.map((strategy) => (
                                                <div
                                                    key={strategy.id}
                                                    className={`${styles.strategyItem} ${!strategy.isActive ? styles.inactive : ''}`}
                                                >
                                                    <div className={styles.strategyHeader}>
                                                        <div>
                                                            <h4>{strategy.title}</h4>
                                                            <span className={styles.priority}>Priorität: {strategy.priority}</span>
                                                        </div>
                                                        {isAdmin && (
                                                            <div className={styles.strategyActions}>
                                                                <button
                                                                    className={styles.btnToggle}
                                                                    onClick={() => handleToggleStrategy(strategy.id, strategy.isActive)}
                                                                    title={strategy.isActive ? 'Deaktivieren' : 'Aktivieren'}
                                                                >
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        {strategy.isActive ? (
                                                                            <>
                                                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                                                <circle cx="12" cy="12" r="3" />
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                                                                <line x1="1" y1="1" x2="23" y2="23" />
                                                                            </>
                                                                        )}
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    className={styles.btnDelete}
                                                                    onClick={() => handleDeleteStrategy(strategy.id)}
                                                                    title="Löschen"
                                                                >
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p>{strategy.description}</p>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className={styles.empty}>
                                <p>Noch keine Strategien definiert.</p>
                                {isAdmin && (
                                    <p className={styles.hint}>
                                        Fügen Sie Unternehmensziele, Strategien und Initiativen hinzu, um die KI-Unterstützung zu verbessern.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Delete News Confirmation Modal */}
            {deleteNewsModalOpen && (
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
                            setDeleteNewsModalOpen(false);
                            setNewsToDelete(null);
                        }}
                    />

                    {/* Modal */}
                    <div
                        style={{
                            position: 'fixed',
                            left: Math.min(Math.max(deleteModalPosition.x, 200), window.innerWidth - 200) + 'px',
                            top: Math.min(Math.max(deleteModalPosition.y, 100), window.innerHeight - 150) + 'px',
                            transform: 'translate(-50%, -50%)',
                            background: 'white',
                            border: '1px solid #e0e0e0',
                            borderRadius: '0.75rem',
                            padding: '1.5rem',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
                            zIndex: 9999,
                            minWidth: '320px',
                            maxWidth: '400px'
                        }}
                    >
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem', color: '#333' }}>
                            News löschen?
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                            Dieser News-Eintrag wird permanent gelöscht. Wenn dies der heutige Eintrag ist, wird der "Neue Recherche"-Button wieder aktiviert.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                className={styles.btnSecondary}
                                onClick={() => {
                                    setDeleteNewsModalOpen(false);
                                    setNewsToDelete(null);
                                }}
                                style={{ fontSize: '0.875rem', fontWeight: 500 }}
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleDeleteNews}
                                style={{
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s ease'
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
