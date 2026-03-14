
async function test() {
  const body = {
    sessionId: "test-session",
    userId: "test-user",
    question: "What is Python?",
    answer: "A programming language.",
    subject: "Python",
    difficulty: "Beginner"
  };

  try {
    const res = await fetch('http://localhost:4000/api/evaluate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response text:', text);
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

test();
