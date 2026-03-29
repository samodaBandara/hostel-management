import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';
const blank = { room_number: '', room_type: 'single', capacity: '', status: 'available' };

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState('');

  const load = () => axios.get(`${API}/rooms`).then(r => setRooms(r.data));
  useEffect(() => { load(); }, []);
  const flash = m => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editId) { await axios.put(`${API}/rooms/${editId}`, form); flash('Room updated!'); }
      else { await axios.post(`${API}/rooms`, form); flash('Room added!'); }
      setForm(blank); setEditId(null); load();
    } catch (err) { flash(err.response?.data?.error || 'Error'); }
  };

  const del = async (id) => { if (!window.confirm('Delete?')) return; await axios.delete(`${API}/rooms/${id}`); load(); };
  const edit = (r) => { setForm({ room_number: r.room_number, room_type: r.room_type, capacity: r.capacity, status: r.status }); setEditId(r.room_id); };

  const statusBadge = (s) => s === 'available' ? 'badge-green' : 'badge-red';

  return (
    <div>
      <div className="page-header"><h1>Rooms</h1><p>Manage room inventory</p></div>
      {msg && <div className="alert alert-success">{msg}</div>}
      <div className="card">
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group"><label>Room Number</label><input value={form.room_number} onChange={e => setForm({ ...form, room_number: e.target.value })} placeholder="e.g. A101" required /></div>
            <div className="form-group"><label>Type</label>
              <select value={form.room_type} onChange={e => setForm({ ...form, room_type: e.target.value })}>
                <option value="single">Single</option><option value="shared">Shared</option><option value="double">Double</option>
              </select>
            </div>
            <div className="form-group"><label>Capacity</label><input type="number" min="1" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 2" required /></div>
            <div className="form-group"><label>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="available">Available</option><option value="occupied">Occupied</option>
              </select>
            </div>
          </div>
          <div className="btn-group">
            <button className="btn btn-primary" type="submit">{editId ? 'Update Room' : 'Add Room'}</button>
            {editId && <button className="btn btn-secondary" type="button" onClick={() => { setForm(blank); setEditId(null); }}>Cancel</button>}
          </div>
        </form>
        <div className="section-divider" />
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Room No.</th><th>Type</th><th>Capacity</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rooms.length === 0 && <tr><td colSpan={5}><div className="empty">No rooms yet</div></td></tr>}
              {rooms.map(r => (
                <tr key={r.room_id}>
                  <td style={{ color: 'var(--text)', fontWeight: 500 }}>{r.room_number}</td>
                  <td style={{ textTransform: 'capitalize' }}>{r.room_type}</td>
                  <td>{r.capacity}</td>
                  <td><span className={`badge ${statusBadge(r.status)}`}>{r.status}</span></td>
                  <td><div className="btn-group">
                    <button className="btn btn-secondary btn-sm" onClick={() => edit(r)}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => del(r.room_id)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}