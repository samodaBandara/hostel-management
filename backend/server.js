const express = require('express');
const cors = require('cors');
const { getDb, query, run } = require('./database');
const { scoreRoomsForStudent, loadModel } = require('./knn_compatibility');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let ready = false;
getDb().then(() => {
  ready = true;
  try { loadModel(); console.log('[KNN] Model loaded successfully'); }
  catch (e) { console.warn('[KNN] Model not loaded:', e.message); }
});
app.use((req, res, next) => { if (!ready) return res.status(503).json({ error: 'Starting...' }); next(); });

// ── Fee helpers ───────────────────────────────────────────────
function getFeeForRoomType(room_type) {
  const fees = { single: 10000, shared: 5000, double: 2500 };
  return fees[room_type?.toLowerCase()] || 5000;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getDueDate(monthStr) {
  // Due on 10th of the month
  return `${monthStr}-10`;
}

// Auto-generate monthly fee record for a student if not exists
function ensureMonthlyFee(student_id, month) {
  // Verify student actually exists first
  const studentExists = query('SELECT student_id FROM students WHERE student_id=?', [student_id]);
  if (!studentExists.length) return;
  const exists = query('SELECT record_id FROM monthly_fees WHERE student_id=? AND month=?', [student_id, month]);
  if (exists.length) return;
  // Get student's current room
  const alloc = query(`
    SELECT a.room_id, r.room_type FROM allocations a
    JOIN rooms r ON a.room_id = r.room_id
    WHERE a.student_id = ? LIMIT 1
  `, [student_id]);
  if (!alloc.length) return; // no room, no fee
  const amount = getFeeForRoomType(alloc[0].room_type);
  const due_date = getDueDate(month);
  const now = new Date();
  const dueDate = new Date(due_date);
  const status = now > dueDate ? 'overdue' : 'unpaid';
  run(`INSERT OR IGNORE INTO monthly_fees (student_id, room_id, month, amount, status, due_date) VALUES (?,?,?,?,?,?)`,
    [student_id, alloc[0].room_id, month, amount, status, due_date]);
}

// ── STUDENTS ──────────────────────────────────────────────────

app.get('/api/students', (req, res) => {
  res.json(query('SELECT student_id, full_name, email, phone, gender, address, username, created_at FROM students ORDER BY created_at DESC'));
});

app.post('/api/students', (req, res) => {
  const { full_name, email, phone, gender, address, username, password } = req.body;
  if (!full_name || !email) return res.status(400).json({ error: 'Name and email are required' });
  if (!username) return res.status(400).json({ error: 'Username is required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const existing = query('SELECT student_id FROM students WHERE username=?', [username]);
  if (existing.length) return res.status(400).json({ error: 'Username already taken' });
  try {
    const id = run('INSERT INTO students (full_name, email, phone, gender, address, username, password) VALUES (?,?,?,?,?,?,?)',
      [full_name, email, phone || '', gender || '', address || '', username, password]);
    res.status(201).json({ student_id: id, message: 'Student created' });
  } catch { res.status(400).json({ error: 'Email already exists' }); }
});

app.put('/api/students/:id', (req, res) => {
  const { full_name, email, phone, gender, address, username, password } = req.body;
  if (username) {
    const existing = query('SELECT student_id FROM students WHERE username=? AND student_id!=?', [username, req.params.id]);
    if (existing.length) return res.status(400).json({ error: 'Username already taken' });
  }
  if (password && password.length >= 6) {
    run('UPDATE students SET full_name=?,email=?,phone=?,gender=?,address=?,username=?,password=? WHERE student_id=?',
      [full_name, email, phone || '', gender || '', address || '', username, password, req.params.id]);
  } else {
    run('UPDATE students SET full_name=?,email=?,phone=?,gender=?,address=?,username=? WHERE student_id=?',
      [full_name, email, phone || '', gender || '', address || '', username, req.params.id]);
  }
  res.json({ message: 'Updated' });
});

app.delete('/api/students/:id', (req, res) => {
  run('DELETE FROM students WHERE student_id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// ── ROOMS ─────────────────────────────────────────────────────

app.get('/api/rooms', (req, res) => res.json(query('SELECT * FROM rooms ORDER BY room_number')));

app.post('/api/rooms', (req, res) => {
  const { room_number, room_type, capacity, status, floor } = req.body;
  if (!room_number || !capacity) return res.status(400).json({ error: 'Room number and capacity required' });
  try {
    const id = run('INSERT INTO rooms (room_number,room_type,capacity,status,floor) VALUES (?,?,?,?,?)',
      [room_number, room_type, capacity, status || 'available', floor || 1]);
    res.status(201).json({ room_id: id, message: 'Room created' });
  } catch { res.status(400).json({ error: 'Room number already exists' }); }
});

app.put('/api/rooms/:id', (req, res) => {
  const { room_number, room_type, capacity, status, floor } = req.body;
  run('UPDATE rooms SET room_number=?,room_type=?,capacity=?,status=?,floor=? WHERE room_id=?',
    [room_number, room_type, capacity, status, floor || 1, req.params.id]);
  res.json({ message: 'Updated' });
});

app.delete('/api/rooms/:id', (req, res) => {
  run('DELETE FROM rooms WHERE room_id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// ── ALLOCATIONS ───────────────────────────────────────────────

app.get('/api/allocations', (req, res) => res.json(query(`
  SELECT a.*, s.full_name, r.room_number, r.room_type, r.floor
  FROM allocations a JOIN students s ON a.student_id=s.student_id
  JOIN rooms r ON a.room_id=r.room_id ORDER BY a.allocation_date DESC
`)));

app.post('/api/allocations', (req, res) => {
  const { student_id, room_id, allocation_date } = req.body;
  const room = query('SELECT * FROM rooms WHERE room_id=?', [room_id]);
  if (!room.length) return res.status(404).json({ error: 'Room not found' });
  if (room[0].status === 'occupied') return res.status(400).json({ error: 'Room is occupied' });
  const count = query('SELECT COUNT(*) as c FROM allocations WHERE room_id=?', [room_id])[0].c;
  if (count >= room[0].capacity) return res.status(400).json({ error: 'Room full' });
  const studentRows = query('SELECT gender FROM students WHERE student_id=?', [student_id]);
  const gender = studentRows[0]?.gender?.toLowerCase();
  const floor = room[0].floor || 1;
  const GIRLS_FLOORS = [1, 2, 3, 4, 5], BOYS_FLOORS = [6, 7, 8, 9, 10];
  if (gender === 'female' && BOYS_FLOORS.includes(floor))
    return res.status(400).json({ error: 'Cannot allocate female student to Boys Building (Floors 6-10)' });
  if (gender === 'male' && GIRLS_FLOORS.includes(floor))
    return res.status(400).json({ error: 'Cannot allocate male student to Girls Building (Floors 1-5)' });
  const id = run('INSERT INTO allocations (student_id,room_id,allocation_date) VALUES (?,?,?)', [student_id, room_id, allocation_date]);
  if (count + 1 >= room[0].capacity) run('UPDATE rooms SET status=? WHERE room_id=?', ['occupied', room_id]);
  // Auto-generate this month's fee for the newly allocated student
  ensureMonthlyFee(student_id, getCurrentMonth());
  res.status(201).json({ allocation_id: id });
});

app.delete('/api/allocations/:id', (req, res) => {
  const a = query('SELECT * FROM allocations WHERE allocation_id=?', [req.params.id]);
  if (a.length) {
    run('DELETE FROM allocations WHERE allocation_id=?', [req.params.id]);
    run('UPDATE rooms SET status=? WHERE room_id=?', ['available', a[0].room_id]);
  }
  res.json({ message: 'Removed' });
});

// ── PAYMENTS ──────────────────────────────────────────────────

app.get('/api/payments', (req, res) => res.json(query(`
  SELECT p.*, s.full_name FROM payments p
  JOIN students s ON p.student_id=s.student_id ORDER BY p.payment_date DESC
`)));

app.post('/api/payments', (req, res) => {
  const { student_id, amount, payment_date, status, method, card_last4, card_name, receipt_filename, receipt_data, month } = req.body;
  if (!student_id) return res.status(400).json({ error: 'Student ID is required' });
  const id = run(
    `INSERT INTO payments (student_id, amount, payment_date, status, method, card_last4, card_name, receipt_filename, receipt_data)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [student_id, amount, payment_date, status || 'pending_verification', method || 'manual',
      card_last4 || null, card_name || null, receipt_filename || null, receipt_data || null]
  );
  // Always link to current month fee record
  const targetMonth = month || getCurrentMonth();
  run(`UPDATE monthly_fees SET payment_id=? WHERE student_id=? AND month=? AND status!='paid'`,
    [id, student_id, targetMonth]);
  res.status(201).json({ payment_id: id, message: 'Payment submitted' });
});

app.put('/api/payments/:id', (req, res) => {
  const { status, note } = req.body;
  run('UPDATE payments SET status=?, admin_note=? WHERE payment_id=?', [status, note || null, req.params.id]);
  // If marked received, update monthly fee by student_id for current month
  if (status === 'received') {
    const p = query('SELECT * FROM payments WHERE payment_id=?', [req.params.id]);
    if (p.length) {
      const month = getCurrentMonth();
      // Try by payment_id link first, then fallback to student+month
      run(`UPDATE monthly_fees SET status='paid', payment_id=? WHERE student_id=? AND month=?`,
        [parseInt(req.params.id), p[0].student_id, month]);
    }
  }
  res.json({ message: 'Updated' });
});

app.delete('/api/payments/:id', (req, res) => {
  run('DELETE FROM payments WHERE payment_id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// ── FEES ──────────────────────────────────────────────────────

// GET fee schedule
app.get('/api/fees/schedule', (req, res) => {
  res.json(query('SELECT * FROM fee_schedule'));
});

// GET current month fee for a student
app.get('/api/fees/student/:student_id', (req, res) => {
  const { student_id } = req.params;
  const month = getCurrentMonth();
  ensureMonthlyFee(parseInt(student_id), month);
  const fees = query(`
    SELECT mf.*, r.room_number, r.room_type
    FROM monthly_fees mf JOIN rooms r ON mf.room_id = r.room_id
    WHERE mf.student_id = ?
    ORDER BY mf.month DESC
  `, [student_id]);
  res.json({ current_month: month, fees });
});

// GET all pending/overdue fees (admin/staff)
app.get('/api/fees/pending', (req, res) => {
  // Ensure current month fees exist for all CURRENTLY allocated students
  // Only create for students that actually exist in students table
  const month = getCurrentMonth();
  const students = query(`
    SELECT DISTINCT a.student_id FROM allocations a
    WHERE a.student_id IN (SELECT student_id FROM students)
  `);
  students.forEach(s => ensureMonthlyFee(s.student_id, month));

  const pending = query(`
    SELECT mf.*, s.full_name, s.email, s.phone, r.room_number, r.room_type,
           CASE WHEN mf.due_date < date('now') AND mf.status != 'paid' THEN 1 ELSE 0 END as is_overdue
    FROM monthly_fees mf
    JOIN students s ON mf.student_id = s.student_id
    JOIN rooms r ON mf.room_id = r.room_id
    WHERE mf.status != 'paid'
    ORDER BY mf.month DESC, mf.status DESC, s.full_name ASC
  `);
  res.json(pending);
});

// GET fee summary (admin dashboard)
app.get('/api/fees/summary', (req, res) => {
  const month = getCurrentMonth();
  const students = query(`
    SELECT DISTINCT a.student_id FROM allocations a
    WHERE a.student_id IN (SELECT student_id FROM students)
  `);
  students.forEach(s => ensureMonthlyFee(s.student_id, month));
  res.json({
    current_month: month,
    total_expected: query(`SELECT SUM(amount) as s FROM monthly_fees WHERE month=?`, [month])[0].s || 0,
    total_paid: query(`SELECT SUM(amount) as s FROM monthly_fees WHERE month=? AND status='paid'`, [month])[0].s || 0,
    total_unpaid: query(`SELECT SUM(amount) as s FROM monthly_fees WHERE month=? AND status!='paid'`, [month])[0].s || 0,
    paid_count: query(`SELECT COUNT(*) as c FROM monthly_fees WHERE month=? AND status='paid'`, [month])[0].c,
    unpaid_count: query(`SELECT COUNT(*) as c FROM monthly_fees WHERE month=? AND status='unpaid'`, [month])[0].c,
    overdue_count: query(`SELECT COUNT(*) as c FROM monthly_fees WHERE month=? AND status='overdue'`, [month])[0].c,
  });
});

// ── COMPLAINTS ────────────────────────────────────────────────

app.get('/api/complaints', (req, res) => res.json(query(`
  SELECT c.*, s.full_name FROM complaints c
  JOIN students s ON c.student_id=s.student_id ORDER BY c.created_at DESC
`)));

app.post('/api/complaints', (req, res) => {
  const { student_id, description } = req.body;
  if (!student_id || !description) return res.status(400).json({ error: 'Student and description required' });
  const id = run('INSERT INTO complaints (student_id,description,status) VALUES (?,?,?)', [student_id, description, 'pending']);
  res.status(201).json({ complaint_id: id });
});

app.put('/api/complaints/:id', (req, res) => {
  run('UPDATE complaints SET status=? WHERE complaint_id=?', [req.body.status, req.params.id]);
  res.json({ message: 'Updated' });
});

app.delete('/api/complaints/:id', (req, res) => {
  run('DELETE FROM complaints WHERE complaint_id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// ── PREFERENCES ───────────────────────────────────────────────

app.get('/api/preferences', (req, res) => res.json(query('SELECT * FROM room_preferences ORDER BY created_at DESC')));

app.get('/api/preferences/:student_id', (req, res) => {
  const rows = query('SELECT * FROM room_preferences WHERE student_id=?', [req.params.student_id]);
  if (!rows.length) return res.status(404).json(null);
  res.json(rows[0]);
});

app.post('/api/preferences', (req, res) => {
  const { student_id, sleep_time, wake_time, study_habit, cleanliness, noise_tolerance, social_pref, room_type_pref, extra_notes } = req.body;
  if (!student_id) return res.status(400).json({ error: 'Student ID required' });
  const existing = query('SELECT pref_id FROM room_preferences WHERE student_id=?', [student_id]);
  if (existing.length) {
    run(`UPDATE room_preferences SET sleep_time=?,wake_time=?,study_habit=?,cleanliness=?,noise_tolerance=?,social_pref=?,room_type_pref=?,extra_notes=? WHERE student_id=?`,
      [sleep_time, wake_time, study_habit, cleanliness, noise_tolerance, social_pref, room_type_pref, extra_notes || '', student_id]);
    res.json({ message: 'Preferences updated' });
  } else {
    const id = run(`INSERT INTO room_preferences (student_id,sleep_time,wake_time,study_habit,cleanliness,noise_tolerance,social_pref,room_type_pref,extra_notes) VALUES (?,?,?,?,?,?,?,?,?)`,
      [student_id, sleep_time, wake_time, study_habit, cleanliness, noise_tolerance, social_pref, room_type_pref, extra_notes || '']);
    res.status(201).json({ pref_id: id, message: 'Preferences saved' });
  }
});

// ── AI ROOM SUGGESTION ────────────────────────────────────────

app.post('/api/ai-suggest-room', (req, res) => {
  const { student_id } = req.body;
  if (!student_id) return res.status(400).json({ error: 'Student ID required' });
  const prefRows = query('SELECT * FROM room_preferences WHERE student_id=?', [student_id]);
  if (!prefRows.length) return res.json({ reason: 'no_prefs' });
  const studentPrefs = prefRows[0];
  const studentRow = query('SELECT gender FROM students WHERE student_id=?', [student_id]);
  const gender = studentRow[0]?.gender?.toLowerCase();
  const GIRLS_FLOORS = [1, 2, 3, 4, 5], BOYS_FLOORS = [6, 7, 8, 9, 10];
  let floorFilter = '';
  if (gender === 'female') floorFilter = `AND r.floor IN (${GIRLS_FLOORS.join(',')})`;
  else if (gender === 'male') floorFilter = `AND r.floor IN (${BOYS_FLOORS.join(',')})`;
  const availableRooms = query(`
    SELECT r.room_id, r.room_number, r.room_type, r.capacity, COUNT(a.allocation_id) as occupied_count
    FROM rooms r LEFT JOIN allocations a ON r.room_id=a.room_id
    WHERE r.status!='maintenance' ${floorFilter}
    GROUP BY r.room_id HAVING occupied_count < r.capacity ORDER BY r.room_number
  `);
  const roomsWithOccupants = availableRooms.map(room => {
    const occupants = query(`SELECT s.student_id, s.full_name FROM allocations a JOIN students s ON a.student_id=s.student_id WHERE a.room_id=?`, [room.room_id]);
    return {
      room_id: room.room_id, room_number: room.room_number, room_type: room.room_type,
      capacity: room.capacity, slots_free: room.capacity - room.occupied_count,
      occupants: occupants.map(o => { const prefs = query('SELECT * FROM room_preferences WHERE student_id=?', [o.student_id]); return { name: o.full_name, preferences: prefs[0] || null }; })
    };
  });
  try {
    const scores = scoreRoomsForStudent(studentPrefs, roomsWithOccupants);
    const top = scores[0], second = scores[1];
    res.json({
      recommended_room: top?.room_number || null, compatibility_score: top?.compatibility_score || 0,
      reason: top?.reason || 'No rooms available', room_type: top?.room_type || null,
      slots_free: top?.slots_free || 0, occupant_scores: top?.occupant_scores || [],
      alternative_room: second?.room_number || null, alternative_score: second?.compatibility_score || 0,
      all_scores: scores.slice(0, 5).map(s => ({ room: s.room_number, score: s.compatibility_score, compatible: s.compatible })),
    });
  } catch (err) { res.status(500).json({ error: 'Scoring failed' }); }
});

// ── TRANSFERS ─────────────────────────────────────────────────

function classifyReason(reason) {
  const r = reason.toLowerCase();
  if (r.match(/noise|noisy|loud|sound|disturb/)) return 'noise';
  if (r.match(/clean|dirty|mess|hygiene|smell/)) return 'cleanliness';
  if (r.match(/medical|health|allerg|privacy|personal/)) return 'medical';
  if (r.match(/habit|sleep|study|schedule|incompatib/)) return 'habits';
  if (r.match(/far|distance|floor|location|close|near/)) return 'distance';
  return 'other';
}

app.get('/api/transfers', (req, res) => res.json(query(`
  SELECT t.*, s.full_name as student_name, fr.room_number as from_room_number,
         tr.room_number as to_room_number, sr.room_number as suggested_room_number
  FROM transfer_requests t JOIN students s ON t.student_id=s.student_id
  JOIN rooms fr ON t.from_room_id=fr.room_id
  LEFT JOIN rooms tr ON t.to_room_id=tr.room_id
  LEFT JOIN rooms sr ON t.suggested_room_id=sr.room_id
  ORDER BY t.requested_at DESC
`)));

app.get('/api/transfers/history', (req, res) => res.json(query(`
  SELECT h.*, s.full_name as student_name, fr.room_number as from_room_number, tr.room_number as to_room_number
  FROM transfer_history h JOIN students s ON h.student_id=s.student_id
  JOIN rooms fr ON h.from_room_id=fr.room_id JOIN rooms tr ON h.to_room_id=tr.room_id
  ORDER BY h.transferred_at DESC
`)));

app.get('/api/transfers/student/:student_id', (req, res) => res.json(query(`
  SELECT t.*, fr.room_number as from_room_number, tr.room_number as to_room_number, sr.room_number as suggested_room_number
  FROM transfer_requests t JOIN rooms fr ON t.from_room_id=fr.room_id
  LEFT JOIN rooms tr ON t.to_room_id=tr.room_id LEFT JOIN rooms sr ON t.suggested_room_id=sr.room_id
  WHERE t.student_id=? ORDER BY t.requested_at DESC
`, [req.params.student_id])));

app.post('/api/transfers', (req, res) => {
  const { student_id, reason, initiated_by } = req.body;
  if (!student_id || !reason) return res.status(400).json({ error: 'Student ID and reason required' });
  const alloc = query(`SELECT a.*, r.room_id FROM allocations a JOIN rooms r ON a.room_id=r.room_id WHERE a.student_id=? LIMIT 1`, [student_id]);
  if (!alloc.length) return res.status(400).json({ error: 'Student has no current room allocation' });
  const existing = query(`SELECT transfer_id FROM transfer_requests WHERE student_id=? AND status='pending'`, [student_id]);
  if (existing.length) return res.status(400).json({ error: 'A pending transfer request already exists' });
  const category = classifyReason(reason);
  const id = run(`INSERT INTO transfer_requests (student_id, from_room_id, reason, reason_category, status, initiated_by) VALUES (?,?,?,?,?,?)`,
    [student_id, alloc[0].room_id, reason, category, 'pending', initiated_by || 'student']);
  res.status(201).json({ transfer_id: id, reason_category: category, message: 'Transfer request submitted' });
});

app.post('/api/transfers/suggest', (req, res) => {
  const { student_id, reason } = req.body;
  if (!student_id || !reason) return res.status(400).json({ error: 'Required fields missing' });
  const category = classifyReason(reason);
  const prefRows = query('SELECT * FROM room_preferences WHERE student_id=?', [student_id]);
  const studentRow = query('SELECT gender FROM students WHERE student_id=?', [student_id]);
  const gender = studentRow[0]?.gender?.toLowerCase();
  const GIRLS_FLOORS = [1, 2, 3, 4, 5], BOYS_FLOORS = [6, 7, 8, 9, 10];
  let floorFilter = '';
  if (gender === 'female') floorFilter = `AND r.floor IN (${GIRLS_FLOORS.join(',')})`;
  else if (gender === 'male') floorFilter = `AND r.floor IN (${BOYS_FLOORS.join(',')})`;
  const currentAlloc = query(`SELECT room_id FROM allocations WHERE student_id=? LIMIT 1`, [student_id]);
  const excludeClause = currentAlloc[0]?.room_id ? `AND r.room_id != ${currentAlloc[0].room_id}` : '';
  const availableRooms = query(`
    SELECT r.room_id, r.room_number, r.room_type, r.capacity, COUNT(a.allocation_id) as occupied_count
    FROM rooms r LEFT JOIN allocations a ON r.room_id=a.room_id
    WHERE r.status!='maintenance' ${floorFilter} ${excludeClause}
    GROUP BY r.room_id HAVING occupied_count < r.capacity ORDER BY r.room_number
  `);
  const roomsWithOccupants = availableRooms.map(room => {
    const occupants = query(`SELECT s.student_id, s.full_name FROM allocations a JOIN students s ON a.student_id=s.student_id WHERE a.room_id=?`, [room.room_id]);
    return {
      room_id: room.room_id, room_number: room.room_number, room_type: room.room_type,
      capacity: room.capacity, slots_free: room.capacity - room.occupied_count,
      occupants: occupants.map(o => { const prefs = query('SELECT * FROM room_preferences WHERE student_id=?', [o.student_id]); return { name: o.full_name, preferences: prefs[0] || null }; })
    };
  });
  let studentPrefs = prefRows[0] || {};
  if (category === 'noise') studentPrefs = { ...studentPrefs, noise_tolerance: 'silent' };
  if (category === 'cleanliness') studentPrefs = { ...studentPrefs, cleanliness: 'very_clean' };
  if (category === 'medical') studentPrefs = { ...studentPrefs, room_type_pref: 'single', social_pref: 'introvert' };
  try {
    let scores = roomsWithOccupants.length > 0 ? scoreRoomsForStudent(studentPrefs, roomsWithOccupants) : [];
    if (category === 'distance') scores = scores.sort((a, b) => parseInt(a.room_number?.match(/\d+/)?.[0] || 99) - parseInt(b.room_number?.match(/\d+/)?.[0] || 99));
    if (category === 'medical') { const singles = scores.filter(s => s.room_type === 'single'); if (singles.length) scores = singles; }
    const top = scores[0], second = scores[1];
    const LABELS = { noise: 'Noise Issues', cleanliness: 'Cleanliness Issues', medical: 'Medical / Privacy', habits: 'Incompatible Habits', distance: 'Location / Distance', other: 'General Transfer' };
    res.json({
      category, category_label: LABELS[category] || 'General',
      recommended_room: top?.room_number || null, recommended_room_id: top?.room_id || null,
      compatibility_score: top?.compatibility_score || 0, reason: top?.reason || 'No rooms available',
      room_type: top?.room_type || null,
      alternative_room: second?.room_number || null, alternative_room_id: second?.room_id || null,
      alternative_score: second?.compatibility_score || 0,
      all_scores: scores.slice(0, 5).map(s => ({ room: s.room_number, room_id: s.room_id, score: s.compatibility_score, type: s.room_type })),
    });
  } catch (err) { res.status(500).json({ error: 'Suggestion failed' }); }
});

app.put('/api/transfers/:id/approve', (req, res) => {
  const { to_room_id, admin_note } = req.body;
  if (!to_room_id) return res.status(400).json({ error: 'Target room required' });
  const transfer = query('SELECT * FROM transfer_requests WHERE transfer_id=?', [req.params.id]);
  if (!transfer.length) return res.status(404).json({ error: 'Transfer not found' });
  const t = transfer[0];
  const room = query('SELECT * FROM rooms WHERE room_id=?', [to_room_id]);
  if (!room.length) return res.status(404).json({ error: 'Room not found' });
  const count = query('SELECT COUNT(*) as c FROM allocations WHERE room_id=?', [to_room_id])[0].c;
  if (count >= room[0].capacity) return res.status(400).json({ error: 'Target room is full' });
  const oldAlloc = query('SELECT * FROM allocations WHERE student_id=? AND room_id=?', [t.student_id, t.from_room_id]);
  if (oldAlloc.length) { run('DELETE FROM allocations WHERE allocation_id=?', [oldAlloc[0].allocation_id]); run("UPDATE rooms SET status='available' WHERE room_id=?", [t.from_room_id]); }
  const today = new Date().toISOString().split('T')[0];
  run('INSERT INTO allocations (student_id, room_id, allocation_date) VALUES (?,?,?)', [t.student_id, to_room_id, today]);
  if (count + 1 >= room[0].capacity) run("UPDATE rooms SET status='occupied' WHERE room_id=?", [to_room_id]);
  run(`UPDATE transfer_requests SET status='approved', to_room_id=?, admin_note=?, resolved_at=datetime('now') WHERE transfer_id=?`, [to_room_id, admin_note || '', req.params.id]);
  run(`INSERT INTO transfer_history (student_id, from_room_id, to_room_id, reason, reason_category, initiated_by, admin_note) VALUES (?,?,?,?,?,?,?)`,
    [t.student_id, t.from_room_id, to_room_id, t.reason, t.reason_category, t.initiated_by, admin_note || '']);
  // Update monthly fee for new room
  ensureMonthlyFee(t.student_id, getCurrentMonth());
  res.json({ message: 'Transfer approved' });
});

app.put('/api/transfers/:id/reject', (req, res) => {
  run(`UPDATE transfer_requests SET status='rejected', admin_note=?, resolved_at=datetime('now') WHERE transfer_id=?`, [req.body.admin_note || '', req.params.id]);
  res.json({ message: 'Transfer rejected' });
});

app.delete('/api/transfers/:id', (req, res) => {
  run('DELETE FROM transfer_requests WHERE transfer_id=?', [req.params.id]);
  res.json({ message: 'Transfer request cancelled' });
});

// ── DASHBOARD ─────────────────────────────────────────────────

app.get('/api/dashboard', (req, res) => {
  const month = getCurrentMonth();
  res.json({
    totalStudents: query('SELECT COUNT(*) as c FROM students')[0].c,
    availableRooms: query("SELECT COUNT(*) as c FROM rooms WHERE status='available'")[0].c,
    occupiedRooms: query("SELECT COUNT(*) as c FROM rooms WHERE status='occupied'")[0].c,
    totalRooms: query('SELECT COUNT(*) as c FROM rooms')[0].c,
    pendingComplaints: query("SELECT COUNT(*) as c FROM complaints WHERE status='pending'")[0].c,
    totalPayments: query('SELECT COUNT(*) as c FROM payments')[0].c,
    totalRevenue: query("SELECT SUM(amount) as s FROM payments WHERE status='received'")[0].s || 0,
    pendingTransfers: query("SELECT COUNT(*) as c FROM transfer_requests WHERE status='pending'")[0].c,
    unpaidFees: query(`SELECT COUNT(*) as c FROM monthly_fees WHERE month=? AND status!='paid'`, [month])[0].c,
    overdueFeesAmt: query(`SELECT SUM(amount) as s FROM monthly_fees WHERE status='overdue'`)[0].s || 0,
  });
});

// ── AUTH ──────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const hardcoded = [
    { username: 'admin', password: 'admin123', role: 'admin', name: 'Admin User' },
    { username: 'staff', password: 'staff123', role: 'staff', name: 'Staff Member' },
  ];
  const found = hardcoded.find(u => u.username === username && u.password === password);
  if (found) return res.json({ message: 'Login successful', user: { username: found.username, role: found.role, name: found.name } });
  const rows = query('SELECT student_id, full_name, username, password FROM students WHERE username=?', [username]);
  if (!rows.length || rows[0].password !== password) return res.status(401).json({ error: 'Invalid username or password' });
  const s = rows[0];
  res.json({ message: 'Login successful', user: { username: s.username, role: 'student', name: s.full_name, student_id: s.student_id } });
});

app.listen(5000, () => console.log('Server running on http://localhost:5000'));