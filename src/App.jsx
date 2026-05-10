import React from 'react';
import { AppProvider, useApp } from './context/AppProvider';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import './index.css';

import { AnimatePresence } from 'framer-motion';

import { Toaster } from 'react-hot-toast';

const AppContent = () => {
  const { currentUser } = useApp();
  
  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(16, 18, 27, 0.9)',
            backdropFilter: 'blur(10px)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontFamily: 'var(--font-body)',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
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
