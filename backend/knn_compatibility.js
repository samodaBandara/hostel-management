

const fs   = require('fs');
const path = require('path');

let model = null;

function loadModel() {
  if (model) return model;
  const modelPath = path.join(__dirname, 'knn_model.json');
  if (!fs.existsSync(modelPath)) {
    throw new Error('knn_model.json not found. Run the Jupyter notebook first and copy knn_model.json to backend/');
  }
  model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  console.log(`[KNN] Model loaded — K=${model.best_k}, Accuracy=${((model.accuracy||0)*100).toFixed(1)}%, Training samples=${model.training_samples}`);
  return model;
}

// ── Euclidean distance ────────────────────────────────────────
function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

// ── KNN predict with probability ─────────────────────────────
function knnPredict(queryPoint, X_train, y_train, k) {
  const distances = X_train.map((point, i) => ({
    distance: euclideanDistance(queryPoint, point),
    label: y_train[i],
  }));
  distances.sort((a, b) => a.distance - b.distance);
  const kNearest = distances.slice(0, k);
  const votes    = kNearest.reduce((acc, n) => { acc[n.label] = (acc[n.label] || 0) + 1; return acc; }, {});
  const compatibleVotes = votes[1] || 0;
  const total           = kNearest.length;
  return {
    prediction:         compatibleVotes > total / 2 ? 1 : 0,
    compatibilityScore: Math.round((compatibleVotes / total) * 100),
  };
}

// ── Encode preferences → feature vector ──────────────────────
function encodePreferences(prefs, encoders, prefix) {
  const featureOrder = ['sleep', 'wake', 'study', 'clean', 'noise', 'social'];
  const prefKeys     = ['sleep_time', 'wake_time', 'study_habit', 'cleanliness', 'noise_tolerance', 'social_pref'];
  return featureOrder.map((feat, i) => {
    const col     = `${prefix}_${feat}`;
    const val     = prefs[prefKeys[i]];
    const enc     = encoders[col];
    if (!enc) return 0;
    const encoded = enc[val];
    return encoded !== undefined ? encoded : 0;
  });
}

// ── Social preference room-size adjustments ───────────────────
// Introverts should be steered toward single/shared rooms
// Extroverts should be steered toward shared/double rooms
function applySocialRoomAdjustment(score, studentPrefs, room) {
  let adjusted = score;
  const social   = studentPrefs.social_pref;
  const capacity = room.capacity;
  const type     = room.room_type;

  if (social === 'introvert') {
    if (type === 'single')          adjusted += 20; // strong boost — introvert gets own room
    else if (capacity === 2)        adjusted += 8;  // mild boost — small shared is OK
    else if (capacity >= 4)         adjusted -= 25; // strong penalty — too many people
  } else if (social === 'extrovert') {
    if (type === 'single')          adjusted -= 15; // extroverts don't want to be alone
    else if (capacity === 2)        adjusted += 5;  // slight boost
    else if (capacity >= 4)         adjusted += 10; // boost — extroverts like social rooms
  } else {
    // mixed / no preference — slight penalty for extremes
    if (capacity >= 4)              adjusted -= 5;
  }

  return Math.min(100, Math.max(0, adjusted));
}

// ── Build human-readable reason string ───────────────────────
function buildReason(studentPrefs, room, occupantScores, baseScore, finalScore) {
  const social = studentPrefs.social_pref;
  const type   = room.room_type;
  const cap    = room.capacity;

  let reason = '';

  if (occupantScores.length === 0) {
    // Empty room
    const typeMatch = !studentPrefs.room_type_pref ||
                      studentPrefs.room_type_pref === 'no_preference' ||
                      studentPrefs.room_type_pref === type;

    if (social === 'introvert' && type === 'single') {
      reason = `Ideal for an introvert — private single room with no roommates`;
    } else if (social === 'introvert' && cap >= 4) {
      reason = `Not ideal — introvert placed in a ${cap}-person room. Consider a single or shared room`;
    } else if (social === 'extrovert' && type === 'single') {
      reason = `Extrovert may feel isolated in a single room — consider a shared or double room`;
    } else if (typeMatch) {
      reason = `Empty ${type} room matching preferred room type`;
    } else {
      reason = `Empty room available — room type differs from preference`;
    }
  } else {
    const allCompat = occupantScores.every(o => o.prediction === 1);
    const names     = occupantScores.map(o => o.name).join(', ');
    if (allCompat) {
      reason = `Habit-compatible with roommate${occupantScores.length > 1 ? 's' : ''}: ${names}`;
    } else {
      const incompatNames = occupantScores.filter(o => o.prediction === 0).map(o => o.name).join(', ');
      reason = `Habit mismatch with: ${incompatNames}`;
    }
    if (social === 'introvert' && cap >= 4) {
      reason += ` — note: large room may not suit an introvert`;
    } 
  }

  return reason;
}

