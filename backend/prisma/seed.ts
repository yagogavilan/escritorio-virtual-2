import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create office settings
  const office = await prisma.office.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'Nexus Office',
      logo: '',
      primaryColor: '#3b82f6',
      workingHoursEnabled: false,
      workingHoursStart: '08:00',
      workingHoursEnd: '18:00',
    },
  });
  console.log('Created office:', office.name);

  // Create sectors
  const sectors = [
    { name: 'Tecnologia', color: '#3b82f6' },
    { name: 'Vendas', color: '#22c55e' },
    { name: 'Marketing', color: '#f97316' },
    { name: 'RH', color: '#a855f7' },
    { name: 'Financeiro', color: '#eab308' },
  ];

  for (const sectorData of sectors) {
    const sector = await prisma.sector.upsert({
      where: { id: sectorData.name.toLowerCase() },
      update: sectorData,
      create: {
        id: sectorData.name.toLowerCase(),
        ...sectorData,
      },
    });
    console.log('Created sector:', sector.name);
  }

  // Create default rooms
  const rooms = [
    { name: 'Sala de Reunião 1', type: 'fixed' as const, capacity: 10, isRestricted: false, color: '#3b82f6', icon: '🏢' },
    { name: 'Sala de Reunião 2', type: 'fixed' as const, capacity: 8, isRestricted: false, color: '#22c55e', icon: '🏢' },
    { name: 'Sala Privada', type: 'private' as const, capacity: 4, isRestricted: true, color: '#f97316', icon: '🔒' },
    { name: 'Auditório', type: 'fixed' as const, capacity: 50, isRestricted: false, color: '#a855f7', icon: '🎭' },
    { name: 'Café Virtual', type: 'fixed' as const, capacity: 20, isRestricted: false, color: '#eab308', icon: '☕' },
  ];

  for (const roomData of rooms) {
    const room = await prisma.room.upsert({
      where: { id: roomData.name.toLowerCase().replace(/\s+/g, '-') },
      update: roomData,
      create: {
        id: roomData.name.toLowerCase().replace(/\s+/g, '-'),
        ...roomData,
      },
    });
    console.log('Created room:', room.name);
  }

  // Create master user
  const masterEmail = process.env.MASTER_EMAIL || 'admin@example.com';
  const masterUser = await prisma.user.upsert({
    where: { email: masterEmail },
    update: { role: 'master' },
    create: {
      email: masterEmail,
      name: 'Admin',
      role: 'master',
      status: 'offline',
      jobTitle: 'Administrador',
      sectorId: 'tecnologia',
    },
  });
  console.log('Created master user:', masterUser.email);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
