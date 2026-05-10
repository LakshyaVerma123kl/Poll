import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppProvider';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import { sounds } from '../utils/audio';

// ── Voting window calculation (shared helper) ──
function calcVotingWindow(match) {
  const startTime = match.startTime || '19:30';
  const [startH, startM] = startTime.split(':').map(Number);
  const matchStartIST = new Date(`${match.date}T${startTime.padStart(5,'0')}:00+05:30`);
  const matchStartMs = matchStartIST.getTime();

  // Open 30 mins prior to match
  let voteOpenMs = matchStartMs - (30 * 60 * 1000);
  // Close 1.25 hours (75 mins) after match start
  let voteCloseMs = matchStartMs + (75 * 60 * 1000);

  const openTime = new Date(voteOpenMs);
  const openTimeStr = openTime.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const openDateStr = openTime.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric' });
  const openLabel = `${openDateStr}, ${openTimeStr} IST`;

  const closeLabel = `~1.25 hrs`;

  // Provide arbitrary values to not break downstream components
  const overLimit = 15;
  const matchType = match.matchType || 't20';
  const isAbroad = false;

  return { voteOpenMs, voteCloseMs, openLabel, closeLabel, matchType, isAbroad, overLimit, matchStartMs };
}

// ── Format badge colors ──
const FORMAT_COLORS = {
  t20: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#f87171', label: 'T20' },
  odi: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', text: '#60a5fa', label: 'ODI' },
  test: { bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.4)', text: '#fbbf24', label: 'TEST' },
};

