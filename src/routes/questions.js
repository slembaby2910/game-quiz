const express = require("express");
const router = express.Router();
const prisma = require("../lib/prisma");

router.get("/", async (req, res) => {
  const { keyword } = req.query;

  const questions = await prisma.question.findMany({
    where: keyword
      ? {
          question: {
            contains: keyword,
          },
        }
      : {},
    orderBy: { id: "asc" },
  });

  res.json(questions);
});

router.get("/:qId", async (req, res) => {
  const qId = Number(req.params.qId);

  const question = await prisma.question.findUnique({
    where: { id: qId },
  });

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(question);
});

router.post("/", async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({
      message: "Requires both question and answer",
    });
  }

  const newQuestion = await prisma.question.create({
    data: {
      question,
      answer,
    },
  });

  res.status(201).json(newQuestion);
});

router.put("/:qId", async (req, res) => {
  const qId = Number(req.params.qId);
  const { question, answer } = req.body;

  const existing = await prisma.question.findUnique({
    where: { id: qId },
  });

  if (!existing) {
    return res.status(404).json({ message: "Question not found" });
  }

  if (!question || !answer) {
    return res.status(400).json({
      message: "question and answer are required",
    });
  }

  const updated = await prisma.question.update({
    where: { id: qId },
    data: {
      question,
      answer,
    },
  });

  res.json(updated);
});

router.delete("/:qId", async (req, res) => {
  const qId = Number(req.params.qId);

  const existing = await prisma.question.findUnique({
    where: { id: qId },
  });

  if (!existing) {
    return res.status(404).json({ message: "Question not found" });
  }

  const deleted = await prisma.question.delete({
    where: { id: qId },
  });

  res.json({
    message: "Question deleted successfully",
    question: deleted,
  });
});

module.exports = router;