const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

const multer = require("multer");
const path = require("path");
const { z } = require("zod");

const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const { ValidationError, NotFoundError } = require("../lib/errors");

const difficultyValues = ["easy", "medium", "hard"];

const storage = multer.diskStorage({
  destination: path.join(__dirname, "..", "..", "public", "uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new ValidationError("Only image files are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const QuestionInput = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  difficulty: z.enum(difficultyValues).optional().default("medium"),
});

const PlayInput = z.object({
  answer: z.string().min(1),
});

function formatQuestion(q, options = {}) {
  const hideAnswer = options.hideAnswer || false;

  return {
    id: q.id,
    question: q.question,
    answer: hideAnswer ? undefined : q.answer,
    difficulty: q.difficulty,
    imageUrl: q.imageUrl,
    createdAt: q.createdAt,
    userId: q.userId,
    userName: q.user?.name || null,
    solved: q.attempts ? q.attempts.some((a) => a.correct) : false,
  };
}

function parseDifficulty(value) {
  if (!value) return undefined;

  if (!difficultyValues.includes(value)) {
    throw new ValidationError("difficulty must be easy, medium, or hard");
  }

  return value;
}

router.use(authenticate);

router.get("/quiz/random", async (req, res) => {
  const limit = Math.max(1, Math.min(10, parseInt(req.query.limit) || 10));
  const difficulty = parseDifficulty(req.query.difficulty);

  const where = difficulty ? { difficulty } : {};

  const questions = await prisma.question.findMany({
    where,
    include: {
      user: true,
      attempts: {
        where: { userId: req.user.userId },
      },
    },
  });

  const shuffled = questions.sort(() => Math.random() - 0.5).slice(0, limit);

  res.json({
    data: shuffled.map((q) => formatQuestion(q, { hideAnswer: true })),
    count: shuffled.length,
    limit,
    difficulty: difficulty || null,
  });
});

router.get("/stats/leaderboard", async (req, res) => {
  const grouped = await prisma.attempt.groupBy({
    by: ["userId"],
    where: { correct: true },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: "desc",
      },
    },
    take: 5,
  });

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: grouped.map((g) => g.userId),
      },
    },
  });

  const result = grouped.map((g, index) => {
    const user = users.find((u) => u.id === g.userId);

    return {
      rank: index + 1,
      userId: g.userId,
      name: user?.name || "Unknown",
      correctAttempts: g._count.id,
    };
  });

  res.json({ data: result });
});

router.get("/stats/me", async (req, res) => {
  const totalAttempts = await prisma.attempt.count({
    where: { userId: req.user.userId },
  });

  const correctAttempts = await prisma.attempt.count({
    where: {
      userId: req.user.userId,
      correct: true,
    },
  });

  const wrongAttempts = totalAttempts - correctAttempts;
  const accuracy =
    totalAttempts === 0 ? 0 : Math.round((correctAttempts / totalAttempts) * 100);

  res.json({
    userId: req.user.userId,
    totalAttempts,
    correctAttempts,
    wrongAttempts,
    accuracy,
  });
});

router.get("/", async (req, res) => {
  const { keyword } = req.query;
  const difficulty = parseDifficulty(req.query.difficulty);

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const where = {};

  if (keyword) {
    where.question = {
      contains: keyword,
    };
  }

  if (difficulty) {
    where.difficulty = difficulty;
  }

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        user: true,
        attempts: {
          where: { userId: req.user.userId },
        },
      },
      orderBy: { id: "asc" },
      skip,
      take: limit,
    }),
    prisma.question.count({ where }),
  ]);

  res.json({
    data: questions.map((q) => formatQuestion(q)),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

router.get("/:qId", async (req, res) => {
  const qId = Number(req.params.qId);

  const question = await prisma.question.findUnique({
    where: { id: qId },
    include: {
      user: true,
      attempts: {
        where: { userId: req.user.userId },
      },
    },
  });

  if (!question) {
    throw new NotFoundError("Question not found");
  }

  res.json(formatQuestion(question));
});

router.post("/", upload.single("image"), async (req, res) => {
  const data = QuestionInput.parse(req.body);

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const newQuestion = await prisma.question.create({
    data: {
      question: data.question,
      answer: data.answer,
      difficulty: data.difficulty,
      imageUrl,
      userId: req.user.userId,
    },
    include: {
      user: true,
      attempts: {
        where: { userId: req.user.userId },
      },
    },
  });

  res.status(201).json(formatQuestion(newQuestion));
});

router.put("/:qId", upload.single("image"), isOwner, async (req, res) => {
  const data = QuestionInput.parse(req.body);

  const updateData = {
    question: data.question,
    answer: data.answer,
    difficulty: data.difficulty,
  };

  if (req.file) {
    updateData.imageUrl = `/uploads/${req.file.filename}`;
  }

  const updated = await prisma.question.update({
    where: { id: Number(req.params.qId) },
    data: updateData,
    include: {
      user: true,
      attempts: {
        where: { userId: req.user.userId },
      },
    },
  });

  res.json(formatQuestion(updated));
});

router.delete("/:qId", isOwner, async (req, res) => {
  const qId = Number(req.params.qId);

  await prisma.attempt.deleteMany({
    where: {
      questionId: qId,
    },
  });

  const deleted = await prisma.question.delete({
    where: {
      id: qId,
    },
  });

  res.json({
    message: "Question deleted successfully",
    question: formatQuestion(deleted),
  });
});

router.post("/:qId/play", async (req, res) => {
  const qId = Number(req.params.qId);
  const data = PlayInput.parse(req.body);

  const question = await prisma.question.findUnique({
    where: { id: qId },
  });

  if (!question) {
    throw new NotFoundError("Question not found");
  }

  const correct =
    data.answer.trim().toLowerCase() === question.answer.trim().toLowerCase();

  const attempt = await prisma.attempt.create({
    data: {
      submittedAnswer: data.answer,
      correct,
      userId: req.user.userId,
      questionId: qId,
    },
  });

  res.status(201).json({
    id: attempt.id,
    correct,
    submittedAnswer: attempt.submittedAnswer,
    correctAnswer: question.answer,
    createdAt: attempt.createdAt,
  });
});

router.use((err, req, res, next) => {
  if (
    err instanceof multer.MulterError ||
    err?.message === "Only image files are allowed"
  ) {
    return res.status(400).json({ message: err.message });
  }

  next(err);
});

module.exports = router;