export default function MatchCard({ match }) {
  const { currentUser, castVote, votes, getAIPrediction } = useApp();
  const [canVote, setCanVote] = useState(false);
  const [windowState, setWindowState] = useState('waiting'); // waiting | open | closed
  const [countdown, setCountdown] = useState('');
  const [progress, setProgress] = useState(0);
  const [windowInfo, setWindowInfo] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const timerRef = useRef(null);
  
  const userVoteData = votes[match.id]?.[currentUser?.id];
  const userVote = userVoteData?.team;
  const isCompleted = match.status === 'completed' || (new Date(`${match.date}T${match.startTime || '19:30'}:00+05:30`).getTime() + 5 * 60 * 60 * 1000 < Date.now());
  const isLive = match.status === 'live';
  const hasWinner = isCompleted && match.winner;
  
  // Confetti and sound on win
  useEffect(() => {
    if (hasWinner && userVote) {
      if (userVote.toLowerCase() === match.winner.toLowerCase() || 
          match.winner.toLowerCase().includes(userVote.toLowerCase())) {
        const key = `confetti_${match.id}`;
        if (!sessionStorage.getItem(key)) {
          sounds.success();
          confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: ['#FBBF24', '#8B5CF6', '#3B82F6', '#10B981'] });
          sessionStorage.setItem(key, 'true');
        }
      }
    }
  }, [hasWinner, match.winner, userVote, match.id]);

  // ── Live countdown timer (updates every second) ──
  useEffect(() => {
    if (isCompleted) {
      setCanVote(false);
      setWindowState('completed');
      setCountdown('');
      return;
    }

    const win = calcVotingWindow(match);
    setWindowInfo(win);

    const tick = () => {
      const now = Date.now();

      if (now < win.voteOpenMs) {
        // WAITING — countdown to open
        setCanVote(false);
        setWindowState('waiting');
        const diff = win.voteOpenMs - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (h > 24) {
          setCountdown(`Opens at ${win.openLabel}`);
        } else if (h > 0) {
          setCountdown(`${h}h ${m}m ${s}s`);
        } else if (m > 0) {
          setCountdown(`${m}m ${s}s`);
        } else {
          setCountdown(`${s}s`);
        }
        setProgress(0);
      } else if (now <= win.voteCloseMs) {
        // OPEN — countdown to close
        setCanVote(true);
        setWindowState('open');
        const remaining = win.voteCloseMs - now;
        const total = win.voteCloseMs - win.voteOpenMs;
        const elapsed = now - win.voteOpenMs;
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        setCountdown(`${m}m ${s}s`);
        setProgress(Math.min(100, (elapsed / total) * 100));
      } else {
        // CLOSED
        setCanVote(false);
        setWindowState('closed');
        setCountdown('');
        setProgress(100);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [match, isCompleted]);

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

  const handleVoteClick = (team) => {
    if (userVote) {
      sounds.error();
      toast.error("You have already cast your vote. Votes cannot be changed!");
      return;
    }
    if (canVote) {
      sounds.hover();
      setSelectedTeam(team);
      setModalOpen(true);
    } else {
      sounds.error();
      const msg = windowState === 'waiting'
        ? `Voting hasn't opened yet. ${countdown ? `Opens in ${countdown}` : ''}`
        : `Voting window has closed for this match.`;
      toast.error(msg);
    }
  };

  const confirmVote = async () => {
    if (selectedTeam) {
      await castVote(match.id, selectedTeam);
      toast.success(`Successfully locked in vote for ${selectedTeam}!`);
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

  // Format badge
  const fmt = FORMAT_COLORS[windowInfo?.matchType || match.matchType || 't20'] || FORMAT_COLORS.t20;
  const isAbroad = windowInfo?.isAbroad || match.isAbroad === true || match.isAbroad === 1;

  // Status badge
  const getStatusBadge = () => {
    if (isLive) return <span className="status-badge live"><span className="live-dot"></span>LIVE</span>;
    if (isCompleted) return <span className="status-badge completed">✓ Completed</span>;
    return <span className="status-badge upcoming">Upcoming</span>;
  };

  const matchVotes = votes[match.id] || {};
  const team1Voters = Object.values(matchVotes).filter(v => v.team === match.team1);
  const team2Voters = Object.values(matchVotes).filter(v => v.team === match.team2);

  const renderVoters = (voters) => {
    if (voters.length === 0) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '4px' }}>
        {voters.map((v, i) => (
          <div key={`${v.name}-${i}`} title={v.name} style={{
            width: '22px', height: '22px', borderRadius: '50%',
            background: 'var(--gradient-primary)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.65rem', fontWeight: 'bold', border: '1.5px solid var(--background)'
          }}>
            {v.avatar}
          </div>
        ))}
      </div>
    );
  };

  // Voting window section
  const renderVotingWindow = () => {
    if (isCompleted) return null;

    const windowColor = windowState === 'open' ? '#10b981' : windowState === 'waiting' ? '#f59e0b' : '#ef4444';

    return (
      <div style={{
        margin: '0.75rem 0',
        padding: '0.6rem 0.75rem',
        borderRadius: '10px',
        background: windowState === 'open' 
          ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.03))' 
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${windowColor}22`,
      }}>
        {/* Status line */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: windowColor,
              boxShadow: windowState === 'open' ? `0 0 8px ${windowColor}` : 'none',
              animation: windowState === 'open' ? 'pulse 1.5s infinite' : 'none',
            }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: windowColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {windowState === 'open' ? 'Voting Open' : windowState === 'waiting' ? 'Voting Soon' : 'Voting Closed'}
            </span>
          </div>
          {countdown && (
            <span style={{
              fontSize: '0.78rem', fontWeight: 700, color: windowColor,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              letterSpacing: '0.5px',
            }}>
              {windowState === 'open' ? `${countdown} left` : countdown}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {windowState !== 'completed' && (
          <div style={{
            width: '100%', height: '3px', borderRadius: '3px',
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                height: '100%', borderRadius: '3px',
                background: windowState === 'open'
                  ? `linear-gradient(90deg, ${windowColor}, ${windowColor}88)`
                  : `linear-gradient(90deg, ${windowColor}44, ${windowColor}22)`,
              }}
            />
          </div>
        )}

        {/* Window details */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          <span>Opens: {windowInfo?.openLabel || '—'}</span>
          <span>Closes: {windowInfo?.closeLabel || '—'}</span>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.012, y: -2 }}
      transition={{ duration: 0.35 }}
      className={`glass-panel ${isLive ? 'live-pulse' : ''}`}
      style={{ 
        padding: '1.5rem', 
        marginBottom: '1rem', 
        position: 'relative', 
        overflow: 'hidden',
        borderLeft: isLive ? '3px solid #ef4444' : hasWinner ? '3px solid #fbbf24' : windowState === 'open' ? '3px solid #10b981' : '3px solid transparent',
      }}
    >
      {/* Top Row: Tournament + Badges */}
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        marginBottom: '0.75rem', flexWrap: 'wrap', gap: '6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* Format Badge */}
          <span style={{
            fontSize: '0.6rem', fontWeight: 800, letterSpacing: '1px',
            padding: '2px 8px', borderRadius: '4px',
            background: fmt.bg, border: `1px solid ${fmt.border}`, color: fmt.text,
          }}>
            {fmt.label}
          </span>
          {/* Location Badge */}
          <span style={{
            fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.5px',
            padding: '2px 7px', borderRadius: '4px',
            background: isAbroad ? 'rgba(139,92,246,0.12)' : 'rgba(16,185,129,0.12)',
            color: isAbroad ? '#a78bfa' : '#34d399',
            border: `1px solid ${isAbroad ? 'rgba(139,92,246,0.3)' : 'rgba(16,185,129,0.3)'}`,
          }}>
            {isAbroad ? '🌍 Abroad' : '🇮🇳 India'}
          </span>
          {/* Tournament name */}
          <span style={{ 
            fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {match.tournament}
          </span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Date & Venue */}
      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
          {new Date(match.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} • {match.startTime || '19:30'} IST
        </div>
        {match.venue && match.venue !== 'TBA' && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', opacity: 0.7 }}>
            📍 {match.venue}
          </div>
        )}
      </div>

      {/* Winner display */}
      {hasWinner && (
        <div style={{ 
          textAlign: 'center', marginBottom: '0.75rem', padding: '0.4rem 0.75rem',
          borderRadius: '8px', background: 'rgba(251, 191, 36, 0.08)',
        }}>
          <div style={{ color: '#FBBF24', fontWeight: 700, fontSize: '0.85rem' }}>
            🏆 Winner: {match.winner}
          </div>
        </div>
      )}

      {/* Voting Window */}
      {renderVotingWindow()}

      {/* Teams Layout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
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
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: `linear-gradient(145deg, ${getTeamColor(match.team1)}cc 0%, ${getTeamColor(match.team1)}33 100%)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem',
              border: `3px solid ${userVote === match.team1 ? 'white' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: userVote === match.team1 ? `0 0 25px ${getTeamColor(match.team1)}88` : `0 4px 12px rgba(0,0,0,0.3)`,
              cursor: canVote && !userVote ? 'pointer' : 'default',
              position: 'relative', lineHeight: '1.2'
            }}
            onClick={() => handleVoteClick(match.team1)}
          >
            {isTeam1Winner && (
              <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                style={{ position: 'absolute', top: -14, fontSize: '1.4rem' }}>👑</motion.div>
            )}
            <span style={{ fontSize: '1.4rem', marginBottom: '-3px' }}>{getTeamIcon(match.team1)}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{match.team1}</span>
          </motion.div>
          <div style={{ 
            fontSize: '0.8rem', color: isTeam1Winner ? '#FBBF24' : 'var(--text-secondary)', 
            textAlign: 'center', fontWeight: isTeam1Winner ? 'bold' : 'normal',
            maxWidth: '100px', lineHeight: '1.2'
          }}>
            {match.team1Full}
          </div>
          
          {!isCompleted && (
            <motion.button 
              whileHover={canVote && !userVote ? { scale: 1.05 } : {}}
              whileTap={canVote && !userVote ? { scale: 0.95 } : {}}
              className={`btn ${userVote === match.team1 ? 'btn-primary' : 'btn-outline'}`}
              style={{ 
                marginTop: '0.75rem', width: '100%', padding: '0.5rem', fontSize: '0.85rem',
                opacity: (!canVote || userVote) && userVote !== match.team1 ? 0.4 : 1,
              }}
              onClick={() => handleVoteClick(match.team1)}
              disabled={!canVote || !!userVote}
            >
              {userVote === match.team1 ? '✓ Voted' : canVote ? '🗳️ Vote' : 'Vote'}
            </motion.button>
          )}
          {renderVoters(team1Voters)}
        </div>

        {/* VS Divider */}
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          opacity: hasWinner ? 0.2 : 0.6
        }}>
          <div style={{ width: '1px', height: '20px', background: 'var(--surface-border)' }}></div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '2px' }}>VS</div>
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
            style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: `linear-gradient(145deg, ${getTeamColor(match.team2)}cc 0%, ${getTeamColor(match.team2)}33 100%)`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.5rem',
              border: `3px solid ${userVote === match.team2 ? 'white' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: userVote === match.team2 ? `0 0 25px ${getTeamColor(match.team2)}88` : `0 4px 12px rgba(0,0,0,0.3)`,
              cursor: canVote && !userVote ? 'pointer' : 'default',
              position: 'relative', lineHeight: '1.2'
            }}
            onClick={() => handleVoteClick(match.team2)}
          >
            {isTeam2Winner && (
              <motion.div initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: 0 }}
                style={{ position: 'absolute', top: -14, fontSize: '1.4rem' }}>👑</motion.div>
            )}
            <span style={{ fontSize: '1.4rem', marginBottom: '-3px' }}>{getTeamIcon(match.team2)}</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>{match.team2}</span>
          </motion.div>
          <div style={{ 
            fontSize: '0.8rem', color: isTeam2Winner ? '#FBBF24' : 'var(--text-secondary)', 
            textAlign: 'center', fontWeight: isTeam2Winner ? 'bold' : 'normal',
            maxWidth: '100px', lineHeight: '1.2'
          }}>
            {match.team2Full}
          </div>
          
          {!isCompleted && (
            <motion.button 
              whileHover={canVote && !userVote ? { scale: 1.05 } : {}}
              whileTap={canVote && !userVote ? { scale: 0.95 } : {}}
              className={`btn ${userVote === match.team2 ? 'btn-primary' : 'btn-outline'}`}
              style={{ 
                marginTop: '0.75rem', width: '100%', padding: '0.5rem', fontSize: '0.85rem',
                opacity: (!canVote || userVote) && userVote !== match.team2 ? 0.4 : 1,
              }}
              onClick={() => handleVoteClick(match.team2)}
              disabled={!canVote || !!userVote}
            >
              {userVote === match.team2 ? '✓ Voted' : canVote ? '🗳️ Vote' : 'Vote'}
            </motion.button>
          )}
          {renderVoters(team2Voters)}
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
                color: '#a78bfa', padding: '0.4rem 1rem', borderRadius: '20px',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px',
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
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))',
                border: '1px solid rgba(139,92,246,0.2)', borderRadius: '12px',
                padding: '0.75rem', marginTop: '0.5rem',
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
      
      <ConfirmModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onConfirm={confirmVote} 
        team={selectedTeam} 
      />
    </motion.div>
  );
}