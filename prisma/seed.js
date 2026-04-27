const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const questions = [
  { question: "What is 2 + 2?", answer: "4" },
  { question: "Capital of Finland?", answer: "Helsinki" },
  { question: "What color is the sky?", answer: "Blue" },
  { question: "What is 5 + 5?", answer: "10" }
];

async function main() {
  const hashedPassword = await bcrypt.hash("1234", 10);

  const user = await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: hashedPassword,
      name: "Admin User",
    },
  });

  console.log("Created user:", user.email);

  for (const q of questions) {
    await prisma.question.create({
      data: {
        question: q.question,
        answer: q.answer,
        userId: user.id, // THIS replaces "userId" in tutorial
      },
    });
  }

  console.log("Seeded questions");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });