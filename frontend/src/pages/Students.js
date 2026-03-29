import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';
const blank = { full_name: '', email: '', phone: '', gender: '', address: '', username: '', password: '' };

const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const validatePhone = (v) => /^0\d{9}$/.test(v.trim());

// ── MUST be outside Students() to avoid remount on every keystroke ──
function Field({ label, error, hint, children, span }) {
  return (
    <div className="form-group" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label>{label}</label>
      {children}
      {error && (
        <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          ⚠ {error}
        </div>
      )}
      {!error && hint && (
        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{hint}</div>
      )}
    </div>
  );
}

export default function Students() {
  const [students, setStudents] = useState([]);
  const [form, setForm]         = useState(blank);
  const [errors, setErrors]     = useState({});
  const [editId, setEditId]     = useState(null);
  const [msg, setMsg]           = useState({ text: '', type: '' });
  const [newCreds, setNewCreds] = useState(null);
  const [showPass, setShowPass] = useState(false);

  const load = () => axios.get(`${API}/students`).then(r => setStudents(r.data));
  useEffect(() => { load(); }, []);

  const flash = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const handleNameChange = (val) => {
    const auto = val.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    setForm(f => ({ ...f, full_name: val, username: editId ? f.username : auto }));
    if (errors.full_name) setErrors(e => ({ ...e, full_name: '' }));
  };

  const handlePhoneChange = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setForm(f => ({ ...f, phone: digits }));
    if (errors.phone) setErrors(e => ({ ...e, phone: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim())                                  e.full_name = 'Full name is required';
    if (!form.email.trim())                                      e.email     = 'Email is required';
    else if (!validateEmail(form.email))                         e.email     = 'Enter a valid email (e.g. name@example.com)';
    if (form.phone && !validatePhone(form.phone))                e.phone     = 'Phone must be exactly 10 digits starting with 0';
    if (!form.username || form.username.length < 3)              e.username  = 'Username must be at least 3 characters';
    if (!editId && (!form.password || form.password.length < 6)) e.password  = 'Password must be at least 6 characters';
    if (editId && form.password && form.password.length < 6)     e.password  = 'Password must be at least 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (editId) {
        await axios.put(`${API}/students/${editId}`, form);
        flash('Student updated successfully!');
        setForm(blank); setEditId(null);
      } else {
        await axios.post(`${API}/students`, form);
        flash('Student created successfully!');
        setNewCreds({ name: form.full_name, username: form.username, password: form.password });
        setForm(blank);
      }
      setErrors({});
      load();
    } catch (err) {
      flash(err.response?.data?.error || 'An error occurred', 'error');
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this student? This cannot be undone.')) return;
    await axios.delete(`${API}/students/${id}`);
    flash('Student deleted'); load();
  };

  const edit = (s) => {
    setForm({ full_name: s.full_name, email: s.email, phone: s.phone||'', gender: s.gender||'', address: s.address||'', username: s.username||'', password: '' });
    setEditId(s.student_id);
    setErrors({});
    setNewCreds(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    flash('Copied to clipboard!');
  };

  const inputStyle = (field) => errors[field]
    ? { borderColor: 'var(--red)', boxShadow: '0 0 0 3px rgba(239,68,68,0.1)' }
    : {};

  const phoneHint = !errors.phone && form.phone.length > 0 && form.phone.length < 10
    ? `${10 - form.phone.length} more digit${10 - form.phone.length !== 1 ? 's' : ''} needed`
    : '';

  return (
    <div>
      <div className="page-header">
        <h1>Students</h1>
        <p>Manage student records and login credentials</p>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Credential card */}
      {newCreds && (
        <div style={{
          background: 'linear-gradient(135deg,#f0fdfb,#eff6ff)',
          border: '1.5px solid #99e6da', borderRadius: 'var(--radius)',
          padding: '20px 24px', marginBottom: 20, position: 'relative',
        }}>
          <button onClick={() => setNewCreds(null)} style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 16 }}>✕</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#0ab8a0,#2563eb)', display: 'grid', placeItems: 'center', color: 'white', fontSize: 16 }}>✓</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#08a090' }}>Student Created Successfully</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Share these credentials with <strong>{newCreds.name}</strong></div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[{ label: 'Username', value: newCreds.username }, { label: 'Password', value: newCreds.password }].map(({ label, value }) => (
              <div key={label} style={{ background: 'white', borderRadius: 'var(--radius-sm)', padding: '10px 14px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                </div>
                <button onClick={() => copyText(value)} style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--text-3)' }}>Copy</button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-4)' }}>⚠ No email configured — share these credentials directly with the student.</div>
        </div>
      )}

      {/* Form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>
          {editId ? '✏ Edit Student' : '+ Add New Student'}
        </div>
        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <Field label="Full Name *" error={errors.full_name}>
              <input
                value={form.full_name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="e.g. Nadun Wijathunga"
                style={inputStyle('full_name')}
              />
            </Field>

            <Field label="Email Address *" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={e => {
                  setForm(f => ({ ...f, email: e.target.value }));
                  if (errors.email) setErrors(er => ({ ...er, email: '' }));
                }}
                placeholder="e.g. nadun@gmail.com"
                style={inputStyle('email')}
              />
            </Field>

            <Field label="Phone Number" error={errors.phone} hint={phoneHint}>
              <input
                value={form.phone}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="07XXXXXXXX"
                maxLength={10}
                style={inputStyle('phone')}
              />
            </Field>

            <Field label="Gender">
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">Select gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </Field>

            <Field label="Address" span={2}>
              <input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Home address"
              />
            </Field>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              🔑 Login Credentials
            </div>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Username *" error={errors.username}>
                <input
                  value={form.username}
                  onChange={e => {
                    setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }));
                    if (errors.username) setErrors(er => ({ ...er, username: '' }));
                  }}
                  placeholder="e.g. nadun.wijathunga"
                  style={inputStyle('username')}
                />
              </Field>

              <Field label={editId ? 'New Password (leave blank to keep)' : 'Password *'} error={errors.password}>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => {
                      setForm(f => ({ ...f, password: e.target.value }));
                      if (errors.password) setErrors(er => ({ ...er, password: '' }));
                    }}
                    placeholder={editId ? 'Leave blank to keep current' : 'Min 6 characters'}
                    style={{ ...inputStyle('password'), paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 14,
                  }}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
              </Field>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
              Username is auto-generated from the name — you can edit it. Student will use these to log in.
            </div>
          </div>

          <div className="btn-group">
            <button className="btn btn-primary" type="submit">{editId ? 'Update Student' : 'Create Student'}</button>
            {editId && (
              <button className="btn btn-secondary" type="button" onClick={() => { setForm(blank); setEditId(null); setErrors({}); }}>Cancel</button>
            )}
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          All Students <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-4)' }}>({students.length})</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>#</th><th>Name</th><th>Username</th><th>Email</th><th>Phone</th><th>Gender</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {students.length === 0 && <tr><td colSpan={7}><div className="empty">No students yet.</div></td></tr>}
              {students.map((s, i) => (
                <tr key={s.student_id}>
                  <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>{s.full_name}</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                      {s.username || '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-3)' }}>{s.email}</td>
                  <td style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{s.phone || '—'}</td>
                  <td>
                    {s.gender
                      ? <span className={`badge ${s.gender === 'Male' ? 'badge-blue' : s.gender === 'Female' ? 'badge-indigo' : 'badge-teal'}`}>{s.gender}</span>
                      : <span style={{ color: 'var(--text-5)' }}>—</span>}
                  </td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-secondary btn-sm" onClick={() => edit(s)}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(s.student_id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}