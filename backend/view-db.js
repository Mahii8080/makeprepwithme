
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- USERS ---');
  const users = await prisma.user.findMany({
    include: { _count: { select: { sessions: true } } }
  });
  console.table(users.map(u => ({
    id: u.id,
    email: u.email,
    username: u.username,
    sessions: u._count.sessions
  })));

  console.log('\n--- LATEST SESSIONS ---');
  const sessions = await prisma.session.findMany({
    take: 5,
    orderBy: { startedAt: 'desc' },
    include: { feedbacks: true }
  });
  
  console.table(sessions.map(s => ({
    id: s.id,
    subject: s.subject,
    difficulty: s.difficulty,
    score: s.score,
    questions: s.feedbacks.length,
    date: s.startedAt
  })));

  if (sessions.length > 0) {
    console.log('\n--- DETAILED FEEDBACK (Latest Session) ---');
    const latestFeedback = sessions[0].feedbacks;
    console.table(latestFeedback.map(f => ({
      score: f.score,
      feedback: f.feedback.substring(0, 50) + '...',
      suggested: (f.suggestedAnswer || 'N/A').substring(0, 50) + '...'
    })));
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
