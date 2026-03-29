import React, { useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

const features = [
  { icon: '🏠', label: 'Smart Room Allocation', sub: 'AI-matched by habits' },
  { icon: '💳', label: 'Payment Tracking',       sub: 'Card & receipt upload' },
  { icon: '📋', label: 'Complaint Management',   sub: 'Real-time resolution' },
  { icon: '🤖', label: 'KNN Compatibility',       sub: '86% accurate matching' },
];

export default function Login({ onLogin }) {
  const [form, setForm]       = useState({ username: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await axios.post(`${API}/login`, form);
      onLogin(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">

      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        <div className="login-left-content">

          {/* Brand */}
          <div className="login-hero-icon">H</div>

          <h1 className="login-hero-title">
            Your Hostel,<br />
            <span>Managed Smarter</span>
          </h1>

          <p className="login-hero-sub">
            A complete hostel management platform — from AI-powered room matching
            to real-time payments and complaints, all in one place.
          </p>

          {/* Feature cards */}
          <div className="login-features">
            {features.map(f => (
              <div className="login-feature" key={f.label}>
                <div className="login-feature-dot">{f.icon}</div>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13, lineHeight: 1.3 }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom stats */}
        <div className="login-stats">
          {[
            { val: '100+', lbl: 'Rooms' },
            { val: '2',    lbl: 'Buildings' },
            { val: '86%',  lbl: 'AI Accuracy' },
            { val: '3',    lbl: 'User Roles' },
          ].map(s => (
            <div className="login-stat" key={s.lbl}>
              <span className="login-stat-val">{s.val}</span>
              <span className="login-stat-lbl">{s.lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="login-right">
        <div className="login-card">

          <div className="login-header">
            <h2 className="login-title">Welcome back</h2>
            <p className="login-subtitle">Sign in to your account to continue</p>
          </div>

          {error && <div className="login-error">⚠ {error}</div>}

          <form onSubmit={submit} className="login-form">
            <div className="login-field">
              <label>Username</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="Enter your username"
                required autoFocus
              />
            </div>
            <div className="login-field">
              <label>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password"
                required
              />
            </div>
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div className="demo-accounts">
            <p className="demo-label">Quick access — demo accounts</p>
            <div className="demo-pills">
              {[
                { cls: 'admin',   role: 'Admin',   u: 'admin',   p: 'admin123' },
                { cls: 'staff',   role: 'Staff',   u: 'staff',   p: 'staff123' },
                { cls: 'student', role: 'Student', u: 'student', p: 'student123' },
              ].map(({ cls, role, u, p }) => (
                <button
                  key={cls}
                  className={`demo-pill ${cls}`}
                  onClick={() => setForm({ username: u, password: p })}
                >
                  <span className="demo-role">{role}</span>
                  <span className="demo-creds">{u} / {p}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}