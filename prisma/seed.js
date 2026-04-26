const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const seedQuestions = [
  {
    question: "What is 2 + 2?",
    answer: "4",
  },
  {
    question: "Capital of Finland?",
    answer: "Helsinki",
  },
  {
    question: "What color is the sky?",
    answer: "Blue",
  },
  {
    question: "What is 5 + 5?",
    answer: "10",
  },
];

async function main() {
  await prisma.question.deleteMany();

  for (const q of seedQuestions) {
    await prisma.question.create({
      data: q,
    });
  }

  console.log("Seed data inserted successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });