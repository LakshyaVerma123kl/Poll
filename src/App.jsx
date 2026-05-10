import React from 'react';
import { AppProvider, useApp } from './context/AppProvider';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import './index.css';

import { AnimatePresence, motion } from 'framer-motion';

import { Toaster, resolveValue } from 'react-hot-toast';

const AppContent = () => {
  const { currentUser } = useApp();
  
  return (
    <>
      <Toaster 
        position="top-center"
        containerStyle={{ zIndex: 99999 }}
      >
        {(t) => (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.85 }}
            animate={{ opacity: t.visible ? 1 : 0, y: t.visible ? 0 : -30, scale: t.visible ? 1 : 0.85 }}
            exit={{ opacity: 0, y: -30, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(10, 12, 20, 0.85)',
              backdropFilter: 'blur(20px)',
              border: t.type === 'success' ? '1px solid rgba(16, 185, 129, 0.4)' : 
                      t.type === 'error' ? '1px solid rgba(239, 68, 68, 0.4)' : 
                      '1px solid rgba(139, 92, 246, 0.4)',
              boxShadow: t.type === 'success' ? '0 10px 40px -10px rgba(16, 185, 129, 0.3), inset 0 0 20px rgba(16, 185, 129, 0.1)' : 
                         t.type === 'error' ? '0 10px 40px -10px rgba(239, 68, 68, 0.3), inset 0 0 20px rgba(239, 68, 68, 0.1)' : 
                         '0 10px 40px -10px rgba(139, 92, 246, 0.3), inset 0 0 20px rgba(139, 92, 246, 0.1)',
              padding: '12px 24px',
              borderRadius: '50px',
              color: '#f8fafc',
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              fontWeight: 600,
              gap: '12px',
              pointerEvents: 'auto',
            }}
          >
            {t.type === 'success' ? <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.6))' }}>✨</span> : 
             t.type === 'error' ? <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 8px rgba(239,68,68,0.6))' }}>⚠️</span> : 
             <span style={{ fontSize: '1.2rem', filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.6))' }}>🔔</span>}
            <div>{resolveValue(t.message, t)}</div>
          </motion.div>
        )}
      </Toaster>
      <AnimatePresence mode="wait">
        {currentUser ? <Dashboard key="dash" /> : <Onboarding key="onboard" />}
      </AnimatePresence>
    </>
  );
};

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
