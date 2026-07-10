const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function merge() {
  const c1_id = '092d910d-2641-4e0a-b992-319d9f853f30'; // phone: 110505280675952
  const c2_id = '1916490a-84b9-4dcf-8388-047636b55c74'; // phone: 110505280675952@lid

  console.log('Merging c2 into c1...');

  // 1. Remove whatsappLid from c2 to prevent unique constraint error
  await prisma.customer.update({
    where: { id: c2_id },
    data: { whatsappLid: null, phone: 'dummy_' + c2_id }
  });

  // 2. Update c1 with name and whatsappLid from c2
  await prisma.customer.update({
    where: { id: c1_id },
    data: {
      name: 'DANANG',
      whatsappLid: '110505280675952@lid',
      aiPaused: true
    }
  });

  // 3. Move DirectMessages
  await prisma.directMessage.updateMany({
    where: { customerId: c2_id },
    data: { customerId: c1_id }
  });

  // 4. Move Bookings (if any)
  await prisma.booking.updateMany({
    where: { customerId: c2_id },
    data: { customerId: c1_id }
  });

  // 5. Move HandoverSnooze (if any)
  await prisma.handoverSnooze.deleteMany({
    where: { customerId: '110505280675952@lid' }
  });

  // 6. Delete CustomerContext (it's 1-to-1 mapped by phone)
  await prisma.customerContext.deleteMany({
    where: { phone: '110505280675952@lid' }
  });
  // Also delete the dummy one if it got updated
  await prisma.customerContext.deleteMany({
    where: { phone: 'dummy_' + c2_id }
  });

  // 7. Delete c2
  await prisma.customer.delete({
    where: { id: c2_id }
  });

  console.log('Done!');
  await prisma.$disconnect();
}

merge().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
