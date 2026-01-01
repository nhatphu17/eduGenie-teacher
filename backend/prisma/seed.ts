import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create subscription plans
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'FREE' },
    update: {},
    create: {
      name: 'FREE',
      dailyQuota: 5,
      monthlyQuota: 50,
      price: 0,
    },
  });

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { name: 'PRO' },
    update: {},
    create: {
      name: 'PRO',
      dailyQuota: 50,
      monthlyQuota: 1000,
      price: 199000, // VND per month
    },
  });

  console.log('✅ Subscription plans created');

  // Create subjects for THCS (grades 6-9)
  const subjects = [
    { name: 'Toán', grades: [6, 7, 8, 9] },
    { name: 'Ngữ văn', grades: [6, 7, 8, 9] },
    { name: 'Tiếng Anh', grades: [6, 7, 8, 9] },
    { name: 'Vật lý', grades: [6, 7, 8, 9] },
    { name: 'Hóa học', grades: [8, 9] },
    { name: 'Sinh học', grades: [6, 7, 8, 9] },
    { name: 'Lịch sử', grades: [6, 7, 8, 9] },
    { name: 'Địa lý', grades: [6, 7, 8, 9] },
    { name: 'Giáo dục công dân', grades: [6, 7, 8, 9] },
  ];

  for (const subject of subjects) {
    for (const grade of subject.grades) {
      await prisma.subject.upsert({
        where: {
          name_grade: {
            name: subject.name,
            grade,
          },
        },
        update: {},
        create: {
          name: subject.name,
          grade,
        },
      });
    }
  }

  console.log('✅ Subjects created');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

