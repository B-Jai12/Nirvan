import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import ClickSpark from './components/ClickSpark';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Permissions from './pages/Permissions';
import Dashboard from './pages/Dashboard';

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ClickSpark sparkColor="#1C1410" sparkSize={12} sparkRadius={22} sparkCount={8} duration={500} extraScale={1.2}>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </ClickSpark>
  );
}
