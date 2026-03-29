import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

const GIRLS_FLOORS = [1,2,3,4,5];
const BOYS_FLOORS  = [6,7,8,9,10];

// ── Charts ────────────────────────────────────────────────────
function DonutChart({ segments, size = 120, thickness = 22 }) {
  const r     = (size - thickness) / 2;
  const cx    = size / 2, cy = size / 2;
  const circ  = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset  = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((seg, i) => {
        const pct  = seg.value / total;
        const dash = pct * circ;
        const gap  = circ - dash;
        const el   = (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circ}
            strokeLinecap="butt" />
        );
        offset += pct;
        return el;
      })}
    </svg>
  );
}

function BarChart({ data, color = '#0ab8a0', height = 120 }) {
  if (!data.length) return null;
  const max  = Math.max(...data.map(d => d.value), 1);
  const barW = Math.floor(480 / data.length) - 8;
  return (
    <svg width="100%" viewBox={`0 0 ${data.length * (barW + 8)} ${height + 28}`} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const bh = Math.max(3, (d.value / max) * height);
        const x  = i * (barW + 8);
        const y  = height - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx="4" fill={color} opacity="0.85" />
            {d.value > 0 && <text x={x + barW/2} y={y - 5} textAnchor="middle" fontSize="10" fill="var(--text-3)" fontFamily="inherit">{d.value}</text>}
            <text x={x + barW/2} y={height + 16} textAnchor="middle" fontSize="10" fill="var(--text-4)" fontFamily="inherit">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Sparkline({ values, color = '#0ab8a0', w = 80, h = 32 }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ label, value, sub, color, spark }) {
  return (
    <div className="stat-card">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: 'var(--radius) var(--radius) 0 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ color }}>{value}</div>
          <div className="stat-sub">{sub}</div>
        </div>
        {spark && <Sparkline values={spark} color={color} />}
      </div>
    </div>
  );
}

const payBadge = (s) => s === 'received' ? 'badge-green' : s === 'rejected' ? 'badge-red' : 'badge-amber';
const payLabel = (s) => s === 'pending_verification' ? 'Pending' : s === 'received' ? 'Received' : s === 'rejected' ? 'Rejected' : s;

// ── ADMIN DASHBOARD ───────────────────────────────────────────
function AdminDashboard() {
  const [stats, setStats]           = useState(null);
  const [payments, setPayments]     = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [rooms, setRooms]           = useState([]);
  const [allocs, setAllocs]         = useState([]);

  useEffect(() => {
    axios.get(`${API}/dashboard`).then(r => setStats(r.data));
    axios.get(`${API}/payments`).then(r => setPayments(r.data));
    axios.get(`${API}/complaints`).then(r => setComplaints(r.data));
    axios.get(`${API}/rooms`).then(r => setRooms(r.data));
    axios.get(`${API}/allocations`).then(r => setAllocs(r.data));
  }, []);

  if (!stats) return <div className="empty">Loading...</div>;

  // ── Revenue chart ──
  const now = new Date();
  const monthLabels  = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d.toLocaleString('default', { month: 'short' });
  });
  const monthRevenue = Array.from({ length: 6 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return payments.filter(p => p.status === 'received' && (p.payment_date || '').startsWith(key))
                   .reduce((s, p) => s + p.amount, 0);
  });

  // ── Complaint stats ──
  const cPending  = complaints.filter(c => c.status === 'pending').length;
  const cProgress = complaints.filter(c => c.status === 'in-progress').length;
  const cResolved = complaints.filter(c => c.status === 'resolved').length;

  // ── Payment stats ──
  const pReceived = payments.filter(p => p.status === 'received').length;
  const pPending  = payments.filter(p => p.status === 'pending_verification').length;
  const recent    = [...payments].slice(0, 5);

  // ── Building stats ──
  const girlsRooms    = rooms.filter(r => GIRLS_FLOORS.includes(r.floor));
  const boysRooms     = rooms.filter(r => BOYS_FLOORS.includes(r.floor));
  const girlsCap      = girlsRooms.reduce((s, r) => s + r.capacity, 0);
  const boysCap       = boysRooms.reduce((s, r) => s + r.capacity, 0);

  // Count allocations per building using room floor
  const roomFloorMap = {};
  rooms.forEach(r => { roomFloorMap[r.room_id] = r.floor; });
  const girlsOccupied = allocs.filter(a => GIRLS_FLOORS.includes(roomFloorMap[a.room_id])).length;
  const boysOccupied  = allocs.filter(a => BOYS_FLOORS.includes(roomFloorMap[a.room_id])).length;

  const rAvail = rooms.filter(r => r.status === 'available').length;
  const rOcc   = rooms.filter(r => r.status === 'occupied').length;
  const rMaint = rooms.filter(r => r.status === 'maintenance').length;
  const occupancyPct = stats.totalRooms ? Math.round(((stats.occupiedRooms||0) / stats.totalRooms) * 100) : 0;

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Full system overview · Admin view</p>
      </div>

      {/* Top stat cards */}
      <div className="stats-grid">
        <StatCard label="Total Students"     value={stats.totalStudents}     sub="Registered in system"              color="var(--blue)"  spark={[3,5,4,6,stats.totalStudents]} />
        <StatCard label="Available Rooms"    value={stats.availableRooms}    sub={`of ${stats.totalRooms} total`}    color="var(--green)" spark={[rOcc,rAvail,rAvail,rAvail,rAvail]} />
        <StatCard label="Occupancy Rate"     value={`${occupancyPct}%`}      sub={`${stats.occupiedRooms||0} occupied`} color="var(--teal)"  spark={[20,35,50,60,occupancyPct]} />
        <StatCard label="Pending Complaints" value={stats.pendingComplaints} sub="Awaiting resolution"               color="var(--amber)" spark={[2,4,3,5,stats.pendingComplaints]} />
        <StatCard label="Total Revenue"      value={`Rs.${Number(stats.totalRevenue).toLocaleString()}`} sub={`${pReceived} verified payments`} color="var(--sky)" spark={monthRevenue.slice(-5)} />
      </div>

      {/* ── Building A vs B cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {/* Girls Building */}
        <div style={{ background: 'linear-gradient(135deg,#fdf2f8,#fce7f3)', border: '1.5px solid #f9a8d4', borderRadius: 'var(--radius)', padding: '18px 22px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#ec4899,#db2777)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#be185d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>♀ Building A — Girls</div>
              <div style={{ fontSize: 11, color: '#9d174d', fontFamily: 'var(--font-mono)' }}>Floors 1 – 5</div>
            </div>
            <span style={{ fontSize: 32, opacity: 0.15 }}>♀</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { l: 'Occupied',  v: girlsOccupied,            c: '#ec4899' },
              { l: 'Available', v: girlsCap - girlsOccupied, c: '#10b981' },
              { l: 'Total',     v: girlsCap,                 c: '#9d174d' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.c, fontFamily: 'var(--font-mono)' }}>{s.v}</div>
                <div style={{ fontSize: 10, color: s.c, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 6, background: 'rgba(236,72,153,0.15)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#ec4899', width: `${girlsCap ? Math.round((girlsOccupied/girlsCap)*100) : 0}%`, transition: 'width 0.6s' }} />
          </div>
          <div style={{ fontSize: 11, color: '#be185d', marginTop: 5, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {girlsCap ? Math.round((girlsOccupied/girlsCap)*100) : 0}% occupied
          </div>
        </div>

        {/* Boys Building */}
        <div style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1.5px solid #93c5fd', borderRadius: 'var(--radius)', padding: '18px 22px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#3b82f6,#1d4ed8)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>♂ Building B — Boys</div>
              <div style={{ fontSize: 11, color: '#1e40af', fontFamily: 'var(--font-mono)' }}>Floors 6 – 10</div>
            </div>
            <span style={{ fontSize: 32, opacity: 0.15 }}>♂</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { l: 'Occupied',  v: boysOccupied,           c: '#3b82f6' },
              { l: 'Available', v: boysCap - boysOccupied, c: '#10b981' },
              { l: 'Total',     v: boysCap,                c: '#1e40af' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.c, fontFamily: 'var(--font-mono)' }}>{s.v}</div>
                <div style={{ fontSize: 10, color: s.c, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 6, background: 'rgba(59,130,246,0.15)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#3b82f6', width: `${boysCap ? Math.round((boysOccupied/boysCap)*100) : 0}%`, transition: 'width 0.6s' }} />
          </div>
          <div style={{ fontSize: 11, color: '#1d4ed8', marginTop: 5, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {boysCap ? Math.round((boysOccupied/boysCap)*100) : 0}% occupied
          </div>
        </div>
      </div>

      {/* Revenue + Complaints */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span>Monthly Revenue</span>
            <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500 }}>Last 6 months</span>
          </div>
          <BarChart data={monthLabels.map((label, i) => ({ label, value: Math.round(monthRevenue[i]) }))} color="var(--teal)" height={110} />
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12, alignSelf: 'flex-start' }}>Complaints</div>
          <DonutChart size={110} thickness={20} segments={[
            { value: cPending,  color: '#f59e0b' },
            { value: cProgress, color: '#0ea5e9' },
            { value: cResolved, color: '#10b981' },
          ]} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, width: '100%' }}>
            {[
              { label: 'Pending',     val: cPending,  color: '#f59e0b' },
              { label: 'In Progress', val: cProgress, color: '#0ea5e9' },
              { label: 'Resolved',    val: cResolved, color: '#10b981' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  <span style={{ color: 'var(--text-3)' }}>{s.label}</span>
                </div>
                <span style={{ fontWeight: 700, color: s.color }}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Room status + Recent payments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Room Status</div>
          {[
            { label: 'Available',   val: rAvail, color: '#10b981' },
            { label: 'Occupied',    val: rOcc,   color: '#f59e0b' },
            { label: 'Maintenance', val: rMaint, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700 }}>{s.val} / {stats.totalRooms}</span>
              </div>
              <div style={{ height: 7, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: s.color, width: `${stats.totalRooms ? Math.round((s.val/stats.totalRooms)*100) : 0}%`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          ))}
          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Payment Summary</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'Verified', val: pReceived, color: '#10b981', bg: '#ecfdf5' },
              { label: 'Pending',  val: pPending,  color: '#f59e0b', bg: '#fffbeb' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 8, padding: '12px 14px', border: `1px solid ${s.color}22` }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
            <span>Recent Payments</span>
            <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 500 }}>Latest 5</span>
          </div>
          {recent.length === 0
            ? <div className="empty" style={{ padding: 24 }}>No payments yet</div>
            : recent.map(p => (
              <div key={p.payment_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.full_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{p.payment_date} · {p.method||'manual'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>Rs.{Number(p.amount).toLocaleString()}</div>
                  <span className={`badge ${payBadge(p.status)}`} style={{ fontSize: 10, marginTop: 3 }}>{payLabel(p.status)}</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </>
  );
}

// ── STAFF DASHBOARD ───────────────────────────────────────────
function StaffDashboard({ user }) {
  const [stats, setStats]           = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [rooms, setRooms]           = useState([]);
  const [allocs, setAllocs]         = useState([]);

  useEffect(() => {
    axios.get(`${API}/dashboard`).then(r => setStats(r.data));
    axios.get(`${API}/complaints`).then(r => setComplaints(r.data));
    axios.get(`${API}/rooms`).then(r => setRooms(r.data));
    axios.get(`${API}/allocations`).then(r => setAllocs(r.data));
  }, []);

  if (!stats) return <div className="empty">Loading...</div>;

  const cPending  = complaints.filter(c => c.status === 'pending').length;
  const cProgress = complaints.filter(c => c.status === 'in-progress').length;
  const cResolved = complaints.filter(c => c.status === 'resolved').length;
  const open      = complaints.filter(c => c.status !== 'resolved').slice(0, 6);
  const rAvail    = rooms.filter(r => r.status === 'available').length;
  const rOcc      = rooms.filter(r => r.status === 'occupied').length;
  const rMaint    = rooms.filter(r => r.status === 'maintenance').length;

  const girlsRooms    = rooms.filter(r => GIRLS_FLOORS.includes(r.floor));
  const boysRooms     = rooms.filter(r => BOYS_FLOORS.includes(r.floor));
  const girlsCap      = girlsRooms.reduce((s, r) => s + r.capacity, 0);
  const boysCap       = boysRooms.reduce((s, r) => s + r.capacity, 0);
  const roomFloorMap  = {};
  rooms.forEach(r => { roomFloorMap[r.room_id] = r.floor; });
  const girlsOccupied = allocs.filter(a => GIRLS_FLOORS.includes(roomFloorMap[a.room_id])).length;
  const boysOccupied  = allocs.filter(a => BOYS_FLOORS.includes(roomFloorMap[a.room_id])).length;

  return (
    <>
      <div className="page-header">
        <h1>Welcome, {user.name}</h1>
        <p>Staff dashboard · here's what needs your attention today</p>
      </div>

      <div className="stats-grid">
        <StatCard label="Pending"         value={cPending}  sub="Need resolution"    color="var(--amber)" spark={[1,3,2,4,cPending]} />
        <StatCard label="In Progress"     value={cProgress} sub="Being handled"      color="var(--sky)"   spark={[0,1,2,1,cProgress]} />
        <StatCard label="Resolved"        value={cResolved} sub="Completed"          color="var(--green)" spark={[0,1,2,3,cResolved]} />
        <StatCard label="Available Rooms" value={rAvail}    sub={`${rOcc} occupied`} color="var(--teal)"  spark={[rOcc,rAvail,rAvail,rAvail,rAvail]} />
      </div>

      {/* Building overview for staff */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg,#fdf2f8,#fce7f3)', border: '1.5px solid #f9a8d4', borderRadius: 'var(--radius)', padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#ec4899,#db2777)' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#be185d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>♀ Building A — Girls · Floors 1-5</div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
            <div><div style={{ fontSize: 20, fontWeight: 700, color: '#ec4899', fontFamily: 'var(--font-mono)' }}>{girlsOccupied}</div><div style={{ fontSize: 10, color: '#be185d', fontWeight: 600 }}>Occupied</div></div>
            <div><div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>{girlsCap - girlsOccupied}</div><div style={{ fontSize: 10, color: '#065f46', fontWeight: 600 }}>Available</div></div>
          </div>
          <div style={{ height: 5, background: 'rgba(236,72,153,0.15)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#ec4899', width: `${girlsCap ? Math.round((girlsOccupied/girlsCap)*100) : 0}%` }} />
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1.5px solid #93c5fd', borderRadius: 'var(--radius)', padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#3b82f6,#1d4ed8)' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>♂ Building B — Boys · Floors 6-10</div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 10 }}>
            <div><div style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6', fontFamily: 'var(--font-mono)' }}>{boysOccupied}</div><div style={{ fontSize: 10, color: '#1e40af', fontWeight: 600 }}>Occupied</div></div>
            <div><div style={{ fontSize: 20, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>{boysCap - boysOccupied}</div><div style={{ fontSize: 10, color: '#065f46', fontWeight: 600 }}>Available</div></div>
          </div>
          <div style={{ height: 5, background: 'rgba(59,130,246,0.15)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#3b82f6', width: `${boysCap ? Math.round((boysOccupied/boysCap)*100) : 0}%` }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Complaint Overview</div>
          <BarChart data={[
            { label: 'Pending',     value: cPending },
            { label: 'In Progress', value: cProgress },
            { label: 'Resolved',    value: cResolved },
          ]} color="var(--teal)" height={90} />
          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Room Health</div>
          {[
            { label: 'Available',   val: rAvail, color: '#10b981' },
            { label: 'Occupied',    val: rOcc,   color: '#f59e0b' },
            { label: 'Maintenance', val: rMaint, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-3)' }}>{s.label}</span>
                <span style={{ fontWeight: 700, color: s.color }}>{s.val}</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, background: s.color, width: `${rooms.length ? Math.round((s.val/rooms.length)*100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>Open Complaints</div>
          {open.length === 0
            ? <div className="empty" style={{ padding: 24 }}>All clear!</div>
            : open.map(c => (
              <div key={c.complaint_id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{c.description.length > 55 ? c.description.slice(0, 55) + '...' : c.description}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 3 }}>{c.created_at?.split('T')[0] || c.created_at}</div>
                </div>
                <span className={`badge ${c.status === 'pending' ? 'badge-amber' : 'badge-blue'}`}>{c.status}</span>
              </div>
            ))
          }
        </div>
      </div>
    </>
  );
}

// ── STUDENT DASHBOARD ─────────────────────────────────────────
function StudentDashboard({ user }) {
  const [payments, setPayments]     = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [allocation, setAllocation] = useState(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/payments`),
      axios.get(`${API}/complaints`),
      axios.get(`${API}/allocations`),
    ]).then(([p, c, a]) => {
      setPayments(p.data.filter(x => x.student_id === user.student_id).slice(0, 6));
      setComplaints(c.data.filter(x => x.student_id === user.student_id).slice(0, 4));
      setAllocation(a.data.find(x => x.student_id === user.student_id) || null);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="empty">Loading...</div>;

  const totalPaid  = payments.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0);
  const pendingPay = payments.filter(p => p.status === 'pending_verification').length;
  const cResolved  = complaints.filter(c => c.status === 'resolved').length;
  const cOpen      = complaints.filter(c => c.status !== 'resolved').length;

  const allocFloor    = allocation ? parseInt(allocation.room_number?.match(/\d+/)?.[0] || 0) : 0;
  const allocBuilding = GIRLS_FLOORS.includes(allocFloor) ? 'girls' : BOYS_FLOORS.includes(allocFloor) ? 'boys' : null;
  const buildingColor = allocBuilding === 'girls' ? '#ec4899' : '#3b82f6';
  const buildingLabel = allocBuilding === 'girls' ? '♀ Building A — Girls Hostel' : allocBuilding === 'boys' ? '♂ Building B — Boys Hostel' : null;

  return (
    <>
      <div className="page-header">
        <h1>Welcome, {user.name}</h1>
        <p>Your hostel overview</p>
      </div>

      {/* Room banner */}
      <div className="student-room-banner" style={allocBuilding === 'girls' ? { background: 'linear-gradient(135deg,#be185d,#9d174d)' } : allocBuilding === 'boys' ? { background: 'linear-gradient(135deg,#1d4ed8,#1e40af)' } : {}}>
        {allocation ? (
          <>
            <div className="srb-left">
              <div className="srb-icon">🏠</div>
              <div>
                {buildingLabel && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 2 }}>{buildingLabel}</div>}
                <div className="srb-label">Your Allocated Room</div>
                <div className="srb-room">Room {allocation.room_number}</div>
                <div className="srb-type">{allocation.room_type} · Floor {allocation.floor || allocFloor} · Since {allocation.allocation_date}</div>
              </div>
            </div>
            <span className="badge badge-green" style={{ fontSize: 13, padding: '5px 14px' }}>Active</span>
          </>
        ) : (
          <>
            <div className="srb-left">
              <div className="srb-icon" style={{ opacity: 0.5 }}>🏠</div>
              <div>
                <div className="srb-label">Room Status</div>
                <div className="srb-room" style={{ opacity: 0.7 }}>Not Allocated</div>
                <div className="srb-type">Contact admin for room assignment</div>
              </div>
            </div>
            <span className="badge badge-amber" style={{ fontSize: 13 }}>Pending</span>
          </>
        )}
      </div>

      <div className="stats-grid">
        <StatCard label="Amount Paid"      value={`Rs.${totalPaid.toLocaleString()}`} sub={`${payments.filter(p=>p.status==='received').length} verified`} color="var(--green)" />
        <StatCard label="Pending Payments" value={pendingPay}  sub="Awaiting verification" color="var(--amber)" />
        <StatCard label="Open Complaints"  value={cOpen}       sub="Awaiting response"     color="var(--sky)" />
        <StatCard label="Resolved"         value={cResolved}   sub="Complaints closed"     color="var(--teal)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>My Payment History</div>
          {payments.length === 0
            ? <div style={{ color: 'var(--text-4)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No payments yet</div>
            : payments.map(p => (
              <div key={p.payment_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Rs. {Number(p.amount).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>{p.payment_date} · {p.method||'manual'}</div>
                </div>
                <span className={`badge ${payBadge(p.status)}`}>{payLabel(p.status)}</span>
              </div>
            ))
          }
        </div>
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>My Complaints</div>
          {complaints.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Open',     val: cOpen,     color: '#f59e0b', bg: '#fffbeb' },
                { label: 'Resolved', val: cResolved, color: '#10b981', bg: '#ecfdf5' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: s.bg, borderRadius: 8, padding: '10px 12px', border: `1px solid ${s.color}22` }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          {complaints.length === 0
            ? <div style={{ color: 'var(--text-4)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>No complaints submitted yet</div>
            : complaints.map(c => (
              <div key={c.complaint_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{c.description.length > 50 ? c.description.slice(0, 50) + '...' : c.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>{c.created_at?.split('T')[0] || c.created_at}</div>
                </div>
                <span className={`badge ${c.status === 'resolved' ? 'badge-green' : c.status === 'in-progress' ? 'badge-blue' : 'badge-amber'}`}>
                  {c.status === 'in-progress' ? 'In Progress' : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </>
  );
}

// ── ROUTER ────────────────────────────────────────────────────
export default function Dashboard() {
  const user = (() => { try { return JSON.parse(localStorage.getItem('hms_user')) || {}; } catch { return {}; } })();
  if (user.role === 'student') return <StudentDashboard user={user} />;
  if (user.role === 'staff')   return <StaffDashboard   user={user} />;
  return <AdminDashboard />;
}