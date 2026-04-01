import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

const PURPOSES = [
  { value: 'visiting',    label: '👋 Personal Visit',   color: '#0ab8a0' },
  { value: 'delivery',    label: '📦 Delivery',          color: '#f59e0b' },
  { value: 'maintenance', label: '🔧 Maintenance',       color: '#6366f1' },
  { value: 'official',    label: '📋 Official / Admin',  color: '#3b82f6' },
  { value: 'other',       label: '🔄 Other',             color: '#64748b' },
];

const purposeInfo = (val) => PURPOSES.find(p => p.value === val) || PURPOSES[4];

const parseUTC = (ts) => { if (!ts) return null; return new Date(ts.endsWith('Z') ? ts : ts + 'Z'); };
const fmtTime = (ts) => { const d = parseUTC(ts); return d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'; };
const fmtDate = (ts) => { const d = parseUTC(ts); return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; };
const fmtDuration = (inTime, outTime) => {
  if (!inTime || !outTime) return null;
  const diff = Math.round((parseUTC(outTime) - parseUTC(inTime)) / 60000);
  if (diff < 60) return `${diff}m`;
  return `${Math.floor(diff/60)}h ${diff%60}m`;
};

const blankForm = { visitor_name: '', visitor_phone: '', purpose: '', student_id: '', notes: '' };

// ── SIGN IN MODAL ─────────────────────────────────────────────
function SignInModal({ students, onSubmit, onClose, loading }) {
  const [form, setForm]     = useState(blankForm);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.username?.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  const selectStudent = (s) => {
    setForm(f => ({ ...f, student_id: s.student_id }));
    setSearch(s.full_name);
    setShowList(false);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.visitor_name.trim()) return;
    if (!form.purpose)             return;
    if (!form.student_id)          return;
    onSubmit(form);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>🏠 Visitor Sign In</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', fontSize: 18 }}>✕</button>
        </div>

        <form onSubmit={submit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Student search */}
            <div className="form-group">
              <label>Who are you visiting? *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowList(true); setForm(f => ({ ...f, student_id: '' })); }}
                  onFocus={() => setShowList(true)}
                  placeholder="Type student name..."
                  autoComplete="off"
                />
                {showList && search && filtered.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden', marginTop: 4 }}>
                    {filtered.map(s => {
                      const gender = s.gender?.toLowerCase();
                      return (
                        <div key={s.student_id} onClick={() => selectStudent(s)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--bg-3)', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background='var(--bg-3)'}
                          onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: gender==='female'?'#fdf2f8':'#eff6ff', display: 'grid', placeItems: 'center', fontSize: 14, border: `1px solid ${gender==='female'?'#f9a8d4':'#93c5fd'}` }}>
                            {gender==='female'?'♀':'♂'}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.full_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{s.room_number ? `Room ${s.room_number}` : 'No room allocated'}</div>
                          </div>
                          {form.student_id === s.student_id && <span style={{ marginLeft: 'auto', color: 'var(--teal)', fontWeight: 700 }}>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {form.student_id && (
                <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 4, fontWeight: 600 }}>✓ Student selected</div>
              )}
            </div>

            {/* Visitor name */}
            <div className="form-group">
              <label>Visitor Full Name *</label>
              <input type="text" value={form.visitor_name} onChange={e => setForm(f => ({ ...f, visitor_name: e.target.value }))} placeholder="e.g. Kasun Perera" required />
            </div>

            {/* Phone */}
            <div className="form-group">
              <label>Visitor Phone <span style={{ fontWeight: 400, color: 'var(--text-4)', fontSize: 11 }}>(optional)</span></label>
              <input type="tel" value={form.visitor_phone} onChange={e => setForm(f => ({ ...f, visitor_phone: e.target.value }))} placeholder="07XXXXXXXX" />
            </div>

            {/* Purpose */}
            <div className="form-group">
              <label>Purpose of Visit *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PURPOSES.map(p => (
                  <button type="button" key={p.value} onClick={() => setForm(f => ({ ...f, purpose: p.value }))} style={{
                    padding: '9px 12px', borderRadius: 8, textAlign: 'left', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${form.purpose === p.value ? p.color : 'var(--border)'}`,
                    background: form.purpose === p.value ? `${p.color}15` : 'var(--bg-3)',
                    color: form.purpose === p.value ? p.color : 'var(--text-3)',
                    fontFamily: 'var(--font-ui)', transition: 'all 0.15s',
                  }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label>Notes <span style={{ fontWeight: 400, color: 'var(--text-4)', fontSize: 11 }}>(optional)</span></label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional info..." style={{ minHeight: 60 }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-primary" type="submit" disabled={loading || !form.student_id || !form.purpose || !form.visitor_name.trim()} style={{ flex: 1, justifyContent: 'center' }}>
              {loading ? 'Signing in...' : '✓ Sign In Visitor'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={onClose} style={{ flex: 0.4, justifyContent: 'center' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function VisitorLog({ user }) {
  if (!user) { try { user = JSON.parse(localStorage.getItem('hms_user'))||{}; } catch { user={}; } }

  const [visitors, setVisitors]   = useState([]);
  const [live, setLive]           = useState([]);
  const [students, setStudents]   = useState([]);
  const [stats, setStats]         = useState(null);
  const [tab, setTab]             = useState('live');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState({ text: '', type: '' });
  const [filterPurpose, setFilterPurpose] = useState('all');

  const isStudent = user.role === 'student';
  const flash = (text, type='success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text:'', type:'' }), 3000); };

  const load = () => {
    if (isStudent) {
      axios.get(`${API}/visitors/student/${user.student_id}`).then(r => setVisitors(r.data));
    } else {
      axios.get(`${API}/visitors/live`).then(r => setLive(r.data));
      axios.get(`${API}/visitors`).then(r => setVisitors(r.data));
      axios.get(`${API}/visitors/stats`).then(r => setStats(r.data));
      axios.get(`${API}/students`).then(r => {
        // also fetch allocations to get room numbers
        axios.get(`${API}/allocations`).then(a => {
          const allocMap = {};
          a.data.forEach(al => { allocMap[al.student_id] = al.room_number; });
          setStudents(r.data.map(s => ({ ...s, room_number: allocMap[s.student_id] || null })));
        });
      });
    }
  };

  useEffect(() => { load(); }, []);

  const signIn = async (form) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/visitors`, { ...form, recorded_by: user.username });
      flash(res.data.message);
      setShowModal(false);
      load();
    } catch (err) { flash(err.response?.data?.error || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  const checkout = async (visitor_id, name) => {
    try {
      await axios.put(`${API}/visitors/${visitor_id}/checkout`);
      flash(`${name} checked out`);
      load();
    } catch (err) { flash(err.response?.data?.error || 'Failed', 'error'); }
  };

  const del = async (visitor_id) => {
    if (!window.confirm('Delete this record?')) return;
    await axios.delete(`${API}/visitors/${visitor_id}`);
    flash('Record deleted');
    load();
  };

  const allFiltered = filterPurpose === 'all' ? visitors : visitors.filter(v => v.purpose === filterPurpose);

  // ── STUDENT VIEW ──────────────────────────────────────────
  if (isStudent) {
    const insideNow = visitors.filter(v => v.status === 'inside');
    return (
      <div>
        <div className="page-header"><h1>My Visitors</h1><p>See who has visited you</p></div>
        {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

        {insideNow.length > 0 && (
          <div style={{ background: 'linear-gradient(135deg,#f0fdfb,#eff6ff)', border: '1.5px solid #99e6da', borderRadius: 'var(--radius)', padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>👋</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal)' }}>You have {insideNow.length} visitor{insideNow.length>1?'s':''} inside right now</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{insideNow.map(v => v.visitor_name).join(', ')}</div>
            </div>
          </div>
        )}

        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            Visit History
            <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--text-4)' }}>({visitors.length} total)</span>
          </div>
          {visitors.length === 0 ? <div className="empty">No visitors yet.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visitors.map(v => {
                const p   = purposeInfo(v.purpose);
                const dur = fmtDuration(v.check_in_time, v.check_out_time);
                return (
                  <div key={v.visitor_id} style={{ border: `1px solid ${v.status==='inside'?'#99e6da':'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '14px 16px', background: v.status==='inside'?'linear-gradient(135deg,#f0fdfb,white)':'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: `${p.color}15`, display: 'grid', placeItems: 'center', fontSize: 18, border: `1px solid ${p.color}30` }}>{p.label.split(' ')[0]}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{v.visitor_name}</div>
                          <div style={{ fontSize: 11, color: p.color, fontWeight: 600 }}>{p.label.slice(2)}</div>
                          {v.visitor_phone && <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{v.visitor_phone}</div>}
                        </div>
                      </div>
                      <span className={`badge ${v.status==='inside'?'badge-green':'badge-blue'}`}>
                        {v.status==='inside'?'Inside':'Left'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-4)', marginTop: 10 }}>
                      <span>In: {fmtDate(v.check_in_time)} {fmtTime(v.check_in_time)}</span>
                      {v.check_out_time && <span>Out: {fmtTime(v.check_out_time)}</span>}
                      {dur && <span>Duration: {dur}</span>}
                    </div>
                    {v.notes && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic' }}>"{v.notes}"</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ADMIN / STAFF VIEW ────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><h1>Visitor Log</h1><p>Track all hostel visitors · Live presence · Full history</p></div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            + Sign In Visitor
          </button>
        </div>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
      {showModal && <SignInModal students={students} onSubmit={signIn} onClose={() => setShowModal(false)} loading={loading} />}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Currently Inside', val: stats.currently_inside, color: '#10b981', bg: '#ecfdf5', bd: '#6ee7b7', icon: '🏠' },
            { label: 'Visitors Today',   val: stats.today_total,      color: 'var(--teal)', bg: '#f0fdfb', bd: '#99e6da', icon: '👥' },
            { label: 'Checked Out',      val: stats.today_checked_out, color: '#6366f1', bg: '#eef2ff', bd: '#a5b4fc', icon: '✅' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 'var(--radius)', padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', width: 'fit-content' }}>
        {[['live',`🟢 Inside Now (${live.length})`],['all','📋 All Visitors']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab===t?'var(--teal)':'white', color: tab===t?'white':'var(--text-3)',
            borderRight: t==='live'?'1px solid var(--border)':'none',
            fontFamily: 'var(--font-ui)', transition: 'all 0.15s',
          }}>{l}</button>
        ))}
      </div>

      {/* Live tab */}
      {tab === 'live' && (
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Currently Inside</div>
          {live.length === 0 ? (
            <div className="empty" style={{ padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
              No visitors currently inside
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {live.map(v => {
                const p   = purposeInfo(v.purpose);
                const dur = fmtDuration(v.check_in_time, null);
                const now = new Date();
                // SQLite stores UTC — append Z so JS parses it as UTC not local time
                const inTimeStr = v.check_in_time?.endsWith('Z') ? v.check_in_time : v.check_in_time + 'Z';
                const inTime = new Date(inTimeStr);
                const mins = Math.round((now - inTime) / 60000);
                const timeInside = mins < 60 ? `${mins}m` : `${Math.floor(mins/60)}h ${mins%60}m`;
                return (
                  <div key={v.visitor_id} style={{ border: '1px solid #99e6da', borderRadius: 'var(--radius-sm)', padding: '16px 18px', background: 'linear-gradient(135deg,#f0fdfb,white)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${p.color}15`, display: 'grid', placeItems: 'center', fontSize: 20, border: `1.5px solid ${p.color}30`, flexShrink: 0 }}>{p.label.split(' ')[0]}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{v.visitor_name}</div>
                        <div style={{ fontSize: 12, color: p.color, fontWeight: 600 }}>{p.label.slice(2)}</div>
                        {v.visitor_phone && <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{v.visitor_phone}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Visiting</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{v.student_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--teal)', fontFamily: 'var(--font-mono)' }}>{v.room_number||'—'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Signed in</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{fmtTime(v.check_in_time)}</div>
                      <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>{timeInside} inside</div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => checkout(v.visitor_id, v.visitor_name)} style={{ flexShrink: 0 }}>
                      Sign Out
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* All visitors tab */}
      {tab === 'all' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              All Visitors
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-4)', marginLeft: 8 }}>({allFiltered.length})</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setFilterPurpose('all')} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${filterPurpose==='all'?'var(--teal)':'var(--border)'}`, background: filterPurpose==='all'?'var(--teal)':'white', color: filterPurpose==='all'?'white':'var(--text-3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>All</button>
              {PURPOSES.map(p => (
                <button key={p.value} onClick={() => setFilterPurpose(p.value)} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${filterPurpose===p.value?p.color:'var(--border)'}`, background: filterPurpose===p.value?`${p.color}15`:'white', color: filterPurpose===p.value?p.color:'var(--text-3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>{p.label}</button>
              ))}
            </div>
          </div>

          {allFiltered.length === 0 ? <div className="empty">No visitors found.</div> : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Visitor</th><th>Purpose</th><th>Visiting</th><th>Room</th><th>In</th><th>Out</th><th>Duration</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {allFiltered.map(v => {
                    const p   = purposeInfo(v.purpose);
                    const dur = fmtDuration(v.check_in_time, v.check_out_time);
                    return (
                      <tr key={v.visitor_id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{v.visitor_name}</div>
                          {v.visitor_phone && <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{v.visitor_phone}</div>}
                        </td>
                        <td><span style={{ fontSize: 12, color: p.color, fontWeight: 600 }}>{p.label}</span></td>
                        <td style={{ fontWeight: 600, color: 'var(--text)' }}>{v.student_name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal)', fontWeight: 600 }}>{v.room_number||'—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{fmtTime(v.check_in_time)}<br/><span style={{ fontSize: 10, color: 'var(--text-4)' }}>{fmtDate(v.check_in_time)}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{fmtTime(v.check_out_time) || <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                        <td style={{ fontSize: 12, color: dur?'var(--teal)':'var(--text-4)', fontWeight: dur?600:400 }}>{dur || (v.status==='inside'?<span style={{ color: '#f59e0b', fontWeight: 600 }}>Inside</span>:'—')}</td>
                        <td><span className={`badge ${v.status==='inside'?'badge-green':'badge-blue'}`}>{v.status==='inside'?'Inside':'Left'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {v.status === 'inside' && <button className="btn btn-secondary btn-sm" onClick={() => checkout(v.visitor_id, v.visitor_name)}>Sign Out</button>}
                            <button className="btn btn-danger btn-sm" onClick={() => del(v.visitor_id)}>Del</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}