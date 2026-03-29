import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

// ── Status helpers ────────────────────────────────────────────
const badgeFor  = (s) => s === 'resolved' ? 'badge-green' : s === 'in-progress' ? 'badge-blue' : 'badge-amber';
const labelFor  = (s) => s === 'in-progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);

// ── STUDENT VIEW ──────────────────────────────────────────────
function StudentComplaints({ user }) {
  const [complaints, setComplaints] = useState([]);
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };

  const load = () => {
    // fetch all then filter by this student's id
    axios.get(`${API}/complaints`)
      .then(r => setComplaints(r.data.filter(c => c.student_id === user.student_id)));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return flash('Please describe your complaint', 'error');
    if (!user.student_id)    return flash('Could not identify your student account', 'error');
    setLoading(true);
    try {
      await axios.post(`${API}/complaints`, { student_id: user.student_id, description });
      flash('Complaint submitted successfully!');
      setDescription('');
      load();
    } catch { flash('Failed to submit complaint', 'error'); }
    finally { setLoading(false); }
  };

  const pending    = complaints.filter(c => c.status === 'pending').length;
  const inProgress = complaints.filter(c => c.status === 'in-progress').length;
  const resolved   = complaints.filter(c => c.status === 'resolved').length;

  return (
    <div>
      <div className="page-header">
        <h1>My Complaints</h1>
        <p>Submit and track your hostel complaints</p>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Summary */}
      {complaints.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Pending',     val: pending,    color: 'var(--amber)', bg: 'var(--amber-lt)', bd: 'rgba(245,158,11,0.2)' },
            { label: 'In Progress', val: inProgress, color: 'var(--sky)',   bg: 'var(--sky-lt)',   bd: 'rgba(14,165,233,0.2)' },
            { label: 'Resolved',    val: resolved,   color: 'var(--green)', bg: 'var(--green-lt)', bd: 'rgba(16,185,129,0.2)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 'var(--radius)', padding: '14px 18px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Submit form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>+ Submit New Complaint</div>
        <form onSubmit={submit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Describe Your Complaint *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue clearly (e.g. broken tap in room A101, noise from room B202...)"
              style={{ minHeight: 100 }}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Complaint'}
          </button>
        </form>
      </div>

      {/* My complaints list */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          My Complaints
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-4)' }}>({complaints.length})</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Description</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {complaints.length === 0 && (
                <tr><td colSpan={4}><div className="empty">No complaints submitted yet.</div></td></tr>
              )}
              {complaints.map((c, i) => (
                <tr key={c.complaint_id}>
                  <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ maxWidth: 400, color: 'var(--text-2)' }}>{c.description}</td>
                  <td><span className={`badge ${badgeFor(c.status)}`}>{labelFor(c.status)}</span></td>
                  <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{c.created_at?.split('T')[0] || c.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN / STAFF VIEW ────────────────────────────────────────
function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [students, setStudents]     = useState([]);
  const [form, setForm]             = useState({ student_id: '', description: '' });
  const [msg, setMsg]               = useState({ text: '', type: '' });

  const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 3000); };
  const load  = () => axios.get(`${API}/complaints`).then(r => setComplaints(r.data));

  useEffect(() => {
    load();
    axios.get(`${API}/students`).then(r => setStudents(r.data));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.student_id || !form.description.trim()) return flash('Student and description required', 'error');
    await axios.post(`${API}/complaints`, form);
    flash('Complaint added');
    setForm({ student_id: '', description: '' });
    load();
  };

  const del = async (id) => {
    if (!window.confirm('Delete this complaint?')) return;
    await axios.delete(`${API}/complaints/${id}`);
    flash('Deleted'); load();
  };

  const cycleStatus = async (c) => {
    const next = c.status === 'pending' ? 'in-progress' : c.status === 'in-progress' ? 'resolved' : 'pending';
    await axios.put(`${API}/complaints/${c.complaint_id}`, { status: next });
    load();
  };

  const pending    = complaints.filter(c => c.status === 'pending').length;
  const inProgress = complaints.filter(c => c.status === 'in-progress').length;
  const resolved   = complaints.filter(c => c.status === 'resolved').length;

  return (
    <div>
      <div className="page-header">
        <h1>Complaints</h1>
        <p>Manage all student complaints</p>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Pending',     val: pending,    color: 'var(--amber)', bg: 'var(--amber-lt)', bd: 'rgba(245,158,11,0.2)' },
          { label: 'In Progress', val: inProgress, color: 'var(--sky)',   bg: 'var(--sky-lt)',   bd: 'rgba(14,165,233,0.2)' },
          { label: 'Resolved',    val: resolved,   color: 'var(--green)', bg: 'var(--green-lt)', bd: 'rgba(16,185,129,0.2)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 'var(--radius)', padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
            <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Add complaint form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>+ Add Complaint on Behalf of Student</div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Student *</label>
              <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} required>
                <option value="">Select student</option>
                {students.map(s => <option key={s.student_id} value={s.student_id}>{s.full_name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Description *</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the complaint..." required />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">Add Complaint</button>
        </form>
      </div>

      {/* All complaints table */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          All Complaints
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-4)' }}>({complaints.length})</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Student</th><th>Description</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {complaints.length === 0 && <tr><td colSpan={5}><div className="empty">No complaints yet.</div></td></tr>}
              {complaints.map(c => (
                <tr key={c.complaint_id}>
                  <td style={{ color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.full_name}</td>
                  <td style={{ maxWidth: 360, color: 'var(--text-2)' }}>{c.description}</td>
                  <td><span className={`badge ${badgeFor(c.status)}`}>{labelFor(c.status)}</span></td>
                  <td style={{ color: 'var(--text-4)', fontSize: 12, whiteSpace: 'nowrap' }}>{c.created_at?.split('T')[0] || c.created_at}</td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-secondary btn-sm" onClick={() => cycleStatus(c)}>Next Status</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(c.complaint_id)}>Delete</button>
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

// ── ROUTER ────────────────────────────────────────────────────
export default function Complaints({ user }) {
  if (!user) {
    try { user = JSON.parse(localStorage.getItem('hms_user')) || {}; } catch { user = {}; }
  }
  if (user.role === 'student') return <StudentComplaints user={user} />;
  return <AdminComplaints />;
}