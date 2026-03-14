
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const count = await prisma.user.count();
    console.log('Successfully connected! User count:', count);
    
    // Test if we can find the tables
    const tables = ['user', 'session', 'question', 'feedback'];
    for (const table of tables) {
        try {
            await prisma[table].findFirst();
            console.log(`Table '${table}' exists and is accessible.`);
        } catch (e) {
            console.error(`Table '${table}' is NOT accessible:`, e.message);
        }
    }
  } catch (error) {
    console.error('Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
