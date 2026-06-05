const prisma = require("../src/lib/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "test-secret";

async function clearDatabase() {
  await prisma.attempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.user.deleteMany();
}

async function createUser(overrides = {}) {
  const password = await bcrypt.hash("password123", 10);

  return prisma.user.create({
    data: {
      email: overrides.email || `user${Date.now()}@test.com`,
      name: overrides.name || "Test User",
      password,
    },
  });
}

function createToken(user) {
  return jwt.sign(
    { userId: user.id },
    SECRET,
    { expiresIn: "1h" }
  );
}

module.exports = {
  prisma,
  clearDatabase,
  createUser,
  createToken,
};