const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const questionsRouter = require("./routes/questions");

app.use(express.json());

app.use("/api/questions", questionsRouter);

app.use((req, res) => {
  res.status(404).json({ msg: "Not found" });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});