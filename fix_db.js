const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const badBookings = await prisma.booking.findMany({
    where: {
      OR: [
        { status: 'SUCCESS' },
        { status: 'paid' }
      ],
      paymentStatus: {
        not: 'PAID'
      }
    }
  });

  console.log('Bad bookings found:', badBookings.length);
  for (const b of badBookings) {
    console.log(`Fixing booking: ${b.customerName} (ID: ${b.id})`);
    
    // We update paymentStatus to PAID, and amountPaid to totalAmount.
    await prisma.booking.update({
      where: { id: b.id },
      data: {
        paymentStatus: 'PAID',
        amountPaid: b.totalAmount || b.subtotal || 0,
        status: 'paid' // standardize to 'paid'
      }
    });
  }

  console.log('Done!');
  await prisma.$disconnect();
}

fix().catch(console.error);
