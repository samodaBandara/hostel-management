import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

export default function Allocations() {
  const [allocs, setAllocs]           = useState([]);
  const [students, setStudents]       = useState([]);
  const [rooms, setRooms]             = useState([]);
  const [form, setForm]               = useState({ student_id: '', room_id: '', allocation_date: new Date().toISOString().split('T')[0] });
  const [msg, setMsg]                 = useState({ text: '', type: '' });
  const [hoveredRoom, setHoveredRoom] = useState(null);

  const load = () => {
    Promise.all([
      axios.get(`${API}/allocations`),
      axios.get(`${API}/students`),
      axios.get(`${API}/rooms`),
    ]).then(([a, s, r]) => {
      setAllocs(a.data);
      setStudents(s.data);
      setRooms(r.data);
    });
  };

  useEffect(() => { load(); }, []);

  const flash = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  // ── Capacity helpers ──────────────────────────────────────────
  const roomOccupantMap = {};
  allocs.forEach(a => {
    if (!roomOccupantMap[a.room_id]) roomOccupantMap[a.room_id] = [];
    roomOccupantMap[a.room_id].push(a);
  });

  const getRoomOccupants = (room_id) => roomOccupantMap[room_id] || [];
  const getRoomFilled    = (room)    => getRoomOccupants(room.room_id).length;
  const getRoomSlots     = (room)    => Math.max(0, room.capacity - getRoomFilled(room));
  const isRoomFull       = (room)    => getRoomFilled(room) >= room.capacity;

  // ── Dropdown filters ──────────────────────────────────────────
  const allocatedStudentIds = new Set(allocs.map(a => a.student_id));
  const availableStudents   = students.filter(s => !allocatedStudentIds.has(s.student_id));
  const selectableRooms     = rooms.filter(r => r.status !== 'maintenance' && !isRoomFull(r));

  // ── Room color based on fill ──────────────────────────────────
  const getRoomStyle = (room) => {
    if (room.status === 'maintenance')
      return { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', fill: '#ef4444' };
    const filled = getRoomFilled(room);
    const cap    = room.capacity;
    if (filled === 0)  return { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', fill: '#10b981' };
    if (filled >= cap) return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', fill: '#f59e0b' };
    return               { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', fill: '#f97316' };
  };

  // ── Tower data ────────────────────────────────────────────────
  // Extract floor number from room_number prefix e.g. "F1-001"->1, "F2-003"->2
  const getFloor = (r) => {
    const match = r.room_number?.match(/[A-Za-z]*?(\d+)/i);
    return match ? parseInt(match[1]) : (r.floor || 1);
  };

  const floors = {};
  rooms.forEach(r => {
    const f = getFloor(r);
    if (!floors[f]) floors[f] = [];
    floors[f].push(r);
  });
  const floorNumbers   = Object.keys(floors).map(Number).sort((a, b) => b - a);
  const totalCapacity  = rooms.reduce((s, r) => s + r.capacity, 0);
  const totalOccupied  = allocs.length;
  const availSlots     = totalCapacity - totalOccupied;
  const occupancyPct   = totalCapacity ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.student_id) return flash('Please select a student', 'error');
    if (!form.room_id)    return flash('Please select a room', 'error');
    try {
      await axios.post(`${API}/allocations`, form);
      flash('Room allocated successfully!');
      setForm(f => ({ ...f, student_id: '', room_id: '' }));
      load();
    } catch (err) {
      flash(err.response?.data?.error || 'Error allocating room', 'error');
    }
  };

  const del = async (id) => {
    if (!window.confirm('Remove this allocation?')) return;
    await axios.delete(`${API}/allocations/${id}`);
    flash('Allocation removed');
    load();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Allocations</h1>
        <p>Assign students to rooms · Live building view</p>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Form */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>+ Allocate Room</div>
            <form onSubmit={submit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>

                <div className="form-group">
                  <label>Student *</label>
                  <select value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} required>
                    <option value="">Select student</option>
                    {availableStudents.length === 0
                      ? <option disabled>All students already allocated</option>
                      : availableStudents.map(s => (
                          <option key={s.student_id} value={s.student_id}>{s.full_name}</option>
                        ))
                    }
                  </select>
                  {availableStudents.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>⚠ All students have room allocations</div>
                  )}
                </div>

                <div className="form-group">
                  <label>Room *</label>
                  <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} required>
                    <option value="">Select room</option>
                    {selectableRooms.length === 0
                      ? <option disabled>No rooms with available slots</option>
                      : selectableRooms.map(r => {
                          const filled = getRoomFilled(r);
                          const slots  = getRoomSlots(r);
                          const label  = filled === 0
                            ? `${r.room_number} — ${r.room_type} · Floor ${getFloor(r)} · ${r.capacity} slot${r.capacity!==1?'s':''} free`
                            : `${r.room_number} — ${r.room_type} · Floor ${getFloor(r)} · ${filled}/${r.capacity} filled · ${slots} slot${slots!==1?'s':''} left`;
                          return <option key={r.room_id} value={r.room_id}>{label}</option>;
                        })
                    }
                  </select>
                  {selectableRooms.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>⚠ No rooms with available slots</div>
                  )}
                </div>

                <div className="form-group">
                  <label>Allocation Date *</label>
                  <input type="date" value={form.allocation_date} onChange={e => setForm(f => ({ ...f, allocation_date: e.target.value }))} required />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
                Allocate Room
              </button>
            </form>
          </div>

          {/* Table */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Current Allocations
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-4)' }}>({allocs.length})</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Student</th><th>Room</th><th>Type</th><th>Fill</th><th>Date</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {allocs.length === 0 && (
                    <tr><td colSpan={6}><div className="empty">No allocations yet.</div></td></tr>
                  )}
                  {allocs.map(a => {
                    const room   = rooms.find(r => r.room_id === a.room_id);
                    const filled = room ? getRoomFilled(room) : '?';
                    const cap    = room?.capacity || '?';
                    const pct    = (typeof filled === 'number' && typeof cap === 'number') ? Math.round((filled/cap)*100) : 0;
                    return (
                      <tr key={a.allocation_id}>
                        <td style={{ color: 'var(--text)', fontWeight: 600 }}>{a.full_name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--teal)' }}>{a.room_number}</td>
                        <td style={{ textTransform: 'capitalize', color: 'var(--text-3)' }}>{a.room_type}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 70 }}>
                            <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 99, background: pct >= 100 ? '#f59e0b' : pct > 50 ? '#f97316' : '#10b981', width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{filled}/{cap}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{a.allocation_date}</td>
                        <td>
                          <button className="btn btn-danger btn-sm" onClick={() => del(a.allocation_id)}>Remove</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Building Tower ── */}
        <div className="card" style={{ position: 'sticky', top: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>🏢 Building Overview</div>

          {/* Summary pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Total Slots', val: totalCapacity, color: 'var(--text-2)', bg: 'var(--bg-3)',  bd: 'var(--border)' },
              { label: 'Occupied',    val: totalOccupied, color: '#f59e0b',       bg: '#fffbeb',      bd: '#fcd34d' },
              { label: 'Available',   val: availSlots,    color: '#10b981',       bg: '#ecfdf5',      bd: '#6ee7b7' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
                <div style={{ fontSize: 9, color: s.color, fontWeight: 600, marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Occupancy bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-3)', fontWeight: 600 }}>Overall Occupancy</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: occupancyPct > 80 ? '#ef4444' : occupancyPct > 50 ? '#f59e0b' : '#0ab8a0' }}>{occupancyPct}%</span>
            </div>
            <div style={{ height: 7, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99, transition: 'width 0.6s ease',
                background: occupancyPct > 80 ? '#ef4444' : occupancyPct > 50 ? '#f59e0b' : '#0ab8a0',
                width: `${occupancyPct}%`,
              }} />
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {[
              { label: 'Empty',       color: '#10b981', bg: '#ecfdf5' },
              { label: 'Partial',     color: '#f97316', bg: '#fff7ed' },
              { label: 'Full',        color: '#f59e0b', bg: '#fef3c7' },
              { label: 'Maintenance', color: '#ef4444', bg: '#fef2f2' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: l.bg, border: `1.5px solid ${l.color}` }} />
                <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>{l.label}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />

          {/* Tower floors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 420, overflowY: 'auto', paddingRight: 2 }}>

            {/* Ground floor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textAlign: 'right', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>GF</div>
              <div style={{ flex: 1, background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1.5px solid #93c5fd', borderRadius: 6, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏛</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1e40af' }}>Admin Office</div>
                  <div style={{ fontSize: 9, color: '#3b82f6' }}>Reception & Administration</div>
                </div>
              </div>
            </div>

            {/* Room floors */}
            {floorNumbers.map(floorNum => {
              const floorRooms    = floors[floorNum] || [];
              const floorOccupied = floorRooms.reduce((s, r) => s + getRoomFilled(r), 0);
              const floorCap      = floorRooms.reduce((s, r) => s + r.capacity, 0);
              return (
                <div key={floorNum} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, fontSize: 9, fontWeight: 700, color: 'var(--text-4)', textAlign: 'right', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>F{floorNum}</div>
                  <div style={{ flex: 1, background: 'var(--bg-3)', borderRadius: 6, padding: '5px 8px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {floorRooms.map(room => {
                      const c       = getRoomStyle(room);
                      const filled  = getRoomFilled(room);
                      const cap     = room.capacity;
                      const fillPct = cap > 0 ? (filled / cap) * 100 : 0;
                      const isHov   = hoveredRoom?.room_id === room.room_id;
                      return (
                        <div
                          key={room.room_id}
                          onMouseEnter={() => setHoveredRoom(room)}
                          onMouseLeave={() => setHoveredRoom(null)}
                          style={{
                            width: 46, height: 42,
                            background: c.bg,
                            border: `1.5px solid ${isHov ? '#0ab8a0' : c.border}`,
                            borderRadius: 5, cursor: 'pointer',
                            transition: 'all 0.15s',
                            transform: isHov ? 'scale(1.12)' : 'scale(1)',
                            boxShadow: isHov ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                            position: 'relative', zIndex: isHov ? 10 : 1,
                            overflow: 'hidden',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            padding: '2px',
                          }}
                        >
                          {/* Room number */}
                          <div style={{ fontSize: 7, fontWeight: 700, color: c.text, lineHeight: 1, textAlign: 'center' }}>
                            {room.room_number}
                          </div>
                          {/* Slot count */}
                          <div style={{ fontSize: 8, fontWeight: 700, color: c.text, lineHeight: 1, marginTop: 2 }}>
                            {room.status === 'maintenance' ? '🔧' : `${filled}/${cap}`}
                          </div>
                          {/* Fill bar */}
                          {room.status !== 'maintenance' && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(0,0,0,0.08)' }}>
                              <div style={{ height: '100%', width: `${fillPct}%`, background: c.fill, transition: 'width 0.4s ease' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Floor total */}
                    <div style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {floorOccupied}/{floorCap}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hover tooltip */}
          {hoveredRoom && (() => {
            const filled    = getRoomFilled(hoveredRoom);
            const cap       = hoveredRoom.capacity;
            const slots     = getRoomSlots(hoveredRoom);
            const occupants = getRoomOccupants(hoveredRoom.room_id);
            const fillPct   = cap > 0 ? Math.round((filled / cap) * 100) : 0;
            return (
              <div style={{
                position: 'fixed', bottom: 28, right: 28,
                background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '14px 18px',
                zIndex: 1000, minWidth: 230,
                boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
              }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Room Detail</div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)' }}>{hoveredRoom.room_number}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>
                      {hoveredRoom.room_type} · Floor {getFloor(hoveredRoom)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: filled >= cap ? '#f59e0b' : '#10b981' }}>{filled}/{cap}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{slots} slot{slots !== 1 ? 's' : ''} free</div>
                  </div>
                </div>

                {/* Fill bar */}
                <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 99, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    background: filled >= cap ? '#f59e0b' : filled > 0 ? '#f97316' : '#10b981',
                    width: `${fillPct}%`, transition: 'width 0.4s',
                  }} />
                </div>

                {hoveredRoom.status === 'maintenance' ? (
                  <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: 6, padding: '8px 10px', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>
                    🔧 Under Maintenance
                  </div>
                ) : occupants.length === 0 ? (
                  <div style={{ background: 'rgba(16,185,129,0.15)', borderRadius: 6, padding: '8px 10px', border: '1px solid rgba(16,185,129,0.3)', fontSize: 12, color: '#6ee7b7', fontWeight: 600 }}>
                    ✓ Empty — {cap} slot{cap !== 1 ? 's' : ''} available
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                      Occupants ({filled}/{cap})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {occupants.map((o, i) => (
                        <div key={o.allocation_id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(10,184,160,0.25)', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, color: '#5eead4', flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>{o.full_name}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Since {o.allocation_date}</div>
                          </div>
                        </div>
                      ))}
                      {slots > 0 && (
                        <div style={{ fontSize: 10, color: '#6ee7b7', marginTop: 2, fontWeight: 600 }}>
                          + {slots} slot{slots !== 1 ? 's' : ''} still available
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}