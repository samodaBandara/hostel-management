import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

// ── Building / Gender config ──────────────────────────────────
const GIRLS_FLOORS = [1, 2, 3, 4, 5];
const BOYS_FLOORS  = [6, 7, 8, 9, 10];

const getFloor = (r) => {
  const match = r.room_number?.match(/[A-Za-z]*?(\d+)/i);
  return match ? parseInt(match[1]) : (r.floor || 1);
};

const floorBuilding = (f) => GIRLS_FLOORS.includes(f) ? 'girls' : BOYS_FLOORS.includes(f) ? 'boys' : 'unknown';

const studentBuilding = (gender) => {
  if (!gender) return null;
  const g = gender.toLowerCase();
  if (g === 'female') return 'girls';
  if (g === 'male')   return 'boys';
  return null;
};

const genderIcon  = (g) => g === 'female' ? '♀' : g === 'male' ? '♂' : '—';
const genderColor = (g) => g === 'female' ? '#ec4899' : g === 'male' ? '#3b82f6' : 'var(--text-4)';

export default function Allocations() {
  const [allocs, setAllocs]             = useState([]);
  const [students, setStudents]         = useState([]);
  const [rooms, setRooms]               = useState([]);
  const [preferences, setPreferences]   = useState({});
  const [form, setForm]                 = useState({ student_id: '', room_id: '', allocation_date: new Date().toISOString().split('T')[0] });
  const [msg, setMsg]                   = useState({ text: '', type: '' });
  const [hoveredRoom, setHoveredRoom]   = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [activeBuilding, setActiveBuilding] = useState('girls'); // tower tab

  const load = () => {
    Promise.all([
      axios.get(`${API}/allocations`),
      axios.get(`${API}/students`),
      axios.get(`${API}/rooms`),
      axios.get(`${API}/preferences`),
    ]).then(([a, s, r, p]) => {
      setAllocs(a.data);
      setStudents(s.data);
      setRooms(r.data);
      const prefMap = {};
      p.data.forEach(pref => { prefMap[pref.student_id] = pref; });
      setPreferences(prefMap);
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

  // ── Selected student gender ───────────────────────────────────
  const selectedStudent   = students.find(s => s.student_id === parseInt(form.student_id));
  const selectedGender    = selectedStudent?.gender?.toLowerCase() || null;
  const selectedBuilding  = studentBuilding(selectedGender);
  const selectedStudentPref = form.student_id ? preferences[parseInt(form.student_id)] : null;

  // ── Filtered dropdowns ────────────────────────────────────────
  const allocatedStudentIds = new Set(allocs.map(a => a.student_id));
  const availableStudents   = students.filter(s => !allocatedStudentIds.has(s.student_id));

  // Filter rooms by student's gender building + not full + not maintenance
  const selectableRooms = rooms.filter(r => {
    if (r.status === 'maintenance') return false;
    if (isRoomFull(r)) return false;
    if (selectedBuilding) {
      const rb = floorBuilding(getFloor(r));
      return rb === selectedBuilding;
    }
    return true; // no gender set — show all
  });

  // ── Room style ────────────────────────────────────────────────
  const getRoomStyle = (room) => {
    if (room.status === 'maintenance') return { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', fill: '#ef4444' };
    const filled = getRoomFilled(room);
    if (filled === 0)            return { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', fill: '#10b981' };
    if (filled >= room.capacity) return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', fill: '#f59e0b' };
    return                              { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', fill: '#f97316' };
  };

  // ── Building stats ────────────────────────────────────────────
  const girlsRooms    = rooms.filter(r => GIRLS_FLOORS.includes(getFloor(r)));
  const boysRooms     = rooms.filter(r => BOYS_FLOORS.includes(getFloor(r)));
  const girlsCap      = girlsRooms.reduce((s, r) => s + r.capacity, 0);
  const boysCap       = boysRooms.reduce((s, r) => s + r.capacity, 0);
  const girlsOccupied = girlsRooms.reduce((s, r) => s + getRoomFilled(r), 0);
  const boysOccupied  = boysRooms.reduce((s, r) => s + getRoomFilled(r), 0);

  // ── Tower data for active building ────────────────────────────
  const towerFloors  = activeBuilding === 'girls' ? GIRLS_FLOORS : BOYS_FLOORS;
  const floorMap     = {};
  rooms.forEach(r => {
    const f = getFloor(r);
    if (!floorMap[f]) floorMap[f] = [];
    floorMap[f].push(r);
  });
  const towerFloorNumbers = [...towerFloors].sort((a, b) => b - a); // top floor first

  // ── AI suggestion ─────────────────────────────────────────────
  const getAiSuggestion = async (studentId, gender) => {
    if (!studentId) { setAiSuggestion(null); return; }
    const pref = preferences[parseInt(studentId)];
    if (!pref) {
      setAiSuggestion({ type: 'no_prefs', message: 'This student has not filled their Room Preferences form yet.' });
      return;
    }
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const res  = await axios.post(`${API}/ai-suggest-room`, { student_id: parseInt(studentId) });
      const data = res.data;
      if (data.reason === 'no_prefs') {
        setAiSuggestion({ type: 'no_prefs', message: 'This student has not filled their Room Preferences form yet.' });
      } else {
        const building = studentBuilding(gender);
        const buildingNote = building ? ` (${building === 'girls' ? '♀ Girls Building — Floors 1-5' : '♂ Boys Building — Floors 6-10'})` : '';
        const txt = `Recommended: Room ${data.recommended_room} (${data.room_type})${buildingNote} — ${data.reason} Compatibility: ${data.compatibility_score}%.${data.alternative_room ? ` Alternative: ${data.alternative_room} (${data.alternative_score}%)` : ''}`;
        setAiSuggestion({ type: 'suggestion', message: txt, recommended_room: data.recommended_room, alternative_room: data.alternative_room });
        // Auto-switch tower to student's building
        if (building) setActiveBuilding(building);
      }
    } catch {
      setAiSuggestion({ type: 'error', message: 'AI suggestion unavailable.' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleStudentChange = (e) => {
    const sid     = e.target.value;
    const student = students.find(s => s.student_id === parseInt(sid));
    const gender  = student?.gender?.toLowerCase() || null;
    setForm(f => ({ ...f, student_id: sid, room_id: '' }));
    if (gender) setActiveBuilding(studentBuilding(gender) || 'girls');
    getAiSuggestion(sid, gender);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.student_id) return flash('Please select a student', 'error');
    if (!form.room_id)    return flash('Please select a room', 'error');

    // Gender check
    if (selectedBuilding) {
      const room       = rooms.find(r => r.room_id === parseInt(form.room_id));
      const roomBuild  = room ? floorBuilding(getFloor(room)) : null;
      if (roomBuild && roomBuild !== selectedBuilding) {
        return flash(`Cannot allocate ${selectedGender} student to ${roomBuild === 'girls' ? 'Girls' : 'Boys'} Building`, 'error');
      }
    }

    try {
      await axios.post(`${API}/allocations`, form);
      flash('Room allocated successfully!');
      setForm(f => ({ ...f, student_id: '', room_id: '' }));
      setAiSuggestion(null);
      load();
    } catch (err) { flash(err.response?.data?.error || 'Error', 'error'); }
  };

  const del = async (id) => {
    if (!window.confirm('Remove this allocation?')) return;
    await axios.delete(`${API}/allocations/${id}`);
    flash('Allocation removed'); load();
  };

  const prefLabel = (val) => ({
    early: 'Early', late: 'Late', flexible: 'Flexible',
    quiet: 'Quiet', music: 'With Music',
    very_clean: 'Very Clean', moderate: 'Moderate', relaxed: 'Relaxed',
    silent: 'Silent', noisy_ok: 'Noise OK',
    introvert: 'Introvert', extrovert: 'Extrovert', mixed: 'Mixed',
    single: 'Single', shared: 'Shared', double: 'Double', no_preference: 'Any',
  }[val] || val);

  return (
    <div>
      <div className="page-header">
        <h1>Allocations</h1>
        <p>AI-assisted matching · Gender-separated buildings · Live view</p>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* ── Building stats banner ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {/* Girls Building */}
        <div style={{ background: 'linear-gradient(135deg,#fdf2f8,#fce7f3)', border: '1.5px solid #f9a8d4', borderRadius: 'var(--radius)', padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#ec4899,#db2777)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#be185d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>♀ Building A — Girls</div>
              <div style={{ fontSize: 11, color: '#9d174d', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>Floors 1 – 5</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#be185d', fontFamily: 'var(--font-mono)' }}>{girlsOccupied}</div>
                  <div style={{ fontSize: 10, color: '#9d174d', fontWeight: 600 }}>Occupied</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>{girlsCap - girlsOccupied}</div>
                  <div style={{ fontSize: 10, color: '#065f46', fontWeight: 600 }}>Available</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#6b7280', fontFamily: 'var(--font-mono)' }}>{girlsCap}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>Total Slots</div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 36, opacity: 0.2 }}>♀</div>
          </div>
          <div style={{ marginTop: 10, height: 5, background: 'rgba(236,72,153,0.15)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#ec4899', width: `${girlsCap ? Math.round((girlsOccupied/girlsCap)*100) : 0}%`, transition: 'width 0.6s' }} />
          </div>
          <div style={{ fontSize: 10, color: '#be185d', marginTop: 4, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{girlsCap ? Math.round((girlsOccupied/girlsCap)*100) : 0}% occupied</div>
        </div>

        {/* Boys Building */}
        <div style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1.5px solid #93c5fd', borderRadius: 'var(--radius)', padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#3b82f6,#1d4ed8)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>♂ Building B — Boys</div>
              <div style={{ fontSize: 11, color: '#1e40af', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>Floors 6 – 10</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1d4ed8', fontFamily: 'var(--font-mono)' }}>{boysOccupied}</div>
                  <div style={{ fontSize: 10, color: '#1e40af', fontWeight: 600 }}>Occupied</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>{boysCap - boysOccupied}</div>
                  <div style={{ fontSize: 10, color: '#065f46', fontWeight: 600 }}>Available</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#6b7280', fontFamily: 'var(--font-mono)' }}>{boysCap}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>Total Slots</div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 36, opacity: 0.2 }}>♂</div>
          </div>
          <div style={{ marginTop: 10, height: 5, background: 'rgba(59,130,246,0.15)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#3b82f6', width: `${boysCap ? Math.round((boysOccupied/boysCap)*100) : 0}%`, transition: 'width 0.6s' }} />
          </div>
          <div style={{ fontSize: 10, color: '#1d4ed8', marginTop: 4, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{boysCap ? Math.round((boysOccupied/boysCap)*100) : 0}% occupied</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>+ Allocate Room</div>
            <form onSubmit={submit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>

                {/* Student dropdown */}
                <div className="form-group">
                  <label>Student *</label>
                  <select value={form.student_id} onChange={handleStudentChange} required>
                    <option value="">Select student</option>
                    {availableStudents.length === 0
                      ? <option disabled>All students already allocated</option>
                      : availableStudents.map(s => (
                          <option key={s.student_id} value={s.student_id}>
                            {genderIcon(s.gender)} {s.full_name} ({s.gender || 'No gender'}) {preferences[s.student_id] ? '✓' : ''}
                          </option>
                        ))
                    }
                  </select>
                </div>

                {/* Gender + building indicator */}
                {selectedStudent && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                    background: selectedBuilding === 'girls' ? '#fdf2f8' : selectedBuilding === 'boys' ? '#eff6ff' : 'var(--bg-3)',
                    border: `1px solid ${selectedBuilding === 'girls' ? '#f9a8d4' : selectedBuilding === 'boys' ? '#93c5fd' : 'var(--border)'}`,
                  }}>
                    <span style={{ fontSize: 20, color: genderColor(selectedGender) }}>{genderIcon(selectedGender)}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: genderColor(selectedGender) }}>
                        {selectedBuilding === 'girls' ? 'Building A — Girls Hostel (Floors 1-5)' :
                         selectedBuilding === 'boys'  ? 'Building B — Boys Hostel (Floors 6-10)' :
                         'Gender not set — showing all rooms'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        Rooms filtered to {selectedBuilding ? `${selectedBuilding === 'girls' ? 'girls' : 'boys'} building only` : 'all buildings'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Preferences summary */}
                {selectedStudentPref && (
                  <div style={{ background: 'linear-gradient(135deg,#f0fdfb,#eff6ff)', border: '1px solid #99e6da', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Room Preferences</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                      {[
                        ['Sleep', selectedStudentPref.sleep_time],
                        ['Wake',  selectedStudentPref.wake_time],
                        ['Study', selectedStudentPref.study_habit],
                        ['Clean', selectedStudentPref.cleanliness],
                        ['Noise', selectedStudentPref.noise_tolerance],
                        ['Social',selectedStudentPref.social_pref],
                        ['Room',  selectedStudentPref.room_type_pref],
                      ].map(([lbl, val]) => val && (
                        <div key={lbl} style={{ fontSize: 11, color: 'var(--text-2)', display: 'flex', gap: 4 }}>
                          <span style={{ color: 'var(--text-4)', minWidth: 46 }}>{lbl}:</span>
                          <span style={{ fontWeight: 600 }}>{prefLabel(val)}</span>
                        </div>
                      ))}
                    </div>
                    {selectedStudentPref.extra_notes && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic' }}>"{selectedStudentPref.extra_notes}"</div>
                    )}
                  </div>
                )}

                {/* AI suggestion */}
                {form.student_id && (
                  <div style={{ border: `1px solid ${aiSuggestion?.type === 'suggestion' ? '#99e6da' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(135deg,#1a2332,#1e3a5f)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🤖</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>AI Room Suggestion</span>
                      {aiLoading && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>Analysing...</span>}
                    </div>
                    <div style={{ padding: '12px 14px', background: '#f8fafc', minHeight: 56 }}>
                      {aiLoading ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {[0,1,2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', opacity: 0.6, animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
                          <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 4 }}>Finding best match in {selectedBuilding === 'girls' ? 'Girls' : 'Boys'} building...</span>
                        </div>
                      ) : aiSuggestion?.type === 'no_prefs' ? (
                        <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 500 }}>⚠ {aiSuggestion.message}</div>
                      ) : aiSuggestion?.type === 'suggestion' ? (
                        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>{aiSuggestion.message}</div>
                      ) : aiSuggestion?.type === 'error' ? (
                        <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Could not load AI suggestion.</div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Room dropdown — filtered by gender building */}
                <div className="form-group">
                  <label>Room * {selectedBuilding && <span style={{ fontSize: 11, color: genderColor(selectedGender), fontWeight: 600 }}>({selectedBuilding === 'girls' ? '♀ Girls Building only' : '♂ Boys Building only'})</span>}</label>
                  <select value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} required>
                    <option value="">Select room</option>
                    {selectableRooms.length === 0
                      ? <option disabled>No available rooms in {selectedBuilding || 'any'} building</option>
                      : selectableRooms.map(r => {
                          const filled = getRoomFilled(r);
                          const slots  = getRoomSlots(r);
                          const label  = filled === 0
                            ? `${r.room_number} — ${r.room_type} · Floor ${getFloor(r)} · ${r.capacity} slots free`
                            : `${r.room_number} — ${r.room_type} · Floor ${getFloor(r)} · ${filled}/${r.capacity} filled · ${slots} slot${slots!==1?'s':''} left`;
                          return <option key={r.room_id} value={r.room_id}>{label}</option>;
                        })
                    }
                  </select>
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
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Current Allocations
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-4)' }}>({allocs.length})</span>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Student</th><th>Gender</th><th>Room</th><th>Type</th><th>Fill</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                  {allocs.length === 0 && <tr><td colSpan={7}><div className="empty">No allocations yet.</div></td></tr>}
                  {allocs.map(a => {
                    const student = students.find(s => s.student_id === a.student_id);
                    const room    = rooms.find(r => r.room_id === a.room_id);
                    const filled  = room ? getRoomFilled(room) : '?';
                    const cap     = room?.capacity || '?';
                    const pct     = (typeof filled === 'number' && typeof cap === 'number') ? Math.round((filled/cap)*100) : 0;
                    const sg      = student?.gender?.toLowerCase();
                    return (
                      <tr key={a.allocation_id}>
                        <td style={{ color: 'var(--text)', fontWeight: 600 }}>{a.full_name}</td>
                        <td>
                          <span style={{ fontSize: 14, color: genderColor(sg), fontWeight: 700 }}>{genderIcon(sg)}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: floorBuilding(getFloor(room||{room_number:a.room_number})) === 'girls' ? '#ec4899' : '#3b82f6' }}>{a.room_number}</td>
                        <td style={{ textTransform: 'capitalize', color: 'var(--text-3)' }}>{a.room_type}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 60 }}>
                            <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 99, background: pct >= 100 ? '#f59e0b' : '#10b981', width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-3)' }}>{filled}/{cap}</span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-4)', fontSize: 12 }}>{a.allocation_date}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => del(a.allocation_id)}>Remove</button></td>
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

          {/* Building tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            {[['girls','♀ Building A — Girls','#ec4899','#fdf2f8'],['boys','♂ Building B — Boys','#3b82f6','#eff6ff']].map(([b, label, color, bg]) => (
              <button key={b} onClick={() => setActiveBuilding(b)} style={{
                flex: 1, padding: '10px 12px', border: 'none', cursor: 'pointer',
                background: activeBuilding === b ? bg : 'white',
                color: activeBuilding === b ? color : 'var(--text-4)',
                fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 12,
                borderRight: b === 'girls' ? '1px solid var(--border)' : 'none',
                transition: 'all 0.15s',
                borderBottom: activeBuilding === b ? `2px solid ${color}` : '2px solid transparent',
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Building stats */}
          {activeBuilding === 'girls' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Total',     val: girlsCap,                    color: '#9d174d', bg: '#fdf2f8', bd: '#f9a8d4' },
                { label: 'Occupied',  val: girlsOccupied,               color: '#ec4899', bg: '#fce7f3', bd: '#f9a8d4' },
                { label: 'Available', val: girlsCap - girlsOccupied,    color: '#10b981', bg: '#ecfdf5', bd: '#6ee7b7' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 7, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: s.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { label: 'Total',     val: boysCap,                   color: '#1e40af', bg: '#eff6ff', bd: '#93c5fd' },
                { label: 'Occupied',  val: boysOccupied,              color: '#3b82f6', bg: '#dbeafe', bd: '#93c5fd' },
                { label: 'Available', val: boysCap - boysOccupied,    color: '#10b981', bg: '#ecfdf5', bd: '#6ee7b7' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 7, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: s.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            {[['Empty','#10b981','#ecfdf5'],['Partial','#f97316','#fff7ed'],['Full','#f59e0b','#fef3c7'],['Maintenance','#ef4444','#fef2f2']].map(([l,c,bg]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `1.5px solid ${c}` }} />
                <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>{l}</span>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />

          {/* Tower floors */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
            {towerFloorNumbers.map(floorNum => {
              const floorRooms    = floorMap[floorNum] || [];
              const floorOccupied = floorRooms.reduce((s, r) => s + getRoomFilled(r), 0);
              const floorCap      = floorRooms.reduce((s, r) => s + r.capacity, 0);
              const floorColor    = activeBuilding === 'girls' ? '#ec4899' : '#3b82f6';

              return (
                <div key={floorNum} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 26, fontSize: 9, fontWeight: 700, color: floorColor, textAlign: 'right', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>F{floorNum}</div>
                  <div style={{
                    flex: 1, borderRadius: 6, padding: '5px 8px',
                    border: `1px solid ${activeBuilding === 'girls' ? 'rgba(236,72,153,0.15)' : 'rgba(59,130,246,0.15)'}`,
                    background: activeBuilding === 'girls' ? 'rgba(253,242,248,0.5)' : 'rgba(239,246,255,0.5)',
                    display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
                  }}>
                    {floorRooms.map(room => {
                      const c       = getRoomStyle(room);
                      const filled  = getRoomFilled(room);
                      const cap     = room.capacity;
                      const fillPct = cap > 0 ? (filled / cap) * 100 : 0;
                      const isHov   = hoveredRoom?.room_id === room.room_id;
                      const isSugg  = aiSuggestion?.recommended_room === room.room_number || aiSuggestion?.alternative_room === room.room_number;
                      return (
                        <div key={room.room_id}
                          onMouseEnter={() => setHoveredRoom(room)}
                          onMouseLeave={() => setHoveredRoom(null)}
                          style={{
                            width: 46, height: 42,
                            background: isSugg ? 'linear-gradient(135deg,rgba(10,184,160,0.2),rgba(37,99,235,0.1))' : c.bg,
                            border: `1.5px solid ${isSugg ? '#0ab8a0' : isHov ? '#0ab8a0' : c.border}`,
                            borderRadius: 5, cursor: 'pointer',
                            transition: 'all 0.15s',
                            transform: isHov ? 'scale(1.1)' : 'scale(1)',
                            boxShadow: isSugg ? '0 0 0 2px rgba(10,184,160,0.3)' : isHov ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                            position: 'relative', zIndex: isHov ? 10 : 1,
                            overflow: 'hidden',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px',
                          }}
                        >
                          <div style={{ fontSize: 7, fontWeight: 700, color: isSugg ? '#0ab8a0' : c.text, lineHeight: 1, textAlign: 'center' }}>{room.room_number}</div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: isSugg ? '#0ab8a0' : c.text, lineHeight: 1, marginTop: 2 }}>
                            {room.status === 'maintenance' ? '🔧' : `${filled}/${cap}`}
                          </div>
                          {room.status !== 'maintenance' && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(0,0,0,0.08)' }}>
                              <div style={{ height: '100%', width: `${fillPct}%`, background: isSugg ? '#0ab8a0' : c.fill, transition: 'width 0.4s' }} />
                            </div>
                          )}
                          {isSugg && <div style={{ position: 'absolute', top: 1, right: 1, width: 6, height: 6, borderRadius: '50%', background: '#0ab8a0' }} />}
                        </div>
                      );
                    })}
                    <div style={{ marginLeft: 'auto', fontSize: 9, color: floorColor, fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', fontWeight: 700 }}>
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
            const fillPct   = cap > 0 ? Math.round((filled/cap)*100) : 0;
            const bld       = floorBuilding(getFloor(hoveredRoom));
            return (
              <div style={{ position: 'fixed', bottom: 28, right: 28, background: '#1a2332', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 18px', zIndex: 1000, minWidth: 230, boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
                <div style={{ fontSize: 10, color: bld === 'girls' ? '#f9a8d4' : '#93c5fd', marginBottom: 6, fontWeight: 700, letterSpacing: '0.06em' }}>
                  {bld === 'girls' ? '♀ Building A — Girls' : '♂ Building B — Boys'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'white', fontFamily: 'var(--font-mono)' }}>{hoveredRoom.room_number}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize' }}>{hoveredRoom.room_type} · Floor {getFloor(hoveredRoom)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: filled >= cap ? '#f59e0b' : '#10b981' }}>{filled}/{cap}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{slots} slot{slots!==1?'s':''} free</div>
                  </div>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: filled >= cap ? '#f59e0b' : filled > 0 ? '#f97316' : '#10b981', width: `${fillPct}%` }} />
                </div>
                {hoveredRoom.status === 'maintenance' ? (
                  <div style={{ background: 'rgba(239,68,68,0.15)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>🔧 Under Maintenance</div>
                ) : occupants.length === 0 ? (
                  <div style={{ background: 'rgba(16,185,129,0.15)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#6ee7b7', fontWeight: 600 }}>✓ Empty — {cap} slot{cap!==1?'s':''} available</div>
                ) : (
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Occupants ({filled}/{cap})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {occupants.map((o, i) => (
                        <div key={o.allocation_id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 8px' }}>
                          <div style={{ width: 20, height: 20, borderRadius: 4, background: bld === 'girls' ? 'rgba(236,72,153,0.25)' : 'rgba(59,130,246,0.25)', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, color: bld === 'girls' ? '#f9a8d4' : '#93c5fd', flexShrink: 0 }}>{i+1}</div>
                          <div>
                            <div style={{ fontSize: 12, color: 'white', fontWeight: 600 }}>{o.full_name}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>Since {o.allocation_date}</div>
                          </div>
                        </div>
                      ))}
                      {slots > 0 && <div style={{ fontSize: 10, color: '#6ee7b7', marginTop: 2, fontWeight: 600 }}>+ {slots} slot{slots!==1?'s':''} still available</div>}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.4); opacity: 1; }
        }
      `}</style>
    </div>
  );
}