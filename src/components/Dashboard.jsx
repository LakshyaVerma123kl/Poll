import React, { useState } from 'react';
import { useApp } from '../context/AppProvider';
import MatchCard from './MatchCard';
import Leaderboard from './Leaderboard';
import IplTable from './IplTable';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
  const { currentUser, logout, matches, users } = useApp();
  const [activeTab, setActiveTab] = useState('ipl');

  // Intelligent Sorting Logic
  const sortMatches = (matchList) => {
    return [...matchList].sort((a, b) => {
      // 1. Live matches always at the top
      if (a.status === 'live' && b.status !== 'live') return -1;
      if (b.status === 'live' && a.status !== 'live') return 1;

      // Helper: treat matches older than 5 hours as completed
      const isCompleted = (m) => m.status === 'completed' || (new Date(`${m.date}T${m.startTime || '19:30'}:00+05:30`).getTime() + 5 * 60 * 60 * 1000 < Date.now());
      
      const aComp = isCompleted(a);
      const bComp = isCompleted(b);

      // 2. Completed matches at the bottom
      if (aComp && !bComp) return 1;
      if (bComp && !aComp) return -1;

      // 3. For upcoming matches, sort nearest first (ascending)
      // For completed matches, sort newest first (descending)
      const dateA = new Date(`${a.date}T${a.startTime || '19:30'}:00+05:30`).getTime();
      const dateB = new Date(`${b.date}T${b.startTime || '19:30'}:00+05:30`).getTime();
      
      if (aComp) {
        return dateB - dateA; // Descending for completed
      } else {
        return dateA - dateB; // Ascending for upcoming
      }
    });
  };

  // Categorize and Sort matches
  const iplMatches = sortMatches(matches.filter(m => m.category === 'ipl'));
  const t20Matches = sortMatches(matches.filter(m => m.category === 'icc-t20'));
  const odiMatches = sortMatches(matches.filter(m => m.category === 'icc-odi'));
  const testMatches = sortMatches(matches.filter(m => m.category === 'icc-test'));
  const domesticMatches = sortMatches(matches.filter(m => m.category === 'domestic'));

  const tabs = [
    { id: 'ipl', label: '🏏 IPL', count: iplMatches.length },
    { id: 'icc', label: '🌍 ICC', count: t20Matches.length + odiMatches.length + testMatches.length },
    { id: 'domestic', label: '🏟️ Domestic', count: domesticMatches.length },
    { id: 'leaderboard', label: '🏆 Board', count: users ? users.length : 0 },
  ];

  const [iplSubTab, setIplSubTab] = useState('schedule');
  const [iccSubTab, setIccSubTab] = useState('t20');

  const iplSubTabs = [
    { id: 'schedule', label: 'Schedule' },
    { id: 'table', label: 'Points Table' },
  ];

  const iccSubTabs = [
    { id: 't20', label: 'T20I' },
    { id: 'odi', label: 'ODI' },
    { id: 'test', label: 'Test' },
  ];

  const getIccMatches = () => {
    switch (iccSubTab) {
      case 't20': return t20Matches;
      case 'odi': return odiMatches;
      case 'test': return testMatches;
      default: return t20Matches;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="app-container"
    >
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="header-title">
          <span className="text-gradient" style={{ fontWeight: 800 }}>PredictX</span> Arena
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <motion.div whileHover={{ scale: 1.05 }} className="user-badge">
            <div className="user-avatar">{currentUser?.avatar}</div>
            <span style={{ fontWeight: 600 }}>{currentUser?.name}</span>
            <span style={{ color: 'var(--accent-secondary)', fontWeight: 700, marginLeft: '0.5rem' }}>
              {currentUser?.points} pts
            </span>
          </motion.div>
          
          <button onClick={logout} className="btn btn-outline" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Exit
          </button>
        </div>
      </motion.header>

      <main>
        {/* Main Tabs */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="tabs"
          style={{ position: 'relative' }}
        >
          {tabs.map(tab => (
            <div 
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ position: 'relative', cursor: 'pointer' }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-main-tab"
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'var(--accent-primary)',
                    boxShadow: '0 0 8px var(--accent-primary)',
                    borderRadius: '3px'
                  }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="match-count">{tab.count}</span>
              )}
            </div>
          ))}
        </motion.div>

        <div className="tab-content" style={{ position: 'relative' }}>
          <AnimatePresence mode="wait">
            {/* ============ IPL TAB ============ */}
            {activeTab === 'ipl' && (
              <motion.div 
                key="ipl"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🏏</span>
                  IPL 2026
                </h2>

                <div className="tabs" style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', position: 'relative' }}>
                  {iplSubTabs.map(sub => (
                    <div 
                      key={sub.id}
                      className={`tab ${iplSubTab === sub.id ? 'active' : ''}`}
                      onClick={() => setIplSubTab(sub.id)}
                      style={{ position: 'relative', cursor: 'pointer' }}
                    >
                      {iplSubTab === sub.id && (
                        <motion.div
                          layoutId="active-ipl-subtab"
                          style={{
                            position: 'absolute',
                            bottom: -2,
                            left: 0,
                            right: 0,
                            height: '2px',
                            background: 'var(--accent-primary)',
                            boxShadow: '0 0 8px var(--accent-primary)',
                            borderRadius: '2px'
                          }}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                        />
                      )}
                      {sub.label}
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {iplSubTab === 'schedule' && (
                    <motion.div 
                      key="schedule"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      {iplMatches.length > 0 ? (
                        iplMatches.map((match, i) => (
                          <motion.div 
                            key={match.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <MatchCard match={match} />
                          </motion.div>
                        ))
                      ) : (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Loading IPL matches...
                        </div>
                      )}
                    </motion.div>
                  )}
                  {iplSubTab === 'table' && (
                    <motion.div
                      key="table"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                    >
                      <IplTable />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ============ ICC TAB ============ */}
            {activeTab === 'icc' && (
              <motion.div
                key="icc"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🌍</span>
                  ICC International Cricket
                </h2>

                {/* ICC Sub-tabs */}
                <div className="tabs" style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', position: 'relative' }}>
                  {iccSubTabs.map(sub => (
                    <div 
                      key={sub.id}
                      className={`tab ${iccSubTab === sub.id ? 'active' : ''}`}
                      onClick={() => setIccSubTab(sub.id)}
                      style={{ position: 'relative', cursor: 'pointer' }}
                    >
                      {iccSubTab === sub.id && (
                        <motion.div
                          layoutId="active-icc-subtab"
                          style={{
                            position: 'absolute',
                            bottom: -2,
                            left: 0,
                            right: 0,
                            height: '2px',
                            background: 'var(--accent-primary)',
                            boxShadow: '0 0 8px var(--accent-primary)',
                            borderRadius: '2px'
                          }}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                        />
                      )}
                      {sub.label}
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div 
                    key={iccSubTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.15 }}
                  >
                    {getIccMatches().length > 0 ? (
                      getIccMatches().map((match, i) => (
                        <motion.div 
                          key={match.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <MatchCard match={match} />
                        </motion.div>
                      ))
                    ) : (
                      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No {iccSubTab.toUpperCase()} matches scheduled yet.
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}

            {/* ============ DOMESTIC TAB ============ */}
            {activeTab === 'domestic' && (
              <motion.div 
                key="domestic"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🏟️</span>
                  Domestic & Unofficial
                </h2>
                
                {domesticMatches.length > 0 ? (
                  domesticMatches.map((match, i) => (
                    <motion.div 
                      key={match.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <MatchCard match={match} />
                    </motion.div>
                  ))
                ) : (
                  <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No Domestic matches currently scheduled.
                  </div>
                )}
              </motion.div>
            )}

            {/* ============ LEADERBOARD TAB ============ */}
            {activeTab === 'leaderboard' && (
              <motion.div
                key="leaderboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Leaderboard />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="app-footer">
        <span className="shimmer-text" style={{ fontFamily: 'var(--font-heading)', fontWeight: 600 }}>PredictX Arena</span>
        <span style={{ margin: '0 6px' }}>•</span>
        Built with 🏏 for Cricket Fans
      </footer>
    </motion.div>
  );
}
