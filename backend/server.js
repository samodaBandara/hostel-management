const express = require('express');
const cors = require('cors');
const { getDb, query, run } = require('./database');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let ready = false;
getDb().then(() => { ready = true; });
app.use((req, res, next) => { if (!ready) return res.status(503).json({ error: 'Starting...' }); next(); });

// ── STUDENTS ──────────────────────────────────────────────────

app.get('/api/students', (req, res) => {
  res.json(query('SELECT student_id, full_name, email, phone, gender, address, username, created_at FROM students ORDER BY created_at DESC'));
});

app.post('/api/students', (req, res) => {
  const { full_name, email, phone, gender, address, username, password } = req.body;
  if (!full_name || !email)             return res.status(400).json({ error: 'Name and email are required' });
  if (!username)                        return res.status(400).json({ error: 'Username is required' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = query('SELECT student_id FROM students WHERE username=?', [username]);
  if (existing.length) return res.status(400).json({ error: 'Username already taken' });

  try {
    const id = run(
      'INSERT INTO students (full_name, email, phone, gender, address, username, password) VALUES (?,?,?,?,?,?,?)',
      [full_name, email, phone||'', gender||'', address||'', username, password]
    );
    res.status(201).json({ student_id: id, message: 'Student created' });
  } catch {
    res.status(400).json({ error: 'Email already exists' });
  }
});

app.put('/api/students/:id', (req, res) => {
  const { full_name, email, phone, gender, address, username, password } = req.body;
  if (username) {
    const existing = query('SELECT student_id FROM students WHERE username=? AND student_id!=?', [username, req.params.id]);
    if (existing.length) return res.status(400).json({ error: 'Username already taken' });
  }
  if (password && password.length >= 6) {
    run('UPDATE students SET full_name=?,email=?,phone=?,gender=?,address=?,username=?,password=? WHERE student_id=?',
      [full_name, email, phone||'', gender||'', address||'', username, password, req.params.id]);
  } else {
    run('UPDATE students SET full_name=?,email=?,phone=?,gender=?,address=?,username=? WHERE student_id=?',
      [full_name, email, phone||'', gender||'', address||'', username, req.params.id]);
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
      [room_number, room_type, capacity, status||'available', floor||1]);
    res.status(201).json({ room_id: id, message: 'Room created' });
  } catch { res.status(400).json({ error: 'Room number already exists' }); }
});

app.put('/api/rooms/:id', (req, res) => {
  const { room_number, room_type, capacity, status, floor } = req.body;
  run('UPDATE rooms SET room_number=?,room_type=?,capacity=?,status=?,floor=? WHERE room_id=?',
    [room_number, room_type, capacity, status, floor||1, req.params.id]);
  res.json({ message: 'Updated' });
});

app.delete('/api/rooms/:id', (req, res) => {
  run('DELETE FROM rooms WHERE room_id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// ── ALLOCATIONS ───────────────────────────────────────────────

app.get('/api/allocations', (req, res) => res.json(query(`
  SELECT a.*, s.full_name, r.room_number, r.room_type, r.floor
  FROM allocations a
  JOIN students s ON a.student_id = s.student_id
  JOIN rooms r ON a.room_id = r.room_id
  ORDER BY a.allocation_date DESC
`)));

app.post('/api/allocations', (req, res) => {
  const { student_id, room_id, allocation_date } = req.body;
  const room = query('SELECT * FROM rooms WHERE room_id=?', [room_id]);
  if (!room.length) return res.status(404).json({ error: 'Room not found' });
  if (room[0].status === 'occupied') return res.status(400).json({ error: 'Room is occupied' });
  const count = query('SELECT COUNT(*) as c FROM allocations WHERE room_id=?', [room_id])[0].c;
  if (count >= room[0].capacity) return res.status(400).json({ error: 'Room full' });
  const id = run('INSERT INTO allocations (student_id,room_id,allocation_date) VALUES (?,?,?)', [student_id, room_id, allocation_date]);
  if (count + 1 >= room[0].capacity) run('UPDATE rooms SET status=? WHERE room_id=?', ['occupied', room_id]);
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
  SELECT p.*, s.full_name
  FROM payments p
  JOIN students s ON p.student_id = s.student_id
  ORDER BY p.payment_date DESC
`)));

app.post('/api/payments', (req, res) => {
  const { student_id, amount, payment_date, status, method, card_last4, card_name, receipt_filename, receipt_data } = req.body;

  // student_id is now always sent from the frontend — no fallback needed
  if (!student_id) return res.status(400).json({ error: 'Student ID is required' });

  const id = run(
    `INSERT INTO payments (student_id, amount, payment_date, status, method, card_last4, card_name, receipt_filename, receipt_data)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [student_id, amount, payment_date, status||'pending_verification', method||'manual',
     card_last4||null, card_name||null, receipt_filename||null, receipt_data||null]
  );
  res.status(201).json({ payment_id: id, message: 'Payment submitted' });
});

app.put('/api/payments/:id', (req, res) => {
  const { status, note } = req.body;
  run('UPDATE payments SET status=?, admin_note=? WHERE payment_id=?', [status, note||null, req.params.id]);
  res.json({ message: 'Updated' });
});

app.delete('/api/payments/:id', (req, res) => {
  run('DELETE FROM payments WHERE payment_id=?', [req.params.id]);
  res.json({ message: 'Deleted' });
});

// ── COMPLAINTS ────────────────────────────────────────────────

app.get('/api/complaints', (req, res) => res.json(query(`
  SELECT c.*, s.full_name
  FROM complaints c
  JOIN students s ON c.student_id = s.student_id
  ORDER BY c.created_at DESC
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

// ── DASHBOARD ─────────────────────────────────────────────────

app.get('/api/dashboard', (req, res) => {
  res.json({
    totalStudents:     query('SELECT COUNT(*) as c FROM students')[0].c,
    availableRooms:    query("SELECT COUNT(*) as c FROM rooms WHERE status='available'")[0].c,
    occupiedRooms:     query("SELECT COUNT(*) as c FROM rooms WHERE status='occupied'")[0].c,
    totalRooms:        query('SELECT COUNT(*) as c FROM rooms')[0].c,
    pendingComplaints: query("SELECT COUNT(*) as c FROM complaints WHERE status='pending'")[0].c,
    totalPayments:     query('SELECT COUNT(*) as c FROM payments')[0].c,
    totalRevenue:      query("SELECT SUM(amount) as s FROM payments WHERE status='received'")[0].s || 0,
  });
});

// ── AUTH ──────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  // Hardcoded admin & staff
  const hardcoded = [
    { username: 'admin', password: 'admin123', role: 'admin', name: 'Admin User' },
    { username: 'staff', password: 'staff123', role: 'staff', name: 'Staff Member' },
  ];
  const found = hardcoded.find(u => u.username === username && u.password === password);
  if (found) {
    return res.json({ message: 'Login successful', user: { username: found.username, role: found.role, name: found.name } });
  }

  // DB student login
  const rows = query('SELECT student_id, full_name, username, password FROM students WHERE username=?', [username]);
  if (!rows.length || rows[0].password !== password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const s = rows[0];
  res.json({
    message: 'Login successful',
    user: { username: s.username, role: 'student', name: s.full_name, student_id: s.student_id },
  });
});

// ─────────────────────────────────────────────────────────────
app.listen(5000, () => console.log('Server running on http://localhost:5000'));