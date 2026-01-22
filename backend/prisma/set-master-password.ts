import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const masterEmail = 'yago.tgavilan@gmail.com';
  const password = 'gavilan12';

  // Find or create master user
  let user = await prisma.user.findUnique({
    where: { email: masterEmail },
  });

  const hashedPassword = await bcrypt.hash(password, 10);

  if (user) {
    // Update existing user
    user = await prisma.user.update({
      where: { email: masterEmail },
      data: {
        password: hashedPassword,
        role: 'master',
        name: user.name || 'Yago Gavilan',
      },
    });
    console.log(`✅ Senha atualizada para o usuário master: ${masterEmail}`);
  } else {
    // Create new master user
    user = await prisma.user.create({
      data: {
        email: masterEmail,
        password: hashedPassword,
        name: 'Yago Gavilan',
        role: 'master',
        status: 'offline',
      },
    });
    console.log(`✅ Usuário master criado: ${masterEmail}`);
  }

  console.log(`📧 Email: ${masterEmail}`);
  console.log(`🔑 Senha: ${password}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
