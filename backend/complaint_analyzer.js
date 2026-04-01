// complaint_analyzer.js
// Drop in backend/ folder alongside knn_model.json
// Usage: const { analyzeComplaint } = require('./complaint_analyzer');

const fs   = require('fs');
const path = require('path');

let model = null;

function loadComplaintModel() {
  if (model) return model;
  const modelPath = path.join(__dirname, 'complaint_model.json');
  if (!fs.existsSync(modelPath)) throw new Error('complaint_model.json not found');
  model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
  console.log(`[Complaint KNN] Loaded — Category:${(model.models.category.accuracy*100).toFixed(0)}% Priority:${(model.models.priority.accuracy*100).toFixed(0)}% Sentiment:${(model.models.sentiment.accuracy*100).toFixed(0)}%`);
  return model;
}

// ── Euclidean distance ────────────────────────────────────────
function euclidean(a, b) {
  return Math.sqrt(a.reduce((s, v, i) => s + Math.pow(v - b[i], 2), 0));
}

// ── KNN predict ───────────────────────────────────────────────
function knnPredict(query, X_train, y_train, k, classes) {
  const distances = X_train.map((pt, i) => ({ d: euclidean(query, pt), label: y_train[i] }));
  distances.sort((a, b) => a.d - b.d);
  const votes = {};
  distances.slice(0, k).forEach(n => { votes[n.label] = (votes[n.label] || 0) + 1; });
  const winner   = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  const total    = distances.slice(0, k).length;
  return {
    label:      classes[parseInt(winner[0])],
    confidence: Math.round((winner[1] / total) * 100),
  };
}

// ── Keyword feature extraction ────────────────────────────────
function featurize(text) {
  const { keyword_features } = loadComplaintModel();
  const t = text.toLowerCase();
  return Object.values(keyword_features).map(kws =>
    kws.some(kw => t.includes(kw)) ? 1 : 0
  );
}

// ── Cosine similarity for pattern detection ───────────────────
function cosineSimilarity(a, b) {
  const dot  = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// ── Main: analyze a complaint ─────────────────────────────────
function analyzeComplaint(description, existingComplaints = []) {
  const { models } = loadComplaintModel();
  const features = featurize(description);

  // Predict category
  const catModel  = models.category;
  const category  = knnPredict(features, catModel.X_train, catModel.y_train, catModel.best_k, catModel.classes);

  // Predict priority
  const priModel  = models.priority;
  const priority  = knnPredict(features, priModel.X_train, priModel.y_train, priModel.best_k, priModel.classes);

  // Predict sentiment
  const senModel  = models.sentiment;
  const sentiment = knnPredict(features, senModel.X_train, senModel.y_train, senModel.best_k, senModel.classes);

  // Similar complaints detection (cosine similarity > 0.7)
  const similarComplaints = existingComplaints
    .map(c => ({
      ...c,
      similarity: cosineSimilarity(features, featurize(c.description)),
    }))
    .filter(c => c.similarity > 0.7)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  const isPattern = similarComplaints.length >= 2;

  return {
    category:         category.label,
    category_conf:    category.confidence,
    priority:         priority.label,
    priority_conf:    priority.confidence,
    sentiment:        sentiment.label,
    sentiment_conf:   sentiment.confidence,
    similar_count:    similarComplaints.length,
    is_pattern:       isPattern,
    similar_complaints: similarComplaints.map(c => ({
      complaint_id: c.complaint_id,
      description:  c.description,
      similarity:   Math.round(c.similarity * 100),
    })),
  };
}

module.exports = { analyzeComplaint, loadComplaintModel };