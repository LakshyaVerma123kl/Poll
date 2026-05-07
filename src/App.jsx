import React from 'react';
import { AppProvider, useApp } from './context/AppProvider';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import './index.css';

import { AnimatePresence } from 'framer-motion';

const AppContent = () => {
  const { currentUser } = useApp();
  
  return (
    <AnimatePresence mode="wait">
      {currentUser ? <Dashboard key="dash" /> : <Onboarding key="onboard" />}
    </AnimatePresence>
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
