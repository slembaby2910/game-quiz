async function login() {
  const email =
    document.getElementById("email").value;

  const password =
    document.getElementById("password").value;

  const res = await fetch(
    CONFIG.ROUTES.LOGIN,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        email,
        password,
      }),
    }
  );

  const data = await res.json();

  localStorage.setItem(
    CONFIG.STORAGE_KEY,
    data.token
  );

  loadQuestions();
}

async function loadQuestions(page = 1) {
  const token = localStorage.getItem(
    CONFIG.STORAGE_KEY
  );

  const res = await fetch(
    `${CONFIG.ROUTES.QUESTIONS}?page=${page}&limit=${CONFIG.QUESTIONS_PER_PAGE}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const result = await res.json();

  const container =
    document.getElementById("questions");

  container.innerHTML = "";

  result.data.forEach((q) => {
    const div = document.createElement("div");

    div.className = "question";

    div.innerHTML = `
      <h3>${q.question}</h3>

      <p>
        By: ${q.userName}
      </p>

      <p>
        Solved:
        ${q.solved ? "✅" : "❌"}
      </p>

      ${
        q.imageUrl
          ? `<img src="${q.imageUrl}" />`
          : ""
      }

      <input
        id="answer-${q.id}"
        placeholder="Your answer"
      />

      <button onclick="playQuestion(${q.id})">
        Submit
      </button>

      <div id="result-${q.id}"></div>
    `;

    container.appendChild(div);
  });
}

async function playQuestion(qId) {
  const token = localStorage.getItem(
    CONFIG.STORAGE_KEY
  );

  const answer =
    document.getElementById(
      `answer-${qId}`
    ).value;

  const res = await fetch(
    `${CONFIG.ROUTES.QUESTIONS}/${qId}/play`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({
        answer,
      }),
    }
  );

  const data = await res.json();

  document.getElementById(
    `result-${qId}`
  ).innerHTML = data.correct
    ? "Correct"
    : `Wrong. Correct answer: ${data.correctAnswer}`;

  loadQuestions();
}