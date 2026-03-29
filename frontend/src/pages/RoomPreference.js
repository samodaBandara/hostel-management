import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000/api';

const blank = {
  sleep_time: '', wake_time: '', study_habit: '',
  cleanliness: '', noise_tolerance: '', social_pref: '',
  room_type_pref: '', extra_notes: '',
};

// Option groups
const OPTIONS = {
  sleep_time:      { label: 'Sleep Time',        opts: [['early','Early (before 10pm)'], ['late','Late (after midnight)'], ['flexible','Flexible']] },
  wake_time:       { label: 'Wake Up Time',       opts: [['early','Early (before 7am)'],  ['late','Late (after 9am)'],      ['flexible','Flexible']] },
  study_habit:     { label: 'Study Habit',        opts: [['quiet','Need complete quiet'],  ['music','Study with music'],     ['flexible','Flexible']] },
  cleanliness:     { label: 'Cleanliness Level',  opts: [['very_clean','Very clean'],      ['moderate','Moderate'],          ['relaxed','Relaxed']] },
  noise_tolerance: { label: 'Noise Tolerance',    opts: [['silent','Prefer silence'],      ['moderate','Moderate noise ok'], ['noisy_ok','Fine with noise']] },
  social_pref:     { label: 'Social Preference',  opts: [['introvert','Introvert — prefer quiet roommates'], ['extrovert','Extrovert — social is fine'], ['mixed','No preference']] },
  room_type_pref:  { label: 'Preferred Room Type',opts: [['single','Single (private)'],   ['shared','Shared (2 people)'],   ['double','Double (4 people)'], ['no_preference','No preference']] },
};

function OptionCard({ value, label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 14px',
        borderRadius: 'var(--radius-sm)',
        border: `1.5px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
        background: selected ? 'linear-gradient(135deg,rgba(10,184,160,0.08),rgba(37,99,235,0.06))' : 'var(--bg-3)',
        color: selected ? 'var(--teal)' : 'var(--text-3)',
        fontSize: 12, fontWeight: selected ? 700 : 500,
        cursor: 'pointer', transition: 'all 0.15s',
        textAlign: 'left', fontFamily: 'var(--font-ui)',
        boxShadow: selected ? '0 0 0 3px rgba(10,184,160,0.1)' : 'none',
      }}
    >
      {selected ? '✓ ' : ''}{label}
    </button>
  );
}

export default function RoomPreferences({ user }) {
  const [form, setForm]       = useState(blank);
  const [existing, setExisting] = useState(false);
  const [msg, setMsg]         = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  if (!user) {
    try { user = JSON.parse(localStorage.getItem('hms_user')) || {}; } catch { user = {}; }
  }

  const flash = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  useEffect(() => {
    if (!user.student_id) return;
    axios.get(`${API}/preferences/${user.student_id}`)
      .then(r => { if (r.data) { setForm(r.data); setExisting(true); } })
      .catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const required = ['sleep_time','wake_time','study_habit','cleanliness','noise_tolerance','social_pref','room_type_pref'];
    const missing  = required.filter(k => !form[k]);
    if (missing.length) return flash('Please answer all questions before submitting', 'error');
    setLoading(true);
    try {
      await axios.post(`${API}/preferences`, { ...form, student_id: user.student_id });
      flash(existing ? 'Preferences updated!' : 'Preferences saved! Admin will consider these when allocating your room.');
      setExisting(true);
    } catch { flash('Failed to save preferences', 'error'); }
    finally { setLoading(false); }
  };

  const completionPct = Math.round(
    Object.keys(OPTIONS).filter(k => form[k]).length / Object.keys(OPTIONS).length * 100
  );

  return (
    <div>
      <div className="page-header">
        <h1>Room Preferences</h1>
        <p>Help us find the best room and roommates for you</p>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}

      {existing && (
        <div style={{ background: 'linear-gradient(135deg,#f0fdfb,#eff6ff)', border: '1px solid #99e6da', borderRadius: 'var(--radius)', padding: '12px 18px', marginBottom: 20, fontSize: 13, color: 'var(--teal)', fontWeight: 600 }}>
          ✓ Your preferences are saved — admin will use these when allocating your room. You can update them anytime.
        </div>
      )}

      {/* Progress */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ fontWeight: 600, color: 'var(--text-2)' }}>Form Completion</span>
          <span style={{ fontWeight: 700, color: completionPct === 100 ? 'var(--green)' : 'var(--teal)', fontFamily: 'var(--font-mono)' }}>{completionPct}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,var(--teal),var(--blue))', width: `${completionPct}%`, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      <form onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(OPTIONS).map(([key, { label, opts }]) => (
            <div className="card" key={key}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                {form[key]
                  ? <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'linear-gradient(135deg,var(--teal),var(--blue))', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 700 }}>✓</span>
                  : <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', display: 'inline-block' }} />
                }
                {label}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {opts.map(([val, lbl]) => (
                  <OptionCard
                    key={val}
                    value={val}
                    label={lbl}
                    selected={form[key] === val}
                    onClick={() => setForm(f => ({ ...f, [key]: val }))}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Extra notes */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
              Additional Notes <span style={{ fontWeight: 400, color: 'var(--text-4)', fontSize: 12 }}>(optional)</span>
            </div>
            <textarea
              value={form.extra_notes}
              onChange={e => setForm(f => ({ ...f, extra_notes: e.target.value }))}
              placeholder="Any specific requirements, allergies, medical needs, or anything else admin should know..."
              style={{ width: '100%', minHeight: 90 }}
            />
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ padding: '12px 32px', fontSize: 13 }}>
            {loading ? 'Saving...' : existing ? 'Update Preferences' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
}