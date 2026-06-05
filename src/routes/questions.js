const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

const multer = require("multer");
const path = require("path");
const { z } = require("zod");

const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");
const { ValidationError, NotFoundError } = require("../lib/errors");

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
});

const PlayInput = z.object({
  answer: z.string().min(1),
});

function formatQuestion(q) {
  return {
    id: q.id,
    question: q.question,
    answer: q.answer,
    imageUrl: q.imageUrl,
    createdAt: q.createdAt,
    userId: q.userId,
    userName: q.user?.name || null,
    solved: q.attempts ? q.attempts.some((a) => a.correct) : false,
  };
}

router.use(authenticate);

router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 5));
  const skip = (page - 1) * limit;

  const where = keyword
    ? {
        question: {
          contains: keyword,
        },
      }
    : {};

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
    data: questions.map(formatQuestion),
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