// Quick local test of the model output parsing logic from geminiService
function parseModelQuestion(raw) {
  raw = (raw || '').trim();
  // Try to extract JSON first
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed.question === 'string' && parsed.question.trim().length > 0) {
        return parsed.question.trim();
      }
    }
  } catch (e) {
    // fall back
    //console.warn('JSON parse failed', e);
  }
  // Fallback sanitization: pick the first real question-like line.
  let cleanText = raw.replace(/^[\d]+[\.\)]\s*/, '').replace(/^Question\s+[\d]+[\:\-\s]*/, '').trim();
  const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1) Prefer the first line that contains a question mark
  let candidateLine = lines.find(l => l.includes('?'));

  // 2) If none found, look for lines containing common question words
  if (!candidateLine) {
    const questionWordRegex = /\b(what|how|why|explain|describe|define|implement|compare|difference|when|where|which)\b/i;
    candidateLine = lines.find(l => questionWordRegex.test(l));
  }

  // 3) If still none, try to find the first numbered item like "1) ..." or "1. ..."
  if (!candidateLine) {
    const numbered = lines.map(l => l.replace(/^[\d]+[\.)]\s*/, '')).find(l => l && l.length > 5);
    candidateLine = numbered || lines[0] || '';
  }

  candidateLine = (candidateLine || '').replace(/^[\d]+[\.\)]\s*/, '').replace(/^(Question|Q|Ask)[:\s]*/i, '').trim();

  // If the chosen line contains multiple questions in one line, take only the first question up to the first '?'
  if (candidateLine.includes('?')) {
    const firstQ = candidateLine.split('?')[0].trim();
    candidateLine = firstQ ? firstQ + '?' : candidateLine;
  }

  const question = candidateLine ? (candidateLine.endsWith('?') ? candidateLine : candidateLine + '?') : '';

  if (!question || question === '?') return null;
  return question;
}

const samples = [
  `1. What is polymorphism in OOP? 2. Explain encapsulation.`,
  `What is polymorphism in OOP?\nWhat is encapsulation?`,
  `Question: What is a closure in JavaScript?\nQuestion: Explain prototypal inheritance?`,
  `{"question":"Describe how a hash table works?"}`,
  `Here are some questions:\n1) What is Big O?\n2) How do you reverse a linked list?`,
  `What is a REST API? Also, explain GraphQL differences?`,
];

samples.forEach((s, i) => {
  console.log('--- Sample', i + 1, '---');
  console.log(s);
  const parsed = parseModelQuestion(s);
  console.log('Parsed =>', parsed);
  if (i === 4) {
    console.log('--- DEBUG LINES ---');
    const cleanText = s.replace(/^[\d]+[\.\)]\s*/, '').replace(/^Question\s+[\d]+[\:\-\s]*/, '').trim();
    const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    console.log(lines);
  }
  console.log();
});
