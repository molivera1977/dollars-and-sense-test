/*************************************************
  SHORTCUTS
*************************************************/
const $ = sel => document.querySelector(sel);
const app = document.getElementById("app");

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

/*************************************************
  READ ALOUD + HIGHLIGHTING (FIXED)
*************************************************/
function readAloudWithHighlight(questionEl, choiceButtons) {
  window.speechSynthesis.cancel();

  const parts = [];

  // Question first
  parts.push({
    el: questionEl,
    text: questionEl.innerText
  });

  // Then each answer choice TEXT span
  choiceButtons.forEach((btn, i) => {
    const span = btn.querySelector(".choice-text");
    parts.push({
      el: span,
      text: `Choice ${String.fromCharCode(65 + i)}. ${span.innerText}`
    });
  });

  let index = 0;

  function speakNext() {
    if (index > 0) {
      parts[index - 1].el.classList.remove("reading-highlight");
    }

    if (index >= parts.length) return;

    const part = parts[index];
    part.el.classList.add("reading-highlight");

    const utterance = new SpeechSynthesisUtterance(part.text);
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onend = () => {
      part.el.classList.remove("reading-highlight");
      index++;
      speakNext();
    };

    speechSynthesis.speak(utterance);
  }

  speakNext();
}

/*************************************************
  GLOBAL STATE
*************************************************/
let studentName = "";
let sections = [];
let sectionIndex = 0;
let selected = new Set();

let usedCodes = JSON.parse(localStorage.getItem("usedCodes") || "[]");

/*************************************************
  TEST CODES
*************************************************/
const studentCodes = ["dollars101", "dollars102", "dollars103"];
const teacherCode = "9377";

/*************************************************
  START SCREEN
*************************************************/
function renderStart() {
  app.innerHTML = `
    <div class="card">
      <h2>Enter Your Name</h2>
      <input id="studentName" type="text" placeholder="Full name">
      <button class="start-btn" id="startBtn">Start</button>
    </div>
  `;

  $("#startBtn").onclick = () => {
    studentName = $("#studentName").value.trim();
    if (!studentName) return;
    renderCodeScreen();
  };
}

/*************************************************
  CODE SCREEN
*************************************************/
function renderCodeScreen() {
  app.innerHTML = `
    <div class="card">
      <h2>Enter Test Code</h2>
      <input id="codeInput" type="text" placeholder="Test code">
      <button class="start-btn" id="codeBtn">Submit</button>
    </div>
  `;

  $("#codeBtn").onclick = () => {
    const code = $("#codeInput").value.trim().toLowerCase();
    if (!code) return;

    if (code === teacherCode) {
      startTest();
      return;
    }

    if (!studentCodes.includes(code)) {
      alert("Incorrect test code.");
      return;
    }

    if (usedCodes.includes(code)) {
      alert("This test code has already been used.");
      return;
    }

    usedCodes.push(code);
    localStorage.setItem("usedCodes", JSON.stringify(usedCodes));
    startTest();
  };
}

/*************************************************
  START TEST
*************************************************/
function startTest() {
  sections = [
    { title: "Vocabulary", data: shuffle([...VOCAB_BANK]), i: 0, correct: 0 },
    { title: "Comprehension", data: shuffle([...COMP_BANK]), i: 0, correct: 0 },
    { title: "Cloze", data: shuffle([...CLOZE_BANK]), i: 0, correct: 0 }
  ];

  sectionIndex = 0;
  renderQuestion();
}

/*************************************************
  HELPERS
*************************************************/
function getCorrectIndexes(q) {
  if (Array.isArray(q.answer)) return q.answer;
  return [q.answer];
}

function isMulti(q) {
  const correct = getCorrectIndexes(q);
  return correct.length > 1 || q.q.toLowerCase().includes("choose two");
}

/*************************************************
  RENDER QUESTION
*************************************************/
function renderQuestion() {
  selected.clear();

  const section = sections[sectionIndex];
  const q = section.data[section.i];
  const total = section.data.length;
  const num = section.i + 1;
  const percent = Math.round((num / total) * 100);
  const correct = getCorrectIndexes(q);
  const multi = isMulti(q);

  app.innerHTML = `
    <div class="card">
      <div class="progress-container">
        <div class="progress-text">
          ${section.title} – Question ${num} of ${total}
        </div>
        <div class="progress-bar" style="width:${percent}%"></div>
      </div>

      <p class="prompt" id="questionText">
        ${q.q.replace(/\n/g, "<br>")}
      </p>

      <button class="read-btn" id="readBtn">
        🔊 Read Question & Answers
      </button>

      ${multi ? `<p class="multi-note">(Select ${correct.length} answers.)</p>` : ""}

      <div id="choices"></div>

      <button class="submit" id="submitBtn">Submit</button>
      <button class="next" id="nextBtn" style="display:none">Next</button>
    </div>
  `;

  $("#readBtn").onclick = () => {
    const qEl = document.getElementById("questionText");
    const choiceBtns = Array.from(document.querySelectorAll(".choice"));
    readAloudWithHighlight(qEl, choiceBtns);
  };

  q.choices.forEach((choice, idx) => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.innerHTML = `<span class="choice-text">${choice}</span>`;

    btn.onclick = () => {
      if (multi) {
        btn.classList.toggle("selected");
        selected.has(idx) ? selected.delete(idx) : selected.add(idx);
      } else {
        selected.clear();
        document.querySelectorAll(".choice").forEach(b => b.classList.remove("selected"));
        selected.add(idx);
        btn.classList.add("selected");
      }
    };

    $("#choices").appendChild(btn);
  });

  $("#submitBtn").onclick = submitAnswer;
  $("#nextBtn").onclick = nextQuestion;
}

/*************************************************
  SUBMIT ANSWER
*************************************************/
function submitAnswer() {
  if (selected.size === 0) return;

  const section = sections[sectionIndex];
  const q = section.data[section.i];
  const correct = new Set(getCorrectIndexes(q));

  document.querySelectorAll(".choice").forEach((btn, idx) => {
    if (correct.has(idx)) btn.classList.add("correct");
    if (selected.has(idx) && !correct.has(idx)) btn.classList.add("wrong");
    btn.disabled = true;
  });

  const isCorrect =
    selected.size === correct.size &&
    [...selected].every(i => correct.has(i));

  if (isCorrect) section.correct++;

  $("#submitBtn").style.display = "none";
  $("#nextBtn").style.display = "inline-block";
}

/*************************************************
  NEXT QUESTION
*************************************************/
function nextQuestion() {
  const section = sections[sectionIndex];
  section.i++;

  if (section.i >= section.data.length) {
    sectionIndex++;
    if (sectionIndex >= sections.length) {
      renderResults();
      return;
    }
  }

  renderQuestion();
}

/*************************************************
  RESULTS
*************************************************/
function renderResults() {
  let html = `
    <div class="card">
      <h2>Test Results</h2>
      <p><strong>${studentName}</strong></p>
  `;

  sections.forEach(sec => {
    const percent = Math.round((sec.correct / sec.data.length) * 100);
    html += `<p>${sec.title}: ${sec.correct}/${sec.data.length} (${percent}%)</p>`;
  });

  html += `</div>`;
  app.innerHTML = html;
}

/*************************************************
  INIT
*************************************************/
renderStart();
