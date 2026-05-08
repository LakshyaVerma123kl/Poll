import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppProvider';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

export default function MatchCard({ match }) {
  const { currentUser, castVote, votes, getAIPrediction } = useApp();
  const [canVote, setCanVote] = useState(false);
  const [timeMessage, setTimeMessage] = useState('');
  const [aiPrediction, setAiPrediction] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  
  const userVote = votes[match.id]?.[currentUser?.id];
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const hasWinner = isCompleted && match.winner;
  
  // Confetti trigger when match completes and user won
  useEffect(() => {
    if (hasWinner && userVote) {
      if (userVote.toLowerCase() === match.winner.toLowerCase() || 
          match.winner.toLowerCase().includes(userVote.toLowerCase())) {
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
    const checkTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      const isAfterStart = hour > 19 || (hour === 19 && minute >= 0);
      const isBeforeEnd = hour < 20 || (hour === 20 && minute <= 15);
      
      if (match.status !== 'upcoming') {
        setCanVote(false);
        setTimeMessage(match.status === 'completed' ? 'Match Completed' : 'Match is live! Voting closed.');
      } else if (isAfterStart && isBeforeEnd) {
        setCanVote(true);
        setTimeMessage('🟢 Voting is Open! Closes at 8:15 PM');
      } else if (!isAfterStart) {
        setCanVote(false);
        setTimeMessage('Voting opens at 7:00 PM');
      } else {
        setCanVote(false);
        setTimeMessage('Voting closed at 8:15 PM');
      }
    };
    
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [match]);

  const getTeamColor = (team) => {
    const colors = {
      'CSK': '#FBBF24', 'MI': '#3B82F6', 'RCB': '#EF4444',
      'KKR': '#8B5CF6', 'SRH': '#F97316', 'RR': '#EC4899',
      'DC': '#4F7CFF', 'PBKS': '#DC2626', 'GT': '#1E40AF',
      'LSG': '#0EA5E9',
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
      'IND': '🇮🇳', 'AUS': '🇦🇺', 'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      'NZ': '🇳🇿', 'SA': '🇿🇦', 'PAK': '🇵🇰',
      'SL': '🇱🇰', 'WI': '🌴', 'BAN': '🇧🇩',
      'ZIM': '🇿🇼', 'AFG': '🇦🇫', 'IRE': '🇮🇪'
    };
    return icons[team] || '🏏';
  };

  const handleVote = (team) => {
    if (canVote) {
      castVote(match.id, team);
    } else {
      alert("Voting is only allowed between 7:00 PM and 8:15 PM!");
    }
  };

  const handleAIPredict = async () => {
    if (aiLoading || aiPrediction) return;
    setAiLoading(true);
    const result = await getAIPrediction(match.id);
    setAiPrediction(result);
    setAiLoading(false);
  };

  const isTeam1Winner = hasWinner && (match.winner.toLowerCase() === match.team1.toLowerCase() || match.winner.toLowerCase().includes(match.team1.toLowerCase()));
  const isTeam2Winner = hasWinner && (match.winner.toLowerCase() === match.team2.toLowerCase() || match.winner.toLowerCase().includes(match.team2.toLowerCase()));

  // Get status badge
  const getStatusBadge = () => {
    if (isLive) {
      return <span className="status-badge live"><span className="live-dot"></span>LIVE</span>;
    }
    if (isCompleted) {
      return <span className="status-badge completed">✓ Completed</span>;
    }
    return <span className="status-badge upcoming">Upcoming</span>;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015, y: -3 }}
      transition={{ duration: 0.35 }}
      className={`glass-panel ${isLive ? 'live-pulse' : ''}`}
      style={{ 
        padding: '1.5rem', 
        marginBottom: '1rem', 
        position: 'relative', 
        overflow: 'hidden',
        borderLeft: isLive ? '3px solid #ef4444' : hasWinner ? '3px solid #fbbf24' : '3px solid transparent',
      }}
    >
      {/* Top Row: Tournament + Status Badge */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
      }}>
        <div style={{ 
          fontSize: '0.7rem', 
          fontWeight: 700, 
          textTransform: 'uppercase', 
          letterSpacing: '1px', 
          color: 'var(--text-muted)',
          background: 'rgba(255,255,255,0.04)',
          padding: '4px 10px',
          borderRadius: '6px'
        }}>
          {match.tournament}
        </div>
        {getStatusBadge()}
      </div>

      {/* Date & Venue Row */}
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
          {new Date(match.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {match.startTime}
        </div>
        {match.venue && match.venue !== 'TBA' && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', opacity: 0.7 }}>
            📍 {match.venue}
          </div>
        )}
      </div>

      {/* Winner / Voting Status */}
      {(hasWinner || timeMessage) && (
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '1rem',
          padding: '0.4rem 0.75rem',
          borderRadius: '8px',
          background: hasWinner ? 'rgba(251, 191, 36, 0.08)' : canVote ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
        }}>
          <div style={{ 
            color: canVote ? 'var(--accent-success)' : hasWinner ? '#FBBF24' : 'var(--text-muted)', 
            fontWeight: 600, 
            fontSize: '0.8rem' 
          }}>
            {hasWinner ? `🏆 Winner: ${match.winner}` : timeMessage}
          </div>
        </div>
      )}

      {/* Teams Layout */}
      <div className="match-teams-layout" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        {/* Team 1 */}
        <div style={{ 
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: hasWinner && !isTeam1Winner ? 0.25 : 1,
          filter: hasWinner && !isTeam1Winner ? 'grayscale(100%)' : 'none',
          transition: 'all 0.5s'
        }}>
          <motion.div 
            whileHover={canVote ? { scale: 1.12 } : {}}
            whileTap={canVote ? { scale: 0.95 } : {}}
            className="team-circle"
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: `linear-gradient(145deg, ${getTeamColor(match.team1)}cc 0%, ${getTeamColor(match.team1)}33 100%)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem',
              border: `3px solid ${userVote === match.team1 ? 'white' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: userVote === match.team1 ? `0 0 25px ${getTeamColor(match.team1)}88` : `0 4px 12px rgba(0,0,0,0.3)`,
              cursor: canVote ? 'pointer' : 'default',
              position: 'relative',
              lineHeight: '1.2'
            }}
            onClick={() => handleVote(match.team1)}
          >
            {isTeam1Winner && (
              <motion.div 
                initial={{ scale: 0, rotate: -20 }} 
                animate={{ scale: 1, rotate: 0 }}
                style={{ position: 'absolute', top: -14, fontSize: '1.4rem' }}
              >👑</motion.div>
            )}
            <span style={{ fontSize: '1.4rem', marginBottom: '-3px' }}>{getTeamIcon(match.team1)}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{match.team1}</span>
          </motion.div>
          <div style={{ 
            fontSize: '0.8rem', 
            color: isTeam1Winner ? '#FBBF24' : 'var(--text-secondary)', 
            textAlign: 'center', 
            fontWeight: isTeam1Winner ? 'bold' : 'normal',
            maxWidth: '100px',
            lineHeight: '1.2'
          }}>
            {match.team1Full}
          </div>
          
          {!isCompleted && (
            <motion.button 
              whileHover={canVote ? { scale: 1.05 } : {}}
              whileTap={canVote ? { scale: 0.95 } : {}}
              className={`btn ${userVote === match.team1 ? 'btn-primary' : 'btn-outline'}`}
              style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              onClick={() => handleVote(match.team1)}
              disabled={!canVote && userVote !== match.team1}
            >
              {userVote === match.team1 ? '✓ Voted' : 'Vote'}
            </motion.button>
          )}
        </div>

        {/* VS Divider */}
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          opacity: hasWinner ? 0.2 : 0.6
        }}>
          <div style={{ width: '1px', height: '20px', background: 'var(--surface-border)' }}></div>
          <div style={{ 
            fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', 
            letterSpacing: '2px'
          }}>
            VS
          </div>
          <div style={{ width: '1px', height: '20px', background: 'var(--surface-border)' }}></div>
        </div>

        {/* Team 2 */}
        <div style={{ 
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          opacity: hasWinner && !isTeam2Winner ? 0.25 : 1,
          filter: hasWinner && !isTeam2Winner ? 'grayscale(100%)' : 'none',
          transition: 'all 0.5s'
        }}>
          <motion.div 
            whileHover={canVote ? { scale: 1.12 } : {}}
            whileTap={canVote ? { scale: 0.95 } : {}}
            className="team-circle"
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: `linear-gradient(145deg, ${getTeamColor(match.team2)}cc 0%, ${getTeamColor(match.team2)}33 100%)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem',
              border: `3px solid ${userVote === match.team2 ? 'white' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: userVote === match.team2 ? `0 0 25px ${getTeamColor(match.team2)}88` : `0 4px 12px rgba(0,0,0,0.3)`,
              cursor: canVote ? 'pointer' : 'default',
              position: 'relative',
              lineHeight: '1.2'
            }}
            onClick={() => handleVote(match.team2)}
          >
            {isTeam2Winner && (
              <motion.div 
                initial={{ scale: 0, rotate: 20 }} 
                animate={{ scale: 1, rotate: 0 }}
                style={{ position: 'absolute', top: -14, fontSize: '1.4rem' }}
              >👑</motion.div>
            )}
            <span style={{ fontSize: '1.4rem', marginBottom: '-3px' }}>{getTeamIcon(match.team2)}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{match.team2}</span>
          </motion.div>
          <div style={{ 
            fontSize: '0.8rem', 
            color: isTeam2Winner ? '#FBBF24' : 'var(--text-secondary)', 
            textAlign: 'center', 
            fontWeight: isTeam2Winner ? 'bold' : 'normal',
            maxWidth: '100px',
            lineHeight: '1.2'
          }}>
            {match.team2Full}
          </div>
          
          {!isCompleted && (
            <motion.button 
              whileHover={canVote ? { scale: 1.05 } : {}}
              whileTap={canVote ? { scale: 0.95 } : {}}
              className={`btn ${userVote === match.team2 ? 'btn-primary' : 'btn-outline'}`}
              style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              onClick={() => handleVote(match.team2)}
              disabled={!canVote && userVote !== match.team2}
            >
              {userVote === match.team2 ? '✓ Voted' : 'Vote'}
            </motion.button>
          )}
        </div>
      </div>

      {/* AI Prediction Section */}
      {!isCompleted && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          {!aiPrediction && !aiLoading && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleAIPredict}
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.15))',
                border: '1px solid rgba(139,92,246,0.3)',
                color: '#a78bfa',
                padding: '0.4rem 1rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-heading)',
              }}
            >
              ✨ AI Prediction
            </motion.button>
          )}
          {aiLoading && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0.5rem' }}>
              🧠 Analyzing match...
            </div>
          )}
          {aiPrediction && !aiPrediction.error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))',
                border: '1px solid rgba(139,92,246,0.2)',
                borderRadius: '12px',
                padding: '0.75rem',
                marginTop: '0.5rem',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🤖 AI Prediction • {aiPrediction.model}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a78bfa', marginBottom: '4px' }}>
                {aiPrediction.winner} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>({aiPrediction.confidence}% confident)</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {aiPrediction.reason}
              </div>
            </motion.div>
          )}
          {aiPrediction?.error && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '0.5rem' }}>
              ⚠️ {aiPrediction.error}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}