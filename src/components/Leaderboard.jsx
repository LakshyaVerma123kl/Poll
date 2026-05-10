import React from 'react';
import { useApp } from '../context/AppProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Star } from 'lucide-react';

export default function Leaderboard() {
  const { users, currentUser } = useApp();

  // Sort users by points descending
  const sortedUsers = [...users].sort((a, b) => b.points - a.points);
  const top3 = sortedUsers.slice(0, 3);
  const restOfUsers = sortedUsers.slice(3);

  const getPodiumColor = (index) => {
    if (index === 0) return { bg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', shadow: 'rgba(251, 191, 36, 0.4)', text: '#fff' };
    if (index === 1) return { bg: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)', shadow: 'rgba(148, 163, 184, 0.4)', text: '#1e293b' };
    if (index === 2) return { bg: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', shadow: 'rgba(180, 83, 9, 0.4)', text: '#fff' };
    return { bg: 'transparent', shadow: 'transparent', text: '#fff' };
  };

  const getPodiumHeight = (index) => {
    if (index === 0) return '160px';
    if (index === 1) return '130px';
    if (index === 2) return '110px';
    return '100px';
  };

  // Re-order top3 array for visual layout (2nd, 1st, 3rd)
  const displayTop3 = [];
  if (top3[1]) displayTop3.push({ ...top3[1], originalIndex: 1 });
  if (top3[0]) displayTop3.push({ ...top3[0], originalIndex: 0 });
  if (top3[2]) displayTop3.push({ ...top3[2], originalIndex: 2 });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass-panel" 
      style={{ padding: '2rem 1.5rem', background: 'rgba(16, 18, 27, 0.8)' }}
    >
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2 style={{ 
          fontSize: '2rem', 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.75rem',
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          <Trophy size={32} color="#fbbf24" />
          Hall of Fame
        </h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
          Top predictors of the arena
        </p>
      </div>

      {/* PODIUM SECTION */}
      {displayTop3.length > 0 && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'flex-end', 
          gap: '1rem',
          marginBottom: '3rem',
          minHeight: '200px'
        }}>
          {displayTop3.map((user) => {
            const colors = getPodiumColor(user.originalIndex);
            const isCurrentUser = currentUser?.id === user.id;
            return (
              <motion.div 
                key={user.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 100, delay: user.originalIndex * 0.1 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: '30%',
                  maxWidth: '120px'
                }}
              >
                {/* Avatar & Rank */}
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                  <motion.div 
                    whileHover={{ scale: 1.1 }}
                    style={{
                      width: user.originalIndex === 0 ? '72px' : '56px',
                      height: user.originalIndex === 0 ? '72px' : '56px',
                      borderRadius: '50%',
                      background: colors.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: user.originalIndex === 0 ? '2rem' : '1.5rem',
                      color: colors.text,
                      boxShadow: `0 10px 25px ${colors.shadow}, inset 0 -4px 10px rgba(0,0,0,0.2)`,
                      border: '3px solid rgba(255,255,255,0.2)',
                      position: 'relative',
                      zIndex: 2
                    }}
                  >
                    {user.avatar}
                  </motion.div>
                  {/* Floating Medals */}
                  <div style={{
                    position: 'absolute',
                    bottom: '-10px',
                    right: '-10px',
                    background: '#10121b',
                    borderRadius: '50%',
                    padding: '4px',
                    zIndex: 3,
                    boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                  }}>
                    {user.originalIndex === 0 ? <Trophy size={20} color="#fbbf24" fill="#fbbf24" /> : 
                     user.originalIndex === 1 ? <Medal size={16} color="#cbd5e1" /> : 
                     <Medal size={16} color="#d97706" />}
                  </div>
                </div>

                {/* Name & Points */}
                <div style={{ textAlign: 'center', marginBottom: '0.75rem', zIndex: 2 }}>
                  <div style={{ fontWeight: 700, fontSize: user.originalIndex === 0 ? '1.1rem' : '0.9rem', color: isCurrentUser ? '#a78bfa' : '#fff', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                    {user.name} {isCurrentUser && '*'}
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                    {user.points} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>PTS</span>
                  </div>
                </div>

                {/* Podium Block */}
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: getPodiumHeight(user.originalIndex) }}
                  transition={{ type: "spring", stiffness: 50, delay: 0.3 }}
                  style={{
                    width: '100%',
                    background: `linear-gradient(180deg, ${colors.bg.split(', ')[1]} 0%, rgba(16,18,27,0) 100%)`,
                    borderTopLeftRadius: '12px',
                    borderTopRightRadius: '12px',
                    borderTop: `2px solid ${colors.bg.split(', ')[2] || 'rgba(255,255,255,0.3)'}`,
                    opacity: 0.6,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, height: '100%', 
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                    transform: 'skewX(-20deg) translateX(-150%)',
                    animation: 'shimmer 3s infinite'
                  }} />
                  <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '3rem', fontWeight: 900, opacity: 0.2 }}>
                    {user.originalIndex + 1}
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* REST OF THE LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <AnimatePresence>
          {restOfUsers.map((user, index) => {
            const actualRank = index + 4;
            const isCurrentUser = currentUser?.id === user.id;
            
            return (
              <motion.div 
                key={user.id} 
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1rem',
                  borderRadius: '16px',
                  background: isCurrentUser ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${isCurrentUser ? 'rgba(139, 92, 246, 0.4)' : 'transparent'}`,
                  transition: 'all 0.2s',
                }}
                whileHover={{ background: 'rgba(255, 255, 255, 0.05)', scale: 1.01 }}
              >
                <div style={{
                  width: '40px',
                  fontWeight: '800',
                  fontSize: '1rem',
                  color: 'var(--text-muted)',
                  textAlign: 'center'
                }}>
                  #{actualRank}
                </div>
                
                <div style={{ 
                  width: '36px', height: '36px',
                  borderRadius: '50%',
                  marginRight: '1rem',
                  background: isCurrentUser ? 'var(--gradient-primary)' : 'rgba(255, 255, 255, 0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 600, fontSize: '0.9rem'
                }}>
                  {user.avatar}
                </div>
                
                <div style={{ flex: 1, fontWeight: isCurrentUser ? '700' : '500', color: isCurrentUser ? '#a78bfa' : '#f0f2f5' }}>
                  {user.name} {isCurrentUser && <span style={{ fontSize: '0.7rem', color: '#8b5cf6', marginLeft: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>(You)</span>}
                </div>
                
                <motion.div 
                  key={`${user.id}-points-${user.points}`}
                  initial={{ scale: 1.5, color: '#10b981' }}
                  animate={{ scale: 1, color: '#ffffff' }}
                  transition={{ type: "spring", stiffness: 500 }}
                  style={{ 
                    fontFamily: 'var(--font-heading)', 
                    fontWeight: '800',
                    fontSize: '1.2rem',
                  }}
                >
                  {user.points} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>PTS</span>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {sortedUsers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Star size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            No players have joined the arena yet.
          </div>
        )}
      </div>
    </motion.div>
  );
}
