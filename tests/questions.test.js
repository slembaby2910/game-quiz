const request = require("supertest");

const app = require("../src/app");
const { prisma, clearDatabase, createUser, createToken } = require("./helpers");

beforeEach(async () => {
  await clearDatabase();
});

describe("question routes", () => {
  test("returns 401 without token", async () => {
    const res = await request(app).get("/api/questions");

    expect(res.status).toBe(401);
  });

  test("creates a question with valid token", async () => {
    const user = await createUser();
    const token = createToken(user);

    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "What is 2 + 2?",
        answer: "4",
      });

    expect(res.status).toBe(201);
    expect(res.body.question).toBe("What is 2 + 2?");
    expect(res.body.answer).toBe("4");
    expect(res.body.userName).toBe("Test User");
  });

  test("returns 400 for invalid question body", async () => {
    const user = await createUser();
    const token = createToken(user);

    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "",
      });

    expect(res.status).toBe(400);
  });

  test("lists questions with pagination", async () => {
    const user = await createUser();
    const token = createToken(user);

    await prisma.question.create({
      data: {
        question: "Question 1",
        answer: "Answer 1",
        userId: user.id,
      },
    });

    await prisma.question.create({
      data: {
        question: "Question 2",
        answer: "Answer 2",
        userId: user.id,
      },
    });

    const res = await request(app)
      .get("/api/questions?page=1&limit=1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(1);
    expect(res.body.total).toBe(2);
  });

  test("clamps limit above 100 to 100", async () => {
    const user = await createUser();
    const token = createToken(user);

    const res = await request(app)
      .get("/api/questions?limit=999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });

  test("returns 404 for unknown question", async () => {
    const user = await createUser();
    const token = createToken(user);

    const res = await request(app)
      .get("/api/questions/99999")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Question not found");
  });

  test("answers a question correctly", async () => {
    const user = await createUser();
    const token = createToken(user);

    const question = await prisma.question.create({
      data: {
        question: "Capital of Finland?",
        answer: "Helsinki",
        userId: user.id,
      },
    });

    const res = await request(app)
      .post(`/api/questions/${question.id}/play`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        answer: "helsinki",
      });

    expect(res.status).toBe(201);
    expect(res.body.correct).toBe(true);
    expect(res.body.correctAnswer).toBe("Helsinki");
  });

  test("prevents editing another user's question", async () => {
    const owner = await createUser({
      email: "owner@test.com",
      name: "Owner",
    });

    const other = await createUser({
      email: "other@test.com",
      name: "Other",
    });

    const otherToken = createToken(other);

    const question = await prisma.question.create({
      data: {
        question: "Original",
        answer: "Answer",
        userId: owner.id,
      },
    });

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        question: "Changed",
        answer: "Changed answer",
      });

    expect(res.status).toBe(403);
  });

  test("deletes own question", async () => {
    const user = await createUser();
    const token = createToken(user);

    const question = await prisma.question.create({
      data: {
        question: "Delete me",
        answer: "ok",
        userId: user.id,
      },
    });

    const res = await request(app)
      .delete(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Question deleted successfully");

    const deleted = await prisma.question.findUnique({
      where: { id: question.id },
    });

    expect(deleted).toBe(null);
  });
});