import React, { useState } from 'react';
import { useApp } from '../context/AppProvider';
import { motion } from 'framer-motion';

export default function Onboarding() {
  const { login } = useApp();
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      login(name.trim());
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="app-container" 
      style={{ justifyContent: 'center', alignItems: 'center' }}
    >
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="glass-panel" 
        style={{ padding: '3rem', maxWidth: '400px', width: '100%', textAlign: 'center' }}
      >
        <h1 className="text-gradient" style={{ marginBottom: '1rem', fontSize: '2.5rem' }}>PredictX</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Enter the arena. Predict matches. Climb the leaderboard.
        </p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Enter Arena
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
