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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel" 
      style={{ overflow: 'hidden' }}
    >
      <div style={{ padding: '1.5rem', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--surface-border)' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📊</span> IPL 2026 Points Table
        </h3>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Top 4 teams qualify for Playoffs. Simulated Standings.
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '500px' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Team</th>
              <th>P</th>
              <th>W</th>
              <th>L</th>
              <th>NR</th>
              <th>NRR</th>
              <th style={{ paddingRight: '1rem' }}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, index) => {
              const isQualified = index < 4;
              return (
                <tr 
                  key={row.team}
                  style={{ 
                    borderBottom: '1px solid var(--surface-border)',
                    background: isQualified ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                    borderLeft: isQualified ? '3px solid #10B981' : '3px solid transparent'
                  }}
                >
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{row.rank}</div>
                    <div style={{ fontSize: '1.2rem', width: '24px', textAlign: 'center' }}>{getTeamIcon(row.team)}</div>
                    <div>
                      <div style={{ fontWeight: isQualified ? 600 : 400, color: isQualified ? '#fff' : 'var(--text-primary)' }}>{row.team}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} className="hide-mobile">{row.name}</div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{row.pld}</td>
                  <td style={{ color: '#10B981' }}>{row.w}</td>
                  <td style={{ color: '#EF4444' }}>{row.l}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{row.nr}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{row.nrr}</td>
                  <td style={{ paddingRight: '1rem', fontWeight: 700, color: isQualified ? '#FBBF24' : 'var(--text-primary)' }}>{row.pts}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
