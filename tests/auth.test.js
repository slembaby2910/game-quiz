const request = require("supertest");
const bcrypt = require("bcrypt");

const app = require("../src/app");
const { prisma, clearDatabase } = require("./helpers");

beforeEach(async () => {
  await clearDatabase();
});

describe("auth routes", () => {
  test("registers a user, hashes password, and returns token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "a@test.com",
      password: "password123",
      name: "A",
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));

    const user = await prisma.user.findUnique({
      where: { email: "a@test.com" },
    });

    expect(user).not.toBe(null);
    expect(user.password).not.toBe("password123");
    expect(await bcrypt.compare("password123", user.password)).toBe(true);
  });

  test("returns 400 when register body is invalid", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "a@test.com",
    });

    expect(res.status).toBe(400);
  });

  test("returns 409 for duplicate email", async () => {
    await request(app).post("/api/auth/register").send({
      email: "a@test.com",
      password: "password123",
      name: "A",
    });

    const res = await request(app).post("/api/auth/register").send({
      email: "a@test.com",
      password: "password123",
      name: "A2",
    });

    expect(res.status).toBe(409);
  });

  test("logs in with valid credentials", async () => {
    await request(app).post("/api/auth/register").send({
      email: "a@test.com",
      password: "password123",
      name: "A",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "a@test.com",
      password: "password123",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  test("returns 401 for invalid login credentials", async () => {
    await request(app).post("/api/auth/register").send({
      email: "a@test.com",
      password: "password123",
      name: "A",
    });

    const res = await request(app).post("/api/auth/login").send({
      email: "a@test.com",
      password: "wrongpassword",
    });

    expect(res.status).toBe(401);
  });
});