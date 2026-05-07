import React from 'react';
import { motion } from 'framer-motion';

export default function IplTable() {
  // Actual IPL 2026 Points Table Standings (as of May 7, 2026)
  const standings = [
    { rank: 1, team: 'SRH', name: 'Sunrisers Hyderabad', pld: 11, w: 7, l: 4, nr: 0, pts: 14, nrr: '+0.737' },
    { rank: 2, team: 'PBKS', name: 'Punjab Kings', pld: 10, w: 6, l: 3, nr: 1, pts: 13, nrr: '+0.571' },
    { rank: 3, team: 'RCB', name: 'Royal Challengers Bengaluru', pld: 9, w: 6, l: 3, nr: 0, pts: 12, nrr: '+1.420' },
    { rank: 4, team: 'RR', name: 'Rajasthan Royals', pld: 10, w: 6, l: 4, nr: 0, pts: 12, nrr: '+0.510' },
    { rank: 5, team: 'GT', name: 'Gujarat Titans', pld: 10, w: 6, l: 4, nr: 0, pts: 12, nrr: '-0.147' },
    { rank: 6, team: 'CSK', name: 'Chennai Super Kings', pld: 10, w: 5, l: 5, nr: 0, pts: 10, nrr: '+0.151' },
    { rank: 7, team: 'DC', name: 'Delhi Capitals', pld: 10, w: 4, l: 6, nr: 0, pts: 8, nrr: '-0.949' },
    { rank: 8, team: 'KKR', name: 'Kolkata Knight Riders', pld: 9, w: 3, l: 5, nr: 1, pts: 7, nrr: '-0.539' },
    { rank: 9, team: 'MI', name: 'Mumbai Indians', pld: 10, w: 3, l: 7, nr: 0, pts: 6, nrr: '-0.649' },
    { rank: 10, team: 'LSG', name: 'Lucknow Super Giants', pld: 10, w: 2, l: 8, nr: 0, pts: 4, nrr: '-1.106' },
  ];

  const getTeamIcon = (team) => {
    const icons = {
      'CSK': '🦁', 'MI': '🌪️', 'RCB': '👑', 'KKR': '💜', 'SRH': '🦅', 
      'RR': '🏰', 'DC': '🐅', 'PBKS': '🛡️', 'GT': '⚡', 'LSG': '🏹'
    };
    return icons[team] || '';
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
        <div style={{ 
          fontSize: '0.65rem', 
          color: 'var(--text-muted)', 
          background: 'rgba(255,255,255,0.04)', 
          padding: '4px 8px', 
          borderRadius: '6px' 
        }}>
          Updated: May 7
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
    </motion.div>
  );
}
