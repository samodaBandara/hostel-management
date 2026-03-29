import React, { useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
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
      {/* Left panel */}
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-hero-icon">H</div>
          <h1 className="login-hero-title">Hostel Management System</h1>
          <p className="login-hero-sub">A complete solution to manage students, rooms, payments and complaints — all in one place.</p>
          <div className="login-features">
            {['Student & room management','Payment tracking','Complaint resolution','Role-based access control'].map(f => (
              <div className="login-feature" key={f}>
                <div className="login-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-header">
            <h2 className="login-title">Welcome back</h2>
            <p className="login-subtitle">Sign in to your account to continue</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={submit} className="login-form">
            <div className="login-field">
              <label>Username</label>
              <input type="text" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="Enter username" required autoFocus />
            </div>
            <div className="login-field">
              <label>Password</label>
              <input type="password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password" required />
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
                <button key={cls} className={`demo-pill ${cls}`}
                  onClick={() => setForm({ username: u, password: p })}>
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