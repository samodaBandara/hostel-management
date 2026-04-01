import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

const CATEGORY_INFO = {
  noise:        { label: 'Noise',        icon: '🔊', color: '#f59e0b', bg: '#fffbeb' },
  maintenance:  { label: 'Maintenance',  icon: '🔧', color: '#6366f1', bg: '#eef2ff' },
  cleanliness:  { label: 'Cleanliness',  icon: '🧹', color: '#10b981', bg: '#ecfdf5' },
  security:     { label: 'Security',     icon: '🔒', color: '#ef4444', bg: '#fef2f2' },
  roommate:     { label: 'Roommate',     icon: '👥', color: '#3b82f6', bg: '#eff6ff' },
  food:         { label: 'Food',         icon: '🍽', color: '#f97316', bg: '#fff7ed' },
  facilities:   { label: 'Facilities',   icon: '🏗', color: '#8b5cf6', bg: '#f5f3ff' },
  other:        { label: 'Other',        icon: '📋', color: '#64748b', bg: '#f8fafc' },
};

const PRIORITY_INFO = {
  low:    { label: 'Low',    color: '#10b981', bg: '#ecfdf5', bd: '#6ee7b7' },
  medium: { label: 'Medium', color: '#f59e0b', bg: '#fffbeb', bd: '#fcd34d' },
  high:   { label: 'High',   color: '#f97316', bg: '#fff7ed', bd: '#fdba74' },
  urgent: { label: 'Urgent', color: '#ef4444', bg: '#fef2f2', bd: '#fca5a5' },
};

const SENTIMENT_INFO = {
  calm:            { label: 'Calm',            icon: '😐', color: '#64748b' },
  frustrated:      { label: 'Frustrated',      icon: '😤', color: '#f59e0b' },
  very_distressed: { label: 'Very Distressed', icon: '😢', color: '#ef4444' },
};

const STATUS_COLORS = {
  pending:       { badge: 'badge-amber', label: 'Pending' },
  'in-progress': { badge: 'badge-blue',  label: 'In Progress' },
  resolved:      { badge: 'badge-green', label: 'Resolved' },
};

