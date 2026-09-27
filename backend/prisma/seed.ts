import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: {
      email: 'alice@example.com',
      name: 'Alice Johnson',
      passwordHash,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: {
      email: 'bob@example.com',
      name: 'Bob Smith',
      passwordHash,
    },
  });

  const existing = await prisma.event.count({ where: { ownerId: alice.id } });
  if (existing === 0) {
    const meetup = await prisma.event.create({
      data: {
        title: 'Product Launch Meetup',
        description:
          'Join us for demos, networking, and snacks at our downtown studio.',
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        location: 'Bangalore, India',
        capacity: 50,
        ownerId: alice.id,
      },
    });

    await prisma.event.create({
      data: {
        title: 'Weekend Hack Night',
        description: 'Bring a laptop and an idea. Pizza provided.',
        startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        location: 'Online',
        capacity: 30,
        ownerId: bob.id,
      },
    });

    await prisma.rsvp.create({
      data: { eventId: meetup.id, userId: bob.id },
    });
  }

  console.log('Seed complete.');
  console.log('Demo users (password: password123):');
  console.log('  alice@example.com');
  console.log('  bob@example.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
