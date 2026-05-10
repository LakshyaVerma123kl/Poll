import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

// Resolve API base same way as AppProvider
function resolveApiBase() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/+$/, '')}/api`;
  }
  return import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';
}
const API_BASE = resolveApiBase();

export default function IplTable() {
  const [standings, setStandings] = useState([]);
  const [source, setSource] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStandings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/ipl-standings`);
      setStandings(res.data.standings || []);
      setSource(res.data.source || '');
      setUpdatedAt(res.data.updatedAt || '');
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch IPL standings', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();
    // Refresh every 5 minutes on the frontend
    const interval = setInterval(fetchStandings, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getTeamIcon = (team) => {
    const icons = {
      'CSK': '🦁', 'MI': '🌪️', 'RCB': '👑', 'KKR': '💜', 'SRH': '🦅', 
      'RR': '🏰', 'DC': '🐅', 'PBKS': '🛡️', 'GT': '⚡', 'LSG': '🏹'
    };
    return icons[team] || '🏏';
  };

  const getTeamColor = (team) => {
    const colors = {
      'CSK': '#FBBF24', 'MI': '#3B82F6', 'RCB': '#EF4444',
      'KKR': '#8B5CF6', 'SRH': '#F97316', 'RR': '#EC4899',
      'DC': '#4F7CFF', 'PBKS': '#DC2626', 'GT': '#1E40AF',
      'LSG': '#0EA5E9'
    };
    return colors[team] || '#6366f1';
  };

  const formatUpdatedTime = () => {
    if (!updatedAt) return '';
    try {
      const d = new Date(updatedAt);
      return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getSourceLabel = () => {
    if (source === 'cricbuzz') return '🟢 Live';
    if (source === 'espn') return '🟢 Live';
    if (source === 'cache') return '🔵 Cached';
    if (source === 'stale-cache') return '🟡 Stale';
    if (source === 'fallback') return '🟠 Offline';
    return '';
  };

  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-panel" 
        style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}
      >
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
        Loading IPL Standings...
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel" 
      style={{ overflow: 'hidden' }}
    >
      <div style={{ 
        padding: '1.25rem 1.5rem', 
        background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))', 
        borderBottom: '1px solid var(--surface-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
            📊 IPL 2026 Standings
          </h3>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Top 4 qualify for Playoffs
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          {getSourceLabel() && (
            <div style={{ 
              fontSize: '0.6rem', 
              color: 'var(--text-muted)', 
              background: 'rgba(255,255,255,0.04)', 
              padding: '2px 6px', 
              borderRadius: '4px' 
            }}>
              {getSourceLabel()}
            </div>
          )}
          <div style={{ 
            fontSize: '0.6rem', 
            color: 'var(--text-muted)', 
            background: 'rgba(255,255,255,0.04)', 
            padding: '2px 6px', 
            borderRadius: '4px' 
          }}>
            {formatUpdatedTime() || 'Updating...'}
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '480px' }}>
          <thead>
            <tr style={{ 
              background: 'rgba(255,255,255,0.03)', 
              fontSize: '0.72rem', 
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Team</th>
              <th style={{ padding: '0.75rem 0.4rem' }}>P</th>
              <th style={{ padding: '0.75rem 0.4rem' }}>W</th>
              <th style={{ padding: '0.75rem 0.4rem' }}>L</th>
              <th style={{ padding: '0.75rem 0.4rem' }}>NR</th>
              <th style={{ padding: '0.75rem 0.4rem' }}>NRR</th>
              <th style={{ padding: '0.75rem 1rem' }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, index) => {
              const isQualified = index < 4;
              return (
                <motion.tr 
                  key={row.team}
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.3 }}
                  style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isQualified ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                    borderLeft: isQualified ? `3px solid ${getTeamColor(row.team)}` : '3px solid transparent',
                    transition: 'background 0.3s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = isQualified ? 'rgba(16, 185, 129, 0.04)' : 'transparent'}
                >
                  <td style={{ padding: '0.7rem 1rem', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ 
                        width: '20px', 
                        color: isQualified ? getTeamColor(row.team) : 'var(--text-muted)', 
                        fontSize: '0.8rem', 
                        fontWeight: 700 
                      }}>
                        {row.rank}
                      </div>
                      <div style={{ fontSize: '1.15rem', width: '24px', textAlign: 'center' }}>{getTeamIcon(row.team)}</div>
                      <div>
                        <div style={{ 
                          fontWeight: isQualified ? 700 : 400, 
                          color: isQualified ? '#fff' : 'var(--text-primary)',
                          fontSize: '0.9rem'
                        }}>
                          {row.team}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }} className="hide-mobile">{row.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{row.pld}</td>
                  <td style={{ color: '#10B981', fontWeight: 600, fontSize: '0.85rem' }}>{row.w}</td>
                  <td style={{ color: '#EF4444', fontSize: '0.85rem' }}>{row.l}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.nr}</td>
                  <td style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '0.8rem', 
                    color: row.nrr.startsWith('+') ? '#10B981' : '#EF4444' 
                  }}>
                    {row.nrr}
                  </td>
                  <td style={{ 
                    padding: '0.7rem 1rem', 
                    fontWeight: 800, 
                    fontSize: '1rem',
                    color: isQualified ? '#FBBF24' : 'var(--text-primary)' 
                  }}>
                    {row.pts}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {standings.length === 0 && !loading && (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No standings data available yet.
        </div>
      )}
    </motion.div>
  );
}
