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

  test("creates a question with difficulty", async () => {
    const user = await createUser();
    const token = createToken(user);

    const res = await request(app)
      .post("/api/questions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        question: "What is 2 + 2?",
        answer: "4",
        difficulty: "easy",
      });

    expect(res.status).toBe(201);
    expect(res.body.question).toBe("What is 2 + 2?");
    expect(res.body.answer).toBe("4");
    expect(res.body.difficulty).toBe("easy");
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

  test("filters questions by difficulty", async () => {
    const user = await createUser();
    const token = createToken(user);

    await prisma.question.create({
      data: {
        question: "Easy question",
        answer: "easy",
        difficulty: "easy",
        userId: user.id,
      },
    });

    await prisma.question.create({
      data: {
        question: "Hard question",
        answer: "hard",
        difficulty: "hard",
        userId: user.id,
      },
    });

    const res = await request(app)
      .get("/api/questions?difficulty=easy")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].difficulty).toBe("easy");
  });

  test("generates random quiz questions", async () => {
    const user = await createUser();
    const token = createToken(user);

    for (let i = 1; i <= 12; i++) {
      await prisma.question.create({
        data: {
          question: `Question ${i}`,
          answer: `Answer ${i}`,
          difficulty: i % 2 === 0 ? "easy" : "medium",
          userId: user.id,
        },
      });
    }

    const res = await request(app)
      .get("/api/questions/quiz/random?limit=10")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(10);
    expect(res.body.count).toBe(10);
    expect(res.body.data[0].answer).toBeUndefined();
  });

  test("returns leaderboard by correct attempts", async () => {
    const userA = await createUser({
      email: "a@test.com",
      name: "Player A",
    });
    const userB = await createUser({
      email: "b@test.com",
      name: "Player B",
    });

    const token = createToken(userA);

    const question = await prisma.question.create({
      data: {
        question: "Capital of Finland?",
        answer: "Helsinki",
        difficulty: "medium",
        userId: userA.id,
      },
    });

    await prisma.attempt.createMany({
      data: [
        {
          submittedAnswer: "Helsinki",
          correct: true,
          userId: userA.id,
          questionId: question.id,
        },
        {
          submittedAnswer: "Helsinki",
          correct: true,
          userId: userA.id,
          questionId: question.id,
        },
        {
          submittedAnswer: "Wrong",
          correct: false,
          userId: userB.id,
          questionId: question.id,
        },
      ],
    });

    const res = await request(app)
      .get("/api/questions/stats/leaderboard")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toBe("Player A");
    expect(res.body.data[0].correctAttempts).toBe(2);
  });

  test("returns current user statistics", async () => {
    const user = await createUser();
    const token = createToken(user);

    const question = await prisma.question.create({
      data: {
        question: "Capital of Finland?",
        answer: "Helsinki",
        difficulty: "medium",
        userId: user.id,
      },
    });

    await prisma.attempt.createMany({
      data: [
        {
          submittedAnswer: "Helsinki",
          correct: true,
          userId: user.id,
          questionId: question.id,
        },
        {
          submittedAnswer: "Turku",
          correct: false,
          userId: user.id,
          questionId: question.id,
        },
      ],
    });

    const res = await request(app)
      .get("/api/questions/stats/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totalAttempts).toBe(2);
    expect(res.body.correctAttempts).toBe(1);
    expect(res.body.wrongAttempts).toBe(1);
    expect(res.body.accuracy).toBe(50);
  });

  test("lists questions with pagination", async () => {
    const user = await createUser();
    const token = createToken(user);

    await prisma.question.create({
      data: {
        question: "Question 1",
        answer: "Answer 1",
        difficulty: "medium",
        userId: user.id,
      },
    });

    await prisma.question.create({
      data: {
        question: "Question 2",
        answer: "Answer 2",
        difficulty: "medium",
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
        difficulty: "medium",
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
        difficulty: "medium",
        userId: owner.id,
      },
    });

    const res = await request(app)
      .put(`/api/questions/${question.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        question: "Changed",
        answer: "Changed answer",
        difficulty: "hard",
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
        difficulty: "medium",
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