import React from 'react';
import { useApp } from '../context/AppProvider';
import { motion, AnimatePresence } from 'framer-motion';

export default function Leaderboard() {
  const { users, currentUser } = useApp();

  // Sort users by points descending
  const sortedUsers = [...users].sort((a, b) => b.points - a.points);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass-panel" 
      style={{ padding: '1.5rem' }}
    >
      <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
        Leaderboard
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <AnimatePresence>
          {sortedUsers.map((user, index) => {
            const isCurrentUser = currentUser?.id === user.id;
            const isTop3 = index < 3;
            const rankColors = ['#FBBF24', '#9CA3AF', '#B45309'];
            
            return (
              <motion.div 
                key={user.id} 
                layout // This tells framer-motion to smoothly animate position changes!
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: isCurrentUser ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isCurrentUser ? 'var(--accent-secondary)' : 'transparent'}`,
                  boxShadow: isTop3 ? `0 0 10px ${rankColors[index]}22` : 'none',
                  zIndex: sortedUsers.length - index,
                  position: 'relative'
                }}
              >
                <div style={{
                  width: '30px',
                  fontWeight: 'bold',
                  fontSize: isTop3 ? '1.5rem' : '1rem',
                  color: isTop3 ? rankColors[index] : 'var(--text-muted)'
                }}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </div>
                
                <div className="user-avatar" style={{ 
                  marginRight: '1rem',
                  background: isCurrentUser ? 'var(--gradient-primary)' : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: isTop3 ? `0 0 15px ${rankColors[index]}66` : 'none',
                }}>
                  {user.avatar}
                </div>
                
                <div style={{ flex: 1, fontWeight: isCurrentUser ? '600' : '400' }}>
                  {user.name} {isCurrentUser && <span style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', marginLeft: '0.5rem' }}>(You)</span>}
                </div>
                
                <motion.div 
                  key={`${user.id}-points-${user.points}`} // Forces re-animation when points change
                  initial={{ scale: 1.5, color: '#10b981' }}
                  animate={{ scale: 1, color: '#ffffff' }}
                  transition={{ type: "spring", stiffness: 500 }}
                  style={{ 
                    fontFamily: 'var(--font-heading)', 
                    fontWeight: '700',
                    fontSize: '1.25rem',
                  }}
                >
                  <span style={{ 
                    background: isTop3 ? `linear-gradient(135deg, ${rankColors[index]}, #fff)` : 'none',
                    WebkitBackgroundClip: isTop3 ? 'text' : 'border-box',
                    WebkitTextFillColor: isTop3 ? 'transparent' : 'inherit'
                  }}>
                    {user.points}
                  </span> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal', WebkitTextFillColor: 'initial' }}>🏆 Wins</span>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {sortedUsers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No players yet. Be the first to join!
          </div>
        )}
      </div>
    </motion.div>
  );
}
