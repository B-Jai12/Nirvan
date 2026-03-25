import { motion, AnimatePresence } from 'framer-motion';

/**
 * PageTransition
 * Wraps page content with a smooth fade + slide animation on route change.
 * Usage: wrap each page's root with <PageTransition> in App.jsx.
 *
 * @param {string} key - unique key per route (use pathname)
 */
export default function PageTransition({ children, className = '' }) {
  return (
    <motion.div
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * AuthTransitionOverlay
 * Full-screen cinematic overlay shown during auth success.
 * Shows dark background + pulsing shield logo, then navigates.
 *
 * @param {boolean} visible  - whether overlay is active
 * @param {boolean} done     - when true, overlay fades out and children reveal
 */
export function AuthTransitionOverlay({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="auth-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: '#0a0a0f',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '1.5rem',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        >
          {/* Pulsing shield logo */}
          <motion.div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 88, height: 88, borderRadius: '50%',
              background: 'rgba(196, 153, 138, 0.08)',
              border: '1.5px solid rgba(196, 153, 138, 0.25)',
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{
              scale: [0.8, 1.05, 1],
              opacity: 1,
              boxShadow: [
                '0 0 0px 0px rgba(196,153,138,0)',
                '0 0 40px 18px rgba(196,153,138,0.25)',
                '0 0 20px 8px rgba(196,153,138,0.15)',
              ],
            }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
          >
            {/* Outer ring pulse */}
            <motion.div
              style={{
                position: 'absolute',
                width: 88, height: 88, borderRadius: '50%',
                border: '1px solid rgba(196,153,138,0.3)',
              }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Shield SVG */}
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <svg viewBox="0 0 20 24" fill="none" width="36" height="40">
                <path
                  d="M10 2L3 5.5v7.5c0 5.5 3.5 9.5 7 11.5 3.5-2 7-6 7-11.5V5.5L10 2z"
                  fill="none"
                  stroke="#C4998A"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M7 12l2 2 4-4"
                  stroke="#C4998A"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </motion.div>

          {/* Nirvan label */}
          <motion.p
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.1rem',
              letterSpacing: '0.25em',
              color: 'rgba(196,153,138,0.65)',
              textTransform: 'uppercase',
              margin: 0,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6 }}
          >
            Activating Guardian
          </motion.p>

          {/* Loading dots */}
          <motion.div
            style={{ display: 'flex', gap: '6px', marginTop: '0.25rem' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'rgba(196,153,138,0.55)',
                  display: 'block',
                }}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
