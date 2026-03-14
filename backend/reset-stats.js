
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
  try {
    console.log('Starting raw reset...');
    await prisma.$executeRawUnsafe('DELETE FROM Feedback');
    await prisma.$executeRawUnsafe('DELETE FROM Question');
    await prisma.$executeRawUnsafe('DELETE FROM Session');
    console.log('✅ Successfully reset all database statistics to zero via raw SQL.');
  } catch (error) {
    console.error('❌ Reset failed:', error);
    if (error.message) console.error('Error message:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

reset();