// ── Main export: predict single pair compatibility 
function predictCompatibility(studentPrefs, roommatePrefs) {
  const { best_k, encoders, X_train, y_train } = loadModel();
  const aFeatures  = encodePreferences(studentPrefs, encoders, 'a');
  const bFeatures  = encodePreferences(roommatePrefs, encoders, 'b');
  const queryPoint = [...aFeatures, ...bFeatures];
  return knnPredict(queryPoint, X_train, y_train, best_k);
}

// ── Main export: score all available rooms for a student ──────
function scoreRoomsForStudent(studentPrefs, roomsWithOccupants) {
  const { best_k, encoders, X_train, y_train } = loadModel();

  const scored = roomsWithOccupants.map(room => {

    // ── Empty room ──────────────────────────────────────────
    if (room.occupants.length === 0) {
      const typeMatch = !studentPrefs.room_type_pref ||
                        studentPrefs.room_type_pref === 'no_preference' ||
                        studentPrefs.room_type_pref === room.room_type;

      let baseScore = typeMatch ? 72 : 52;
      // Apply social preference room-size logic
      baseScore = applySocialRoomAdjustment(baseScore, studentPrefs, room);

      const reason = buildReason(studentPrefs, room, [], baseScore, baseScore);
      return {
        room_id:             room.room_id,
        room_number:         room.room_number,
        room_type:           room.room_type,
        slots_free:          room.slots_free,
        compatibility_score: baseScore,
        compatible:          baseScore >= 50,
        reason,
        occupant_scores: [],
      };
    }

    // ── Room with existing occupants ────────────────────────
    const occupantScores = room.occupants
      .filter(o => o.preferences)
      .map(o => {
        const aVec   = encodePreferences(studentPrefs, encoders, 'a');
        const bVec   = encodePreferences(o.preferences, encoders, 'b');
        const result = knnPredict([...aVec, ...bVec], X_train, y_train, best_k);
        return { name: o.name, ...result };
      });

    // No occupant preferences on file
    if (occupantScores.length === 0) {
      let baseScore = 58;
      baseScore = applySocialRoomAdjustment(baseScore, studentPrefs, room);
      return {
        room_id: room.room_id, room_number: room.room_number,
        room_type: room.room_type, slots_free: room.slots_free,
        compatibility_score: baseScore, compatible: baseScore >= 50,
        reason: 'Existing roommates have no preferences on file',
        occupant_scores: [],
      };
    }

    // Average KNN compatibility score across all occupants
    const avgScore  = Math.round(
      occupantScores.reduce((s, o) => s + o.compatibilityScore, 0) / occupantScores.length
    );
    const allCompat = occupantScores.every(o => o.prediction === 1);
    const typeMatch = !studentPrefs.room_type_pref ||
                      studentPrefs.room_type_pref === 'no_preference' ||
                      studentPrefs.room_type_pref === room.room_type;

    // Type match adjustment
    let finalScore = typeMatch ? Math.min(100, avgScore + 5) : Math.max(0, avgScore - 10);

    // Social preference room-size adjustment
    finalScore = applySocialRoomAdjustment(finalScore, studentPrefs, room);

    const reason = buildReason(studentPrefs, room, occupantScores, avgScore, finalScore);

    return {
      room_id:             room.room_id,
      room_number:         room.room_number,
      room_type:           room.room_type,
      slots_free:          room.slots_free,
      compatibility_score: finalScore,
      compatible:          allCompat && finalScore >= 50,
      reason,
      occupant_scores: occupantScores,
    };
  });

  // Sort best score first
  return scored.sort((a, b) => b.compatibility_score - a.compatibility_score);
}

module.exports = { predictCompatibility, scoreRoomsForStudent, loadModel };