// ── STUDENT VIEW ──────────────────────────────────────────────
function StudentComplaints({ user }) {
  const [complaints, setComplaints]     = useState([]);
  const [description, setDescription]   = useState('');
  const [loading, setLoading]           = useState(false);
  const [msg, setMsg]                   = useState({ text: '', type: '' });
  const [lastAnalysis, setLastAnalysis] = useState(null);

  const flash = (text, type='success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text:'', type:'' }), 4000); };
  const load  = () => axios.get(`${API}/complaints`).then(r => setComplaints(r.data.filter(c => c.student_id === user.student_id)));

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (description.trim().length < 20) return flash('Please describe your complaint in more detail (at least 20 characters)', 'error');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/complaints`, { student_id: user.student_id, description });
      flash('Complaint submitted! AI has analysed it.');
      setLastAnalysis(res.data.analysis);
      setDescription('');
      load();
    } catch (err) { flash(err.response?.data?.error || 'Failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="page-header"><h1>Complaints</h1><p>Submit and track your hostel complaints · AI-powered analysis</p></div>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Submit a Complaint</div>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 16 }}>
          Our AI will automatically categorize your complaint, score its priority and detect urgency.
        </div>
        <form onSubmit={submit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Describe your complaint *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. My roommate plays loud music every night after midnight and I cannot sleep or study..."
              style={{ minHeight: 100 }} />
            <div style={{ fontSize: 11, color: description.length >= 20 ? 'var(--green)' : 'var(--text-4)', marginTop: 4 }}>
              {description.length < 20 ? `${20 - description.length} more characters needed` : '✓ Good description'}
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading || description.trim().length < 20}>
            {loading ? '🤖 Analysing & Submitting...' : 'Submit Complaint'}
          </button>
        </form>
      </div>

      {/* AI result */}
      {lastAnalysis && (
        <div style={{ background: 'linear-gradient(135deg,#f0fdfb,#eff6ff)', border: '1.5px solid #99e6da', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)', marginBottom: 12 }}>🤖 AI Analysis Result</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label:'Category', val: `${CATEGORY_INFO[lastAnalysis.category]?.icon||''} ${CATEGORY_INFO[lastAnalysis.category]?.label||lastAnalysis.category}`, color: CATEGORY_INFO[lastAnalysis.category]?.color, conf: lastAnalysis.category_conf },
              { label:'Priority', val: PRIORITY_INFO[lastAnalysis.priority]?.label||lastAnalysis.priority, color: PRIORITY_INFO[lastAnalysis.priority]?.color, conf: lastAnalysis.priority_conf },
              { label:'Sentiment', val: `${SENTIMENT_INFO[lastAnalysis.sentiment]?.icon||''} ${SENTIMENT_INFO[lastAnalysis.sentiment]?.label||lastAnalysis.sentiment}`, color: SENTIMENT_INFO[lastAnalysis.sentiment]?.color, conf: lastAnalysis.sentiment_conf },
            ].map(s => (
              <div key={s.label} style={{ background: 'white', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.val}</div>
                {s.conf !== undefined && s.conf !== null && <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2 }}>{s.conf}% confidence</div>}
              </div>
            ))}
          </div>
          {lastAnalysis.is_pattern && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d', fontSize: 12, color: '#92400e', fontWeight: 600 }}>
              ⚠ Pattern detected — {lastAnalysis.similar_count} similar complaint{lastAnalysis.similar_count>1?'s':''} from other students. Admin has been alerted.
            </div>
          )}
          <button onClick={() => setLastAnalysis(null)} style={{ marginTop: 10, background: 'none', border: 'none', fontSize: 11, color: 'var(--text-4)', cursor: 'pointer', textDecoration: 'underline' }}>Dismiss</button>
        </div>
      )}

      <div className="card">
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
          My Complaints <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-4)' }}>({complaints.length})</span>
        </div>
        {complaints.length === 0 ? <div className="empty">No complaints submitted yet.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {complaints.map(c => {
              const cat  = CATEGORY_INFO[c.category]  || CATEGORY_INFO.other;
              const pri  = PRIORITY_INFO[c.priority]   || PRIORITY_INFO.medium;
              const sen  = SENTIMENT_INFO[c.sentiment] || SENTIMENT_INFO.calm;
              const stat = STATUS_COLORS[c.status]     || STATUS_COLORS.pending;
              return (
                <div key={c.complaint_id} style={{ border: `1px solid ${pri.bd||'var(--border)'}`, borderRadius: 'var(--radius-sm)', padding: '14px 16px', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {c.category && <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:cat.bg, color:cat.color }}>{cat.icon} {cat.label}</span>}
                      {c.priority && <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:pri.bg, color:pri.color, border:`1px solid ${pri.bd}` }}>{pri.label}</span>}
                      {c.sentiment && <span style={{ fontSize:12, color:sen.color }}>{sen.icon} {sen.label}</span>}
                    </div>
                    <span className={`badge ${stat.badge}`}>{stat.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 6 }}>{c.description}</div>
                  {c.is_pattern === 1 && <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⚠ Similar to {c.similar_count} other complaint{c.similar_count>1?'s':''}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{c.created_at?.split('T')[0]}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ADMIN/STAFF VIEW ──────────────────────────────────────────
function AdminComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [msg, setMsg]               = useState({ text: '', type: '' });
  const [filterCat, setFilterCat]   = useState('all');
  const [filterPri, setFilterPri]   = useState('all');
  const [filterStat, setFilterStat] = useState('all');
  const [showPatterns, setShowPatterns] = useState(false);

  const flash = (text, type='success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text:'', type:'' }), 3000); };
  const load  = () => axios.get(`${API}/complaints`).then(r => setComplaints(r.data));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    await axios.put(`${API}/complaints/${id}`, { status });
    flash(`Status updated to ${status}`);
    load();
  };

  const reanalyze = async (id) => {
    try { await axios.post(`${API}/complaints/${id}/analyze`); flash('Re-analysed'); load(); }
    catch { flash('Re-analysis failed', 'error'); }
  };

  const del = async (id) => {
    if (!window.confirm('Delete?')) return;
    await axios.delete(`${API}/complaints/${id}`);
    flash('Deleted'); load();
  };

  const filtered = complaints.filter(c => {
    if (filterCat  !== 'all' && c.category !== filterCat)  return false;
    if (filterPri  !== 'all' && c.priority !== filterPri)  return false;
    if (filterStat !== 'all' && c.status   !== filterStat) return false;
    if (showPatterns && !c.is_pattern) return false;
    return true;
  });

  const urgent     = complaints.filter(c => c.priority === 'urgent' && c.status !== 'resolved').length;
  const patterns   = complaints.filter(c => c.is_pattern).length;
  const distressed = complaints.filter(c => c.sentiment === 'very_distressed' && c.status !== 'resolved').length;

  return (
    <div>
      <div className="page-header"><h1>Complaints</h1><p>AI-categorized · Priority scored · Sentiment detected · Pattern alerts</p></div>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Alert banners */}
      {urgent > 0 && (
        <div style={{ background:'#fef2f2', border:'1.5px solid #fca5a5', borderRadius:'var(--radius)', padding:'12px 18px', marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>🚨</span>
          <span style={{ fontSize:13, fontWeight:700, color:'#b91c1c' }}>{urgent} urgent complaint{urgent>1?'s':''} need immediate attention</span>
          <button onClick={() => { setFilterPri('urgent'); setFilterStat('all'); }} style={{ marginLeft:'auto', background:'#ef4444', color:'white', border:'none', borderRadius:6, padding:'4px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>View Urgent</button>
        </div>
      )}
      {patterns > 0 && (
        <div style={{ background:'#fffbeb', border:'1.5px solid #fcd34d', borderRadius:'var(--radius)', padding:'12px 18px', marginBottom:10, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>⚠</span>
          <span style={{ fontSize:13, fontWeight:700, color:'#92400e' }}>{patterns} pattern{patterns>1?'s':''} detected — multiple students reporting same issue</span>
          <button onClick={() => setShowPatterns(p => !p)} style={{ marginLeft:'auto', background:'#f59e0b', color:'white', border:'none', borderRadius:6, padding:'4px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>{showPatterns?'Show All':'Show Patterns'}</button>
        </div>
      )}
      {distressed > 0 && (
        <div style={{ background:'#eff6ff', border:'1.5px solid #93c5fd', borderRadius:'var(--radius)', padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>😢</span>
          <span style={{ fontSize:13, fontWeight:700, color:'#1e40af' }}>{distressed} student{distressed>1?'s are':' is'} very distressed — needs priority attention</span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total',    val: complaints.length,                                 color:'var(--text-2)' },
          { label:'Pending',  val: complaints.filter(c=>c.status==='pending').length, color:'#f59e0b' },
          { label:'Urgent',   val: urgent,                                             color:'#ef4444' },
          { label:'Patterns', val: patterns,                                           color:'#f97316' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:s.color, borderRadius:'var(--radius) var(--radius) 0 0' }}/>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div className="card">
        {/* Filters */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text-3)' }}>Filter:</span>
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ padding:'5px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, fontFamily:'var(--font-ui)', outline:'none' }}>
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_INFO).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <select value={filterPri} onChange={e=>setFilterPri(e.target.value)} style={{ padding:'5px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, fontFamily:'var(--font-ui)', outline:'none' }}>
            <option value="all">All Priorities</option>
            {Object.entries(PRIORITY_INFO).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStat} onChange={e=>setFilterStat(e.target.value)} style={{ padding:'5px 10px', borderRadius:7, border:'1px solid var(--border)', fontSize:12, fontFamily:'var(--font-ui)', outline:'none' }}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <span style={{ fontSize:12, color:'var(--text-4)', marginLeft:'auto' }}>{filtered.length} complaints</span>
        </div>

        {filtered.length === 0 ? <div className="empty">No complaints found.</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filtered.map(c => {
              const cat  = CATEGORY_INFO[c.category]  || CATEGORY_INFO.other;
              const pri  = PRIORITY_INFO[c.priority]   || PRIORITY_INFO.medium;
              const sen  = SENTIMENT_INFO[c.sentiment] || SENTIMENT_INFO.calm;
              const stat = STATUS_COLORS[c.status]     || STATUS_COLORS.pending;
              return (
                <div key={c.complaint_id} style={{
                  border:`1.5px solid ${c.priority==='urgent'?'#fca5a5':c.is_pattern?'#fcd34d':'var(--border)'}`,
                  borderRadius:'var(--radius-sm)', padding:'14px 16px',
                  background: c.priority==='urgent'?'#fef9f9':c.is_pattern?'#fffdf0':'white',
                  position:'relative',
                }}>
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, borderRadius:'4px 0 0 4px', background:pri.color }}/>
                  <div style={{ paddingLeft:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{c.full_name}</span>
                        {c.category && <span style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:cat.bg, color:cat.color }}>{cat.icon} {cat.label}</span>}
                        {c.priority && <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:pri.bg, color:pri.color, border:`1px solid ${pri.bd}` }}>{pri.label}</span>}
                        {c.sentiment && <span title={sen.label} style={{ fontSize:14 }}>{sen.icon}</span>}
                        {c.is_pattern===1 && <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fef3c7', color:'#92400e', border:'1px solid #fcd34d' }}>⚠ Pattern ({c.similar_count})</span>}
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                        <span className={`badge ${stat.badge}`}>{stat.label}</span>
                        <span style={{ fontSize:11, color:'var(--text-4)' }}>{c.created_at?.split('T')[0]}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.6, marginBottom:10 }}>{c.description}</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {c.status !== 'in-progress' && c.status !== 'resolved' && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(c.complaint_id,'in-progress')}>Mark In Progress</button>}
                      {c.status !== 'resolved' && <button className="btn btn-primary btn-sm" onClick={() => updateStatus(c.complaint_id,'resolved')}>✓ Resolve</button>}
                      {c.status === 'resolved' && <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(c.complaint_id,'pending')}>Re-open</button>}
                      {!c.category && <button className="btn btn-secondary btn-sm" onClick={() => reanalyze(c.complaint_id)}>🤖 Analyse</button>}
                      <button className="btn btn-danger btn-sm" onClick={() => del(c.complaint_id)}>Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Complaints({ user }) {
  if (!user) { try { user = JSON.parse(localStorage.getItem('hms_user'))||{}; } catch { user={}; } }
  if (user.role === 'student') return <StudentComplaints user={user} />;
  return <AdminComplaints />;
}