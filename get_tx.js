const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const txs = await prisma.transaction.findMany({
    where: {
      booking: { customerName: { contains: 'Adin' } }
    }
  });
  console.log(txs);
  await prisma.$disconnect();
}

run().catch(console.error);
