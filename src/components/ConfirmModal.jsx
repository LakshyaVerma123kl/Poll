import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';
import { sounds } from '../utils/audio';

export default function ConfirmModal({ isOpen, onClose, onConfirm, team, title, message }) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    sounds.lock();
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              zIndex: 9998
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%', maxWidth: '400px',
              background: 'rgba(16, 18, 27, 0.85)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '24px',
              padding: '2rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(139, 92, 246, 0.2)',
              zIndex: 9999,
              textAlign: 'center'
            }}
          >
            <div style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              background: 'rgba(139, 92, 246, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.2) inset'
            }}>
              <ShieldCheck size={32} color="#a78bfa" />
            </div>

            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#fff' }}>
              {title || 'Lock in Prediction?'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.5' }}>
              {message || `You are about to lock in your vote for ${team}. Once confirmed, this action cannot be undone.`}
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1, padding: '0.75rem', borderRadius: '12px' }}
                onClick={() => { sounds.hover(); onClose(); }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ 
                  flex: 1, 
                  padding: '0.75rem', 
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                }}
                onClick={handleConfirm}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
