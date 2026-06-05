const prisma = require("../src/lib/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "test-secret";

async function clearDatabase() {
  await prisma.$transaction([
    prisma.attempt.deleteMany(),
    prisma.question.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function createUser(overrides = {}) {
  const password = await bcrypt.hash("password123", 10);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return prisma.user.create({
    data: {
      email: overrides.email || `user-${unique}@test.com`,
      name: overrides.name || "Test User",
      password,
    },
  });
}

function createToken(user) {
  return jwt.sign({ userId: user.id }, SECRET, { expiresIn: "1h" });
}

module.exports = {
  prisma,
  clearDatabase,
  createUser,
  createToken,
};