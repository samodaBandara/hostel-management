import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

const STATUS_BADGE = {
  pending:  'badge-amber',
  approved: 'badge-green',
  rejected: 'badge-red',
};

const CATEGORY_INFO = {
  noise:       { label: 'Noise Issues',         icon: '🔊', color: '#f59e0b' },
  cleanliness: { label: 'Cleanliness Issues',   icon: '🧹', color: '#10b981' },
  medical:     { label: 'Medical / Privacy',    icon: '🏥', color: '#ef4444' },
  habits:      { label: 'Incompatible Habits',  icon: '⚡', color: '#6366f1' },
  distance:    { label: 'Location / Distance',  icon: '📍', color: '#3b82f6' },
  other:       { label: 'General Transfer',     icon: '🔄', color: '#64748b' },
};

// ── STUDENT VIEW ──────────────────────────────────────────────
function StudentTransfers({ user }) {
  const [requests, setRequests]   = useState([]);
  const [reason, setReason]       = useState('');
  const [msg, setMsg]             = useState({ text: '', type: '' });
  const [loading, setLoading]     = useState(false);
  const [currentRoom, setCurrentRoom] = useState(null);

  const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };

  const load = () => {
    axios.get(`${API}/transfers/student/${user.student_id}`).then(r => setRequests(r.data));
    axios.get(`${API}/allocations`).then(r => {
      const mine = r.data.find(a => a.student_id === user.student_id);
      setCurrentRoom(mine || null);
    });
  };

  useEffect(() => { load(); }, []);

  const hasPending = requests.some(r => r.status === 'pending');

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 20) return flash('Please provide a detailed reason (at least 20 characters)', 'error');
    if (!currentRoom) return flash('You do not have a current room allocation', 'error');
    setLoading(true);
    try {
      await axios.post(`${API}/transfers`, { student_id: user.student_id, reason, initiated_by: 'student' });
      flash('Transfer request submitted! Admin will review it shortly.');
      setReason('');
      load();
    } catch (err) { flash(err.response?.data?.error || 'Failed to submit', 'error'); }
    finally { setLoading(false); }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this transfer request?')) return;
    await axios.delete(`${API}/transfers/${id}`);
    flash('Request cancelled');
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Room Transfer</h1>
        <p>Request a room change and track your transfer history</p>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Current room */}
      {currentRoom ? (
        <div style={{ background: 'linear-gradient(135deg,#f0fdfb,#eff6ff)', border: '1px solid #99e6da', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 28 }}>🏠</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Current Room</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>{currentRoom.room_number}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1, textTransform: 'capitalize' }}>{currentRoom.room_type} · Since {currentRoom.allocation_date}</div>
          </div>
        </div>
      ) : (
        <div style={{ background: 'var(--amber-lt)', border: '1px solid var(--amber-bd)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 20, fontSize: 13, color: 'var(--amber)' }}>
          ⚠ You don't have a room allocation yet. Contact admin.
        </div>
      )}

      {/* Submit form */}
      {currentRoom && !hasPending && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Request Room Transfer</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
            Describe your reason clearly — our AI will analyze it and suggest the most suitable alternative room.
          </div>
          <form onSubmit={submit}>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Reason for Transfer *</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. My roommate plays loud music late at night and I cannot sleep or study properly..."
                style={{ minHeight: 110 }}
              />
              <div style={{ fontSize: 11, color: reason.length >= 20 ? 'var(--green)' : 'var(--text-4)', marginTop: 4 }}>
                {reason.length < 20 ? `${20 - reason.length} more characters needed` : `✓ Good description (${reason.length} characters)`}
              </div>
            </div>
            <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 14, fontSize: 12, color: 'var(--text-3)', border: '1px solid var(--border)' }}>
              💡 <strong>Tip:</strong> The more specific you are, the better the AI room suggestion. Mention issues like noise, cleanliness, sleep schedules, or medical needs.
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading || reason.trim().length < 20}>
              {loading ? 'Submitting...' : 'Submit Transfer Request'}
            </button>
          </form>
        </div>
      )}

      {hasPending && (
        <div style={{ background: 'var(--amber-lt)', border: '1px solid var(--amber-bd)', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 20, fontSize: 13, color: '#92400e', fontWeight: 500 }}>
          📋 You have a pending transfer request. You can only have one active request at a time.
        </div>
      )}

      {/* Transfer requests */}
      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
          My Transfer Requests
          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-4)' }}>({requests.length})</span>
        </div>

        {requests.length === 0 ? (
          <div className="empty">No transfer requests yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map(r => {
              const cat = CATEGORY_INFO[r.reason_category] || CATEGORY_INFO.other;
              return (
                <div key={r.transfer_id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', background: 'var(--bg-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{cat.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{cat.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{r.requested_at?.split('T')[0]}</div>
                      </div>
                    </div>
                    <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.6, background: 'white', borderRadius: 6, padding: '8px 12px', border: '1px solid var(--border)' }}>
                    "{r.reason}"
                  </div>

                  <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                    <div>
                      <span style={{ color: 'var(--text-4)' }}>From: </span>
                      <span style={{ fontWeight: 600, color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>{r.from_room_number}</span>
                    </div>
                    {r.to_room_number && (
                      <div>
                        <span style={{ color: 'var(--text-4)' }}>To: </span>
                        <span style={{ fontWeight: 600, color: '#10b981', fontFamily: 'var(--font-mono)' }}>{r.to_room_number}</span>
                      </div>
                    )}
                    {r.suggested_room_number && r.status === 'pending' && (
                      <div>
                        <span style={{ color: 'var(--text-4)' }}>AI Suggested: </span>
                        <span style={{ fontWeight: 600, color: '#6366f1', fontFamily: 'var(--font-mono)' }}>{r.suggested_room_number}</span>
                      </div>
                    )}
                  </div>

                  {r.admin_note && (
                    <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic', background: 'white', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      Admin note: "{r.admin_note}"
                    </div>
                  )}

                  {r.status === 'pending' && (
                    <div style={{ marginTop: 12 }}>
                      <button className="btn btn-danger btn-sm" onClick={() => cancel(r.transfer_id)}>Cancel Request</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ADMIN VIEW ────────────────────────────────────────────────
function AdminTransfers() {
  const [requests, setRequests]   = useState([]);
  const [history, setHistory]     = useState([]);
  const [students, setStudents]   = useState([]);
  const [rooms, setRooms]         = useState([]);
  const [tab, setTab]             = useState('pending'); // pending | all | history | new
  const [selected, setSelected]   = useState(null);
  const [aiSuggest, setAiSuggest] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [toRoomId, setToRoomId]   = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [msg, setMsg]             = useState({ text: '', type: '' });
  const [newForm, setNewForm]     = useState({ student_id: '', reason: '' });

  const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 3000); };

  const load = () => {
    axios.get(`${API}/transfers`).then(r => setRequests(r.data));
    axios.get(`${API}/transfers/history`).then(r => setHistory(r.data));
    axios.get(`${API}/students`).then(r => setStudents(r.data));
    axios.get(`${API}/rooms`).then(r => setRooms(r.data));
  };

  useEffect(() => { load(); }, []);

  const openReview = async (req) => {
    setSelected(req);
    setToRoomId(req.suggested_room_id?.toString() || '');
    setAdminNote('');
    setAiSuggest(null);
    setAiLoading(true);
    try {
      const res = await axios.post(`${API}/transfers/suggest`, {
        student_id: req.student_id,
        reason: req.reason,
      });
      setAiSuggest(res.data);
      if (res.data.recommended_room_id) setToRoomId(res.data.recommended_room_id.toString());
    } catch { setAiSuggest({ error: true }); }
    finally { setAiLoading(false); }
  };

  const approve = async () => {
    if (!toRoomId) return flash('Please select a target room', 'error');
    try {
      await axios.put(`${API}/transfers/${selected.transfer_id}/approve`, { to_room_id: parseInt(toRoomId), admin_note: adminNote });
      flash('Transfer approved successfully!');
      setSelected(null); load();
    } catch (err) { flash(err.response?.data?.error || 'Failed', 'error'); }
  };

  const reject = async () => {
    try {
      await axios.put(`${API}/transfers/${selected.transfer_id}/reject`, { admin_note: adminNote });
      flash('Transfer rejected');
      setSelected(null); load();
    } catch { flash('Failed', 'error'); }
  };

  const submitNew = async (e) => {
    e.preventDefault();
    if (!newForm.student_id || !newForm.reason.trim()) return flash('Student and reason required', 'error');
    try {
      await axios.post(`${API}/transfers`, { ...newForm, initiated_by: 'admin' });
      flash('Transfer request created');
      setNewForm({ student_id: '', reason: '' });
      setTab('pending');
      load();
    } catch (err) { flash(err.response?.data?.error || 'Failed', 'error'); }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const all     = requests;

  const availableRooms = rooms.filter(r => {
    if (r.status === 'maintenance') return false;
    const filled = requests.filter(req => req.to_room_id === r.room_id && req.status === 'approved').length;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h1>Transfer Requests</h1>
        <p>Manage room transfer requests with AI-assisted room suggestions</p>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Stats row */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Pending',  val: pending.length,                                color: 'var(--amber)' },
          { label: 'Approved', val: requests.filter(r=>r.status==='approved').length, color: 'var(--green)' },
          { label: 'Rejected', val: requests.filter(r=>r.status==='rejected').length, color: 'var(--red)' },
          { label: 'Total Transfers', val: history.length, color: 'var(--teal)' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: s.color, borderRadius: 'var(--radius) var(--radius) 0 0' }} />
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', width: 'fit-content' }}>
        {[['pending','⏳ Pending'],['all','📋 All Requests'],['history','🕒 History'],['new','+ New Request']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t ? 'var(--teal)' : 'white',
            color: tab === t ? 'white' : 'var(--text-3)',
            borderRight: '1px solid var(--border)',
            fontFamily: 'var(--font-ui)', transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        <div>
          {pending.length === 0 ? (
            <div className="card"><div className="empty">No pending transfer requests.</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 14 }}>
              {pending.map(r => {
                const cat = CATEGORY_INFO[r.reason_category] || CATEGORY_INFO.other;
                return (
                  <div key={r.transfer_id} className="card" style={{ cursor: 'pointer', border: `1px solid ${cat.color}30` }} onClick={() => openReview(r)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${cat.color}15`, display: 'grid', placeItems: 'center', fontSize: 18 }}>{cat.icon}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.student_name}</div>
                          <div style={{ fontSize: 11, color: cat.color, fontWeight: 600 }}>{cat.label}</div>
                        </div>
                      </div>
                      <span className="badge badge-amber">Pending</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.5 }}>
                      {r.reason.length > 80 ? r.reason.slice(0, 80) + '...' : r.reason}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-4)' }}>From: <strong style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>{r.from_room_number}</strong></span>
                      <span style={{ color: 'var(--text-4)' }}>{r.requested_at?.split('T')[0]}</span>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--teal)', fontWeight: 600 }}>Click to review with AI suggestion →</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* All requests tab */}
      {tab === 'all' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Student</th><th>Category</th><th>From</th><th>To</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>
                {all.length === 0 && <tr><td colSpan={7}><div className="empty">No requests yet.</div></td></tr>}
                {all.map(r => {
                  const cat = CATEGORY_INFO[r.reason_category] || CATEGORY_INFO.other;
                  return (
                    <tr key={r.transfer_id}>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{r.student_name}</td>
                      <td><span style={{ fontSize: 12 }}>{cat.icon} {cat.label}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)', fontWeight: 600 }}>{r.from_room_number}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#10b981', fontWeight: 600 }}>{r.to_room_number || '—'}</td>
                      <td><span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status}</span></td>
                      <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{r.requested_at?.split('T')[0]}</td>
                      <td>{r.status === 'pending' && <button className="btn btn-secondary btn-sm" onClick={() => openReview(r)}>Review</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Transfer History ({history.length})</div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Student</th><th>Category</th><th>From</th><th>To</th><th>Date</th><th>Admin Note</th></tr></thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={6}><div className="empty">No completed transfers yet.</div></td></tr>}
                {history.map(h => {
                  const cat = CATEGORY_INFO[h.reason_category] || CATEGORY_INFO.other;
                  return (
                    <tr key={h.history_id}>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>{h.student_name}</td>
                      <td><span style={{ fontSize: 12 }}>{cat.icon} {cat.label}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#ef4444', fontWeight: 600 }}>{h.from_room_number}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#10b981', fontWeight: 600 }}>{h.to_room_number}</td>
                      <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{h.transferred_at?.split('T')[0]}</td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{h.admin_note || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New request tab (admin-initiated) */}
      {tab === 'new' && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Create Transfer Request on Behalf of Student</div>
          <form onSubmit={submitNew}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
              <div className="form-group">
                <label>Student *</label>
                <select value={newForm.student_id} onChange={e => setNewForm(f => ({ ...f, student_id: e.target.value }))} required>
                  <option value="">Select student</option>
                  {students.map(s => <option key={s.student_id} value={s.student_id}>{s.full_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Reason *</label>
                <textarea
                  value={newForm.reason}
                  onChange={e => setNewForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Describe the reason for transfer..."
                  style={{ minHeight: 90 }}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">Create Request</button>
          </form>
        </div>
      )}

      {/* ── Review Modal ── */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Review Transfer Request</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 18 }}>✕</button>
            </div>

            {/* Student + reason */}
            <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{selected.student_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>From: <strong style={{ color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>{selected.from_room_number}</strong></div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, fontStyle: 'italic' }}>"{selected.reason}"</div>
            </div>

            {/* AI suggestion */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ background: 'linear-gradient(135deg,#1a2332,#1e3a5f)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🤖</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>AI Transfer Suggestion</span>
                {aiLoading && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>Analysing reason...</span>}
              </div>
              <div style={{ padding: '14px', background: '#f8fafc' }}>
                {aiLoading ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', opacity: 0.6, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                    <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>Classifying reason and finding best match...</span>
                  </div>
                ) : aiSuggest && !aiSuggest.error ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 14 }}>{CATEGORY_INFO[aiSuggest.category]?.icon || '🔄'}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>Detected: {aiSuggest.category_label}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>
                      → {aiSuggest.recommended_room} ({aiSuggest.room_type}) — {aiSuggest.compatibility_score}% compatibility
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10, lineHeight: 1.5 }}>{aiSuggest.reason}</div>
                    {aiSuggest.all_scores?.length > 1 && (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top alternatives</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {aiSuggest.all_scores.map(s => (
                            <button key={s.room} onClick={() => setToRoomId(s.room_id?.toString())} style={{
                              padding: '4px 10px', borderRadius: 6, border: `1px solid ${toRoomId === s.room_id?.toString() ? 'var(--teal)' : 'var(--border)'}`,
                              background: toRoomId === s.room_id?.toString() ? 'var(--teal)' : 'white',
                              color: toRoomId === s.room_id?.toString() ? 'white' : 'var(--text-2)',
                              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                            }}>
                              {s.room} ({s.score}%)
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Could not generate suggestion.</div>
                )}
              </div>
            </div>

            {/* Room selector */}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Transfer to Room *</label>
              <select value={toRoomId} onChange={e => setToRoomId(e.target.value)}>
                <option value="">Select room</option>
                {availableRooms.map(r => <option key={r.room_id} value={r.room_id}>{r.room_number} — {r.room_type} (Floor {r.floor})</option>)}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Admin Note (optional)</label>
              <textarea value={adminNote} onChange={e => setAdminNote(e.target.value)} placeholder="Add a note for the student..." style={{ minHeight: 60 }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={approve}>✓ Approve Transfer</button>
              <button className="btn btn-danger"  style={{ flex: 1, justifyContent: 'center' }} onClick={reject}>✕ Reject</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── ROUTER ────────────────────────────────────────────────────
export default function TransferRequests({ user }) {
  if (!user) {
    try { user = JSON.parse(localStorage.getItem('hms_user')) || {}; } catch { user = {}; }
  }
  if (user.role === 'student') return <StudentTransfers user={user} />;
  return <AdminTransfers />;
}