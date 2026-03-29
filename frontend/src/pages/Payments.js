import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

// ── STUDENT: Submit Payment ───────────────────────────────────
function StudentPayments({ user }) {
  const [payments, setPayments] = useState([]);
  const [method, setMethod] = useState('card'); // 'card' | 'receipt'
  const [step, setStep] = useState('form'); // 'form' | 'success'
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const [cardForm, setCardForm] = useState({
    amount: '', payment_date: new Date().toISOString().split('T')[0],
    card_number: '', card_expiry: '', card_cvv: '', card_name: '',
  });

  const [receiptForm, setReceiptForm] = useState({
    amount: '', payment_date: new Date().toISOString().split('T')[0],
    receipt_file: null, receipt_name: '', receipt_preview: '',
  });

  const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };

  useEffect(() => {
    axios.get(`${API}/payments`).then(r => {
      // only show this student's own payments
      setPayments(r.data.filter(p => p.student_id === user.student_id));
    });
  }, []);

  const reload = () => axios.get(`${API}/payments`).then(r => {
    setPayments(r.data.filter(p => p.student_id === user.student_id));
  });

  const handleReceiptFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setReceiptForm(f => ({ ...f, receipt_file: ev.target.result, receipt_name: file.name, receipt_preview: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const submitCard = async (e) => {
    e.preventDefault();
    if (cardForm.card_number.replace(/\s/g, '').length < 16) return flash('Enter a valid 16-digit card number', 'error');
    if (!cardForm.card_expiry.match(/^\d{2}\/\d{2}$/)) return flash('Expiry format: MM/YY', 'error');
    if (cardForm.card_cvv.length < 3) return flash('CVV must be 3 digits', 'error');
    setLoading(true);
    try {
      await axios.post(`${API}/payments`, {
        student_id: user.student_id,
        amount: cardForm.amount,
        payment_date: cardForm.payment_date,
        status: 'pending_verification',
        method: 'card',
        card_last4: cardForm.card_number.replace(/\s/g, '').slice(-4),
        card_name: cardForm.card_name,
      });
      setStep('success'); reload();
    } catch { flash('Submission failed', 'error'); }
    finally { setLoading(false); }
  };

  const submitReceipt = async (e) => {
    e.preventDefault();
    if (!receiptForm.receipt_file) return flash('Please upload a receipt image', 'error');
    setLoading(true);
    try {
      await axios.post(`${API}/payments`, {
        student_id: user.student_id,
        amount: receiptForm.amount,
        payment_date: receiptForm.payment_date,
        status: 'pending_verification',
        method: 'receipt',
        receipt_filename: receiptForm.receipt_name,
        receipt_data: receiptForm.receipt_file,
      });
      setStep('success'); reload();
    } catch { flash('Submission failed', 'error'); }
    finally { setLoading(false); }
  };

  const formatCard = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const statusStyle = (s) => {
    if (s === 'received')             return 'badge-green';
    if (s === 'rejected')             return 'badge-red';
    if (s === 'pending_verification') return 'badge-amber';
    return 'badge-teal';
  };

  const statusLabel = (s) => {
    if (s === 'pending_verification') return 'Pending Verification';
    if (s === 'received')             return 'Received';
    if (s === 'rejected')             return 'Rejected';
    return s;
  };

  if (step === 'success') return (
    <div>
      <div className="page-header"><h1>Payments</h1><p>Payment portal</p></div>
      <div className="card" style={{ maxWidth: 520, margin: '40px auto', textAlign: 'center', padding: '48px 40px' }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', letterSpacing: '0.04em', marginBottom: 10, textTransform: 'uppercase' }}>
          Payment Submitted
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 32, lineHeight: 1.7 }}>
          Your payment is pending verification by admin.<br />You will be notified once it is confirmed.
        </div>
        <button className="btn btn-primary" onClick={() => { setStep('form'); setCardForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], card_number: '', card_expiry: '', card_cvv: '', card_name: '' }); setReceiptForm({ amount: '', payment_date: new Date().toISOString().split('T')[0], receipt_file: null, receipt_name: '', receipt_preview: '' }); }}>
          Make Another Payment
        </button>
      </div>

      {/* Payment history */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>My Payment History</div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Amount</th><th>Date</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={4}><div className="empty">No payments yet</div></td></tr>}
              {payments.map(p => (
                <tr key={p.payment_id}>
                  <td style={{ color: 'var(--cyan)', fontFamily: 'var(--font-data)' }}>Rs. {Number(p.amount).toLocaleString()}</td>
                  <td>{p.payment_date}</td>
                  <td><span className="badge badge-blue">{p.method || 'manual'}</span></td>
                  <td><span className={`badge ${statusStyle(p.status)}`}>{statusLabel(p.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header"><h1>Payments</h1><p>Submit your hostel payment</p></div>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      <div className="card" style={{ maxWidth: 560, marginBottom: 24 }}>
        {/* Method toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          {['card', 'receipt'].map(m => (
            <button key={m} onClick={() => setMethod(m)} style={{
              flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
              background: method === m ? 'rgba(0,229,255,0.08)' : 'transparent',
              color: method === m ? 'var(--cyan)' : 'var(--text-4)',
              fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 11,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              borderRight: m === 'card' ? '1px solid var(--border)' : 'none',
              transition: 'all 0.15s',
            }}>
              {m === 'card' ? '💳  Pay by Card' : '🧾  Upload Receipt'}
            </button>
          ))}
        </div>

        {/* Card form */}
        {method === 'card' && (
          <form onSubmit={submitCard}>
            {/* Visual card preview */}
            <div style={{
              background: 'linear-gradient(135deg, #0d1f33 0%, #172030 50%, #0a1520 100%)',
              border: '1px solid var(--border-2)', borderRadius: 12,
              padding: '24px', marginBottom: 24, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--cyan), var(--blue))' }} />
              <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 16, textTransform: 'uppercase' }}>Hostel Payment Card</div>
              <div style={{ fontSize: 18, fontFamily: 'var(--font-data)', color: 'var(--text)', letterSpacing: '0.2em', marginBottom: 20 }}>
                {cardForm.card_number || '•••• •••• •••• ••••'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 3 }}>CARD HOLDER</div>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{cardForm.card_name || 'YOUR NAME'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 3 }}>EXPIRES</div>
                  <div style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>{cardForm.card_expiry || 'MM/YY'}</div>
                </div>
                <div style={{ fontSize: 28, opacity: 0.4 }}>◎</div>
              </div>
            </div>

            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Card Number</label>
                <input value={cardForm.card_number} onChange={e => setCardForm({ ...cardForm, card_number: formatCard(e.target.value) })} placeholder="1234 5678 9012 3456" maxLength={19} required />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Card Holder Name</label>
                <input value={cardForm.card_name} onChange={e => setCardForm({ ...cardForm, card_name: e.target.value })} placeholder="As on card" required />
              </div>
              <div className="form-group">
                <label>Expiry (MM/YY)</label>
                <input value={cardForm.card_expiry} onChange={e => {
                  let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                  setCardForm({ ...cardForm, card_expiry: v });
                }} placeholder="MM/YY" maxLength={5} required />
              </div>
              <div className="form-group">
                <label>CVV</label>
                <input type="password" value={cardForm.card_cvv} onChange={e => setCardForm({ ...cardForm, card_cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })} placeholder="•••" maxLength={3} required />
              </div>
              <div className="form-group">
                <label>Amount (Rs.)</label>
                <input type="number" value={cardForm.amount} onChange={e => setCardForm({ ...cardForm, amount: e.target.value })} placeholder="5000" required />
              </div>
              <div className="form-group">
                <label>Payment Date</label>
                <input type="date" value={cardForm.payment_date} onChange={e => setCardForm({ ...cardForm, payment_date: e.target.value })} required />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
              {loading ? 'Processing...' : '→  Submit Payment'}
            </button>
            <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', marginTop: 10, textAlign: 'center' }}>
              🔒 This is a demo — no real transaction will occur
            </div>
          </form>
        )}

        {/* Receipt form */}
        {method === 'receipt' && (
          <form onSubmit={submitReceipt}>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="form-group">
                <label>Amount (Rs.)</label>
                <input type="number" value={receiptForm.amount} onChange={e => setReceiptForm({ ...receiptForm, amount: e.target.value })} placeholder="5000" required />
              </div>
              <div className="form-group">
                <label>Payment Date</label>
                <input type="date" value={receiptForm.payment_date} onChange={e => setReceiptForm({ ...receiptForm, payment_date: e.target.value })} required />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Bank Slip / Receipt Image</label>
                <input type="file" accept="image/*,.pdf" onChange={handleReceiptFile}
                  style={{ padding: '8px', cursor: 'pointer' }} required />
              </div>
            </div>

            {/* Preview */}
            {receiptForm.receipt_preview && (
              <div style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ fontSize: 9, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', padding: '6px 10px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Receipt Preview — {receiptForm.receipt_name}
                </div>
                {receiptForm.receipt_preview.startsWith('data:image') ? (
                  <img src={receiptForm.receipt_preview} alt="receipt" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', background: 'var(--bg-3)', display: 'block' }} />
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>📄 {receiptForm.receipt_name}</div>
                )}
              </div>
            )}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Uploading...' : '→  Submit Receipt'}
            </button>
          </form>
        )}
      </div>

      {/* History */}
      <div className="card">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>My Payment History</div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Amount</th><th>Date</th><th>Method</th><th>Status</th></tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={4}><div className="empty">No payments yet</div></td></tr>}
              {payments.map(p => (
                <tr key={p.payment_id}>
                  <td style={{ color: 'var(--cyan)', fontFamily: 'var(--font-data)' }}>Rs. {Number(p.amount).toLocaleString()}</td>
                  <td>{p.payment_date}</td>
                  <td><span className="badge badge-blue">{p.method || 'manual'}</span></td>
                  <td><span className={`badge ${statusStyle(p.status)}`}>{statusLabel(p.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN: Manage Payments ────────────────────────────────────
function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [selected, setSelected] = useState(null); // payment detail modal
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });

  const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 3000); };

  const load = () => axios.get(`${API}/payments`).then(r => setPayments(r.data));
  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/payments/${id}`, { status, note });
      flash(`Payment marked as ${statusLabel(status)}`);
      setSelected(null); setNote(''); load();
    } catch { flash('Update failed', 'error'); }
  };

  const statusStyle = (s) => {
    if (s === 'received')             return 'badge-green';
    if (s === 'rejected')             return 'badge-red';
    if (s === 'pending_verification') return 'badge-amber';
    return 'badge-teal';
  };

  const statusLabel = (s) => {
    if (s === 'pending_verification') return 'Pending Verification';
    if (s === 'received')             return 'Received';
    if (s === 'rejected')             return 'Rejected';
    return s;
  };

  const pending = payments.filter(p => p.status === 'pending_verification');
  const others  = payments.filter(p => p.status !== 'pending_verification');

  return (
    <div>
      <div className="page-header"><h1>Payments</h1><p>Review and verify student payments</p></div>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {/* Pending verification */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', boxShadow: '0 0 8px var(--amber)', display: 'inline-block' }} />
            Awaiting Verification ({pending.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {pending.map(p => (
              <div key={p.payment_id} className="card" style={{ cursor: 'pointer', border: '1px solid rgba(255,184,0,0.2)' }} onClick={() => { setSelected(p); setNote(''); }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{p.full_name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)' }}>{p.payment_date}</div>
                  </div>
                  <span className="badge badge-amber">Pending</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 20, fontFamily: 'var(--font-data)', color: 'var(--cyan)' }}>Rs. {Number(p.amount).toLocaleString()}</div>
                  <span className="badge badge-blue">{p.method || 'manual'}</span>
                </div>
                {p.method === 'card' && p.card_last4 && (
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', marginTop: 10 }}>
                    Card ending •••• {p.card_last4} · {p.card_name}
                  </div>
                )}
                {p.method === 'receipt' && p.receipt_filename && (
                  <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', marginTop: 10 }}>
                    📎 {p.receipt_filename}
                  </div>
                )}
                <div style={{ marginTop: 12, fontSize: 10, color: 'var(--cyan)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>Click to review →</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All payments table */}
      <div className="card">
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>All Payments</div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Student</th><th>Amount</th><th>Date</th><th>Method</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={6}><div className="empty">No payments yet</div></td></tr>}
              {payments.map(p => (
                <tr key={p.payment_id}>
                  <td style={{ color: 'var(--text)', fontWeight: 600 }}>{p.full_name}</td>
                  <td style={{ color: 'var(--cyan)', fontFamily: 'var(--font-data)' }}>Rs. {Number(p.amount).toLocaleString()}</td>
                  <td>{p.payment_date}</td>
                  <td><span className="badge badge-blue">{p.method || 'manual'}</span></td>
                  <td><span className={`badge ${statusStyle(p.status)}`}>{statusLabel(p.status)}</span></td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(p); setNote(''); }}>Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-2)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payment Review</div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {/* Student info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Student',  val: selected.full_name },
                { label: 'Amount',   val: `Rs. ${Number(selected.amount).toLocaleString()}`, color: 'var(--cyan)' },
                { label: 'Date',     val: selected.payment_date },
                { label: 'Method',   val: selected.method || 'manual' },
                { label: 'Status',   val: statusLabel(selected.status) },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--text)', fontFamily: 'var(--font-mono)' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Card details */}
            {selected.method === 'card' && (
              <div style={{ background: 'var(--bg-3)', borderRadius: 'var(--radius-sm)', padding: '14px', marginBottom: 20, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Card Details</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', fontFamily: 'var(--font-mono)', lineHeight: 2 }}>
                  <div>Card Number: •••• •••• •••• {selected.card_last4}</div>
                  <div>Card Holder: {selected.card_name}</div>
                </div>
              </div>
            )}

            {/* Receipt preview */}
            {selected.method === 'receipt' && selected.receipt_data && (
              <div style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ fontSize: 9, color: 'var(--text-4)', fontFamily: 'var(--font-mono)', padding: '6px 10px', background: 'var(--bg-3)', borderBottom: '1px solid var(--border)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Receipt — {selected.receipt_filename}
                </div>
                {selected.receipt_data.startsWith('data:image') ? (
                  <img src={selected.receipt_data} alt="receipt" style={{ width: '100%', maxHeight: 300, objectFit: 'contain', background: 'var(--bg-4)', display: 'block' }} />
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>📄 {selected.receipt_filename}</div>
                )}
              </div>
            )}

            {/* Admin note */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Admin Note (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note for this payment..." style={{ minHeight: 60 }} />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => updateStatus(selected.payment_id, 'received')}>
                ✓ Mark Received
              </button>
              <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => updateStatus(selected.payment_id, 'rejected')}>
                ✕ Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ROUTER ────────────────────────────────────────────────────
export default function Payments({ user }) {
  if (!user) {
    try { user = JSON.parse(localStorage.getItem('hms_user')) || {}; } catch { user = {}; }
  }
  if (user.role === 'student') return <StudentPayments user={user} />;
  return <AdminPayments />;
}