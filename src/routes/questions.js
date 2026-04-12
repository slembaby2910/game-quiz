const express = require("express");
const router = express.Router();
const questions = require("../data/questions");

router.get("/", (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.json(questions);
  }

  const filteredQuestions = questions.filter(q =>
    q.question.toLowerCase().includes(keyword.toLowerCase())
  );

  res.json(filteredQuestions);
});

router.get("/:qId", (req, res) => {
  const qId = Number(req.params.qId);
  const question = questions.find(q => q.id === qId);

  if (!question) {
    return res.status(404).json({ message: "Question not found" });
  }

  res.json(question);
});

router.post("/", (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).json({
      message: "Requires both question and answer"
    });
  }

  const maxId = Math.max(...questions.map(q => q.id), 0);

  const newQuestion = {
    id: questions.length ? maxId + 1 : 1,
    question,
    answer
  };

  questions.push(newQuestion);
  res.status(201).json(newQuestion);
});

router.put("/:qId", (req, res) => {
  const qId = Number(req.params.qId);
  const { question, answer } = req.body;

  const existingQuestion = questions.find(q => q.id === qId);

  if (!existingQuestion) {
    return res.status(404).json({ message: "Question not found" });
  }

  if (!question || !answer) {
    return res.status(400).json({
      message: "question and answer are required"
    });
  }

  existingQuestion.question = question;
  existingQuestion.answer = answer;

  res.json(existingQuestion);
});

router.delete("/:qId", (req, res) => {
  const qId = Number(req.params.qId);
  const questionIndex = questions.findIndex(q => q.id === qId);

  if (questionIndex === -1) {
    return res.status(404).json({ message: "Question not found" });
  }

  const deletedQuestion = questions.splice(questionIndex, 1);

  res.json({
    message: "Question deleted successfully",
    question: deletedQuestion[0]
  });
});

module.exports = router;