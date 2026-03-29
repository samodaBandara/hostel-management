import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Dashboard      from './pages/Dashboard';
import Students       from './pages/Students';
import Rooms          from './pages/Room';
import Allocations    from './pages/Allocations';
import Payments       from './pages/Payments';
import Complaints     from './pages/Complaints';
import Login          from './pages/Login';
import RoomPreferences from './pages/RoomPreference';
import './App.css';

const NAV = {
  admin: [
    { to: '/',            label: 'Dashboard',        icon: '▣'  },
    { to: '/students',    label: 'Students',          icon: '👤' },
    { to: '/rooms',       label: 'Rooms',             icon: '🏠' },
    { to: '/allocations', label: 'Allocations',       icon: '🔗' },
    { to: '/payments',    label: 'Payments',          icon: '💳' },
    { to: '/complaints',  label: 'Complaints',        icon: '📋' },
  ],
  staff: [
    { to: '/',           label: 'Dashboard',  icon: '▣'  },
    { to: '/rooms',      label: 'Rooms',      icon: '🏠' },
    { to: '/complaints', label: 'Complaints', icon: '📋' },
  ],
  student: [
    { to: '/',            label: 'Dashboard',        icon: '▣'  },
    { to: '/preferences', label: 'Room Preferences', icon: '📝' },
    { to: '/payments',    label: 'Payments',         icon: '💳' },
    { to: '/complaints',  label: 'Complaints',       icon: '📋' },
  ],
};

const ROLE_COLORS = { admin: '#0ab8a0', staff: '#f59e0b', student: '#6366f1' };
const ROLE_BADGE  = { admin: 'badge-teal', staff: 'badge-amber', student: 'badge-indigo' };

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('hms_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin  = (userData) => { localStorage.setItem('hms_user', JSON.stringify(userData)); setUser(userData); };
  const handleLogout = ()         => { localStorage.removeItem('hms_user'); setUser(null); };

  if (!user) return <Login onLogin={handleLogin} />;

  const navItems = NAV[user.role] || NAV.student;

  return (
    <Router>
      <div className="app">

        {/* ── SIDEBAR ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-icon">H</div>
            <div>
              <div className="logo-title">HostelMS</div>
              <div className="logo-sub">Management System</div>
            </div>
          </div>

          <div className="sidebar-user">
            <div className="su-avatar" style={{ background: ROLE_COLORS[user.role] }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="su-info">
              <div className="su-name">{user.name}</div>
              <span className={`badge ${ROLE_BADGE[user.role]} su-role`}>{user.role}</span>
            </div>
          </div>

          <div className="sidebar-section-label">Menu</div>

          <nav className="sidebar-nav">
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <button className="logout-btn" onClick={handleLogout}>
            <span>⏻</span> Sign Out
          </button>
        </aside>

        {/* ── MAIN ── */}
        <div className="main-wrapper">
          <main className="main-content">
            <Routes>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/students"    element={user.role === 'admin'   ? <Students />    : <Navigate to="/" />} />
              <Route path="/rooms"       element={user.role !== 'student' ? <Rooms />       : <Navigate to="/" />} />
              <Route path="/allocations" element={user.role === 'admin'   ? <Allocations /> : <Navigate to="/" />} />
              <Route path="/payments"    element={<Payments user={user} />} />
              <Route path="/complaints"  element={<Complaints user={user} />} />
              <Route path="/preferences" element={user.role === 'student' ? <RoomPreferences user={user} /> : <Navigate to="/" />} />
            </Routes>
          </main>
        </div>

      </div>
    </Router>
  );
}