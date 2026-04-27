const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

const authenticate = require("../middleware/auth");
const isOwner = require("../middleware/isOwner");

function formatQuestion(q) {
  return {
    id: q.id,
    question: q.question,
    answer: q.answer,
    createdAt: q.createdAt,
    userId: q.userId
  };
}

router.use(authenticate);

router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const questions = await prisma.question.findMany({
    where: keyword
      ? {
          question: {
            contains: keyword
          }
        }
      : {},
    orderBy: { id: "asc" },
  });

  res.json(questions.map(formatQuestion));
});

router.get("/:qId", async (req, res) => {
  const qId = Number(req.params.qId);

  const question = await prisma.question.findUnique({
    where: { id: qId },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(formatQuestion(question));
});

router.post("/", async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({
      message: "Requires both question and answer"
    });
  }

  const newQuestion = await prisma.question.create({
    data: {
      question,
      answer,
      userId: req.user.userId
    }
  });

  res.status(201).json(formatQuestion(newQuestion));
});

router.put("/:qId", isOwner, async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({
      message: "question and answer are required",
    });
  }

  const updated = await prisma.question.update({
    where: { id: Number(req.params.qId) },
    data: {
      question,
      answer,
    },
  });

  res.json(formatQuestion(updated));
});

router.delete("/:qId", isOwner, async (req, res) => {
  const deleted = await prisma.question.delete({
    where: { id: Number(req.params.qId) },
  });

  res.json({
    message: "Question deleted successfully",
    question: formatQuestion(deleted),
  });
});

module.exports = router;