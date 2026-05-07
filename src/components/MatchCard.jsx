import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppProvider';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function MatchCard({ match }) {
  const { currentUser, castVote, votes } = useApp();
  const [canVote, setCanVote] = useState(false);
  const [timeMessage, setTimeMessage] = useState('');
  
  const userVote = votes[match.id]?.[currentUser?.id];
  const isCompleted = match.status === 'completed';
  const hasWinner = isCompleted && match.winner;
  
  // Confetti trigger when match completes and user won
  useEffect(() => {
    if (hasWinner && userVote) {
      // Check if user voted for the winning team
      if (userVote.toLowerCase() === match.winner.toLowerCase() || 
          match.winner.toLowerCase().includes(userVote.toLowerCase())) {
        
        // Use a flag to ensure we only confetti once per match load
        const confettiKey = `confetti_${match.id}`;
        if (!sessionStorage.getItem(confettiKey)) {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FBBF24', '#8B5CF6', '#3B82F6']
          });
          sessionStorage.setItem(confettiKey, 'true');
        }
      }
    }
  }, [hasWinner, match.winner, userVote, match.id]);

  useEffect(() => {
    // Check if time is between 7:00 PM (19:00) and 8:15 PM (20:15)
    const checkTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      const isAfterStart = hour > 19 || (hour === 19 && minute >= 0);
      const isBeforeEnd = hour < 20 || (hour === 20 && minute <= 15);
      
      if (match.status !== 'upcoming') {
        setCanVote(false);
        setTimeMessage(match.status === 'completed' ? `Match Completed` : 'Match is live! Voting closed.');
      } else if (isAfterStart && isBeforeEnd) {
        setCanVote(true);
        setTimeMessage('Voting is Open! Closes at 8:15 PM');
      } else if (!isAfterStart) {
        setCanVote(false);
        setTimeMessage('Voting opens at 7:00 PM');
      } else {
        setCanVote(false);
        setTimeMessage('Voting closed at 8:15 PM');
      }
    };
    
    checkTime();
    const interval = setInterval(checkTime, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [match]);

  const getTeamColor = (team) => {
    const colors = {
      'CSK': '#FBBF24', 'MI': '#3B82F6', 'RCB': '#EF4444',
      'KKR': '#8B5CF6', 'SRH': '#F97316', 'RR': '#EC4899',
      'DC': '#4F7CFF', 'PBKS': '#DC2626', 'GT': '#1E40AF',
      'LSG': '#0EA5E9',
      // International
      'IND': '#3B82F6', 'AUS': '#FBBF24', 'ENG': '#1D4ED8',
      'NZ': '#000000', 'SA': '#16A34A', 'PAK': '#22C55E',
      'SL': '#1E3A8A', 'WI': '#7C2D12', 'BAN': '#065F46',
      'ZIM': '#DC2626', 'AFG': '#3B82F6', 'IRE': '#16A34A'
    };
    return colors[team] || '#6366f1';
  };

  const getTeamIcon = (team) => {
    const icons = {
      'CSK': '🦁', 'MI': '🌪️', 'RCB': '👑',
      'KKR': '💜', 'SRH': '🦅', 'RR': '🏰',
      'DC': '🐅', 'PBKS': '🛡️', 'GT': '⚡',
      'LSG': '🏹',
      // International
      'IND': '🇮🇳', 'AUS': '🇦🇺', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'NZ': '🇳🇿', 'SA': '🇿🇦', 'PAK': '🇵🇰',
      'SL': '🇱🇰', 'WI': '🌴', 'BAN': '🇧🇩',
      'ZIM': '🇿🇼', 'AFG': '🇦🇫', 'IRE': '🇮🇪'
    };
    return icons[team] || '';
  };

  const handleVote = (team) => {
    if (canVote) {
      castVote(match.id, team);
    } else {
      alert("Voting is only allowed between 7:00 PM and 8:15 PM!");
    }
  };

  const isTeam1Winner = hasWinner && (match.winner.toLowerCase() === match.team1.toLowerCase() || match.winner.toLowerCase().includes(match.team1.toLowerCase()));
  const isTeam2Winner = hasWinner && (match.winner.toLowerCase() === match.team2.toLowerCase() || match.winner.toLowerCase().includes(match.team2.toLowerCase()));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.4 }}
      className="glass-panel" 
      style={{ 
        padding: '1.5rem', 
        marginBottom: '1.5rem', 
        position: 'relative', 
        overflow: 'hidden',
        border: hasWinner ? '1px solid rgba(251, 191, 36, 0.3)' : '1px solid var(--surface-border)',
        boxShadow: hasWinner ? '0 8px 32px rgba(251, 191, 36, 0.15)' : 'var(--shadow-card)'
      }}
    >
      {/* Tournament Badge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, 
        background: hasWinner ? 'linear-gradient(135deg, #FBBF24, #B45309)' : 'var(--gradient-primary)', 
        padding: '0.25rem 1rem', 
        fontSize: '0.75rem', 
        fontWeight: 'bold',
        borderBottomRightRadius: '12px',
        color: hasWinner ? '#000' : '#fff'
      }}>
        {match.tournament} {hasWinner && '• FINISHED'}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
          {new Date(match.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {match.startTime}
        </div>
        {match.venue && match.venue !== 'TBA' && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem', opacity: 0.7 }}>
            📍 {match.venue}
          </div>
        )}
        <div style={{ 
          color: canVote ? 'var(--accent-success)' : hasWinner ? '#FBBF24' : 'var(--accent-secondary)', 
          fontWeight: 600, 
          fontSize: '0.875rem' 
        }}>
          {hasWinner ? `Winner: ${match.winner}` : timeMessage}
        </div>
      </div>

      <div className="match-teams-layout" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        {/* Team 1 */}
        <div style={{ 
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: hasWinner && !isTeam1Winner ? 0.3 : 1,
          filter: hasWinner && !isTeam1Winner ? 'grayscale(100%)' : 'none',
          transition: 'all 0.5s'
        }}>
          <motion.div 
            whileHover={canVote ? { scale: 1.1 } : {}}
            className="team-circle"
            style={{
              width: '70px', height: '70px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${getTeamColor(match.team1)} 0%, #000 150%)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem',
              border: `3px solid ${userVote === match.team1 ? 'white' : 'transparent'}`,
              boxShadow: userVote === match.team1 ? `0 0 20px ${getTeamColor(match.team1)}` : 'none',
              cursor: canVote ? 'pointer' : 'default',
              position: 'relative',
              lineHeight: '1.2'
            }}
            onClick={() => handleVote(match.team1)}
          >
            {isTeam1Winner && (
              <div style={{ position: 'absolute', top: -15, fontSize: '1.5rem' }}>👑</div>
            )}
            <span style={{ fontSize: '1.5rem', marginBottom: '-2px' }}>{getTeamIcon(match.team1)}</span>
            <span>{match.team1}</span>
          </motion.div>
          <div style={{ fontSize: '0.875rem', color: isTeam1Winner ? '#FBBF24' : 'var(--text-secondary)', textAlign: 'center', fontWeight: isTeam1Winner ? 'bold' : 'normal' }}>
            {match.team1Full}
          </div>
          
          <button 
            className={`btn ${userVote === match.team1 ? 'btn-primary' : 'btn-outline'}`}
            style={{ 
              marginTop: '1rem', width: '100%', padding: '0.5rem',
              display: isCompleted ? 'none' : 'block' // Hide buttons if match completed
            }}
            onClick={() => handleVote(match.team1)}
            disabled={!canVote && userVote !== match.team1}
          >
            {userVote === match.team1 ? 'Voted' : 'Vote'}
          </button>
        </div>

        {/* VS */}
        <div className="vs-text" style={{ 
          fontSize: '1.5rem', fontWeight: 800, color: 'var(--surface-border)', fontStyle: 'italic',
          opacity: hasWinner ? 0 : 1
        }}>
          VS
        </div>

        {/* Team 2 */}
        <div style={{ 
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: hasWinner && !isTeam2Winner ? 0.3 : 1,
          filter: hasWinner && !isTeam2Winner ? 'grayscale(100%)' : 'none',
          transition: 'all 0.5s'
        }}>
          <motion.div 
            whileHover={canVote ? { scale: 1.1 } : {}}
            className="team-circle"
            style={{
              width: '70px', height: '70px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${getTeamColor(match.team2)} 0%, #000 150%)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem',
              border: `3px solid ${userVote === match.team2 ? 'white' : 'transparent'}`,
              boxShadow: userVote === match.team2 ? `0 0 20px ${getTeamColor(match.team2)}` : 'none',
              cursor: canVote ? 'pointer' : 'default',
              position: 'relative',
              lineHeight: '1.2'
            }}
            onClick={() => handleVote(match.team2)}
          >
            {isTeam2Winner && (
              <div style={{ position: 'absolute', top: -15, fontSize: '1.5rem' }}>👑</div>
            )}
            <span style={{ fontSize: '1.5rem', marginBottom: '-2px' }}>{getTeamIcon(match.team2)}</span>
            <span>{match.team2}</span>
          </motion.div>
          <div style={{ fontSize: '0.875rem', color: isTeam2Winner ? '#FBBF24' : 'var(--text-secondary)', textAlign: 'center', fontWeight: isTeam2Winner ? 'bold' : 'normal' }}>
            {match.team2Full}
          </div>
          
          <button 
            className={`btn ${userVote === match.team2 ? 'btn-primary' : 'btn-outline'}`}
            style={{ 
              marginTop: '1rem', width: '100%', padding: '0.5rem',
              display: isCompleted ? 'none' : 'block' // Hide buttons if match completed
            }}
            onClick={() => handleVote(match.team2)}
            disabled={!canVote && userVote !== match.team2}
          >
            {userVote === match.team2 ? 'Voted' : 'Vote'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}