/**********************************************
  MAIN SELECTORS & HELPERS
**********************************************/
const $ = sel => document.querySelector(sel);
const app = document.getElementById("app");

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

/**********************************************
  GLOBAL STATE
**********************************************/
let student = "";
let sections = [];
let secIndex = 0;
let selectedIndices = new Set();

let usedCodes = JSON.parse(localStorage.getItem("usedCodes") || "[]");

/**********************************************
  TEST CODES (DOLLARS AND SENSE)
**********************************************/
const validCodes = ["dollars101", "dollars102", "dollars103"];
const teacherCode = "9377";

/**********************************************
  1. NAME SCREEN
**********************************************/
function renderStart() {
  app.innerHTML = `
    <div class="card">
      <h2>Enter Your Name to Begin</h2>
      <input id="name" type="text" placeholder="Type your full name"/>
      <button class="start-btn" id="go">Start Test</button>
    </div>
  `;

  $("#go").onclick = () => {
    student = $("#name").value.trim();
    if (!student) return;
    renderCodeScreen();
  };
}

/**********************************************
  2. TEST CODE SCREEN
**********************************************/
function renderCodeScreen() {
  app.innerHTML = `
    <div class="card">
      <h2>Enter Test Code</h2>
      <input id="testcode" type="text" placeholder="Enter test code"/>
      <button class="start-btn" id="codeGo">Submit Code</button>
    </div>
  `;

  $("#codeGo").onclick = () => {
    let code = $("#testcode").value.trim().toLowerCase();
    if (!code) return;

    if (code === teacherCode) {
      initTest();
      return;
    }

    if (!validCodes.includes(code)) {
      alert("That code is not right. Try again.");
      return;
    }

    if (usedCodes.includes(code)) {
      alert("This code has already been used.");
      return;
    }

    usedCodes.push(code);
    localStorage.setItem("usedCodes", JSON.stringify(usedCodes));

    initTest();
  };
}

/**********************************************
  3. STARTING THE TEST
**********************************************/
function initTest() {
  sections = [
    { title: "Vocabulary",    data: shuffle(window.VOCAB_BANK), i: 0, correct: 0 },
    { title: "Comprehension", data: shuffle(window.COMP_BANK),  i: 0, correct: 0 },
    { title: "Cloze",         data: shuffle(window.CLOZE_BANK), i: 0, correct: 0 },
  ];

  secIndex = 0;
  renderQ();
}

/**********************************************
  HELPER – correct indexes
**********************************************/
function getCorrectIndexes(q) {
  if (Array.isArray(q.answer)) return q.answer.slice();
  if (Array.isArray(q.answers)) return q.answers.slice();
  if (typeof q.answer === "number") return [q.answer];
  return [];
}

/**********************************************
  HELPER – multi-answer check
**********************************************/
function isMultiQuestion(q) {
  const correct = getCorrectIndexes(q);
  if (correct.length > 1) return true;

  const txt = (q.q || "").toLowerCase();
  if (
    txt.includes("choose two") ||
    txt.includes("pick two") ||
    txt.includes("choose 2") ||
    txt.includes("pick 2")
  ) return true;

  return false;
}

/**********************************************
  4. RENDER QUESTION
**********************************************/
function renderQ() {
  let s = sections[secIndex];
  let q = s.data[s.i];
  selectedIndices.clear();

  let total = s.data.length;
  let num = s.i + 1;
  let pct = Math.round((num / total) * 100);

  const correct = getCorrectIndexes(q);
  const multi = isMultiQuestion(q);

  app.innerHTML = `
    <div class="card">
      <div class="progress-container">
        <div class="progress-text">${s.title} – Question ${num} of ${total}</div>
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>

      <p class="prompt">${q.q.replace(/\n/g, "<br>")}</p>
      ${multi ? `<p class="multi-note">(Select ${correct.length} answers.)</p>` : ""}

      <div id="choices"></div>

      <button class="submit" id="sub">Submit</button>
      <button class="next" id="n" style="display:none">Next</button>
    </div>
  `;

  q.choices.forEach((choice, index) => {
    let btn = document.createElement("button");
    btn.className = "choice";
    btn.textContent = choice;

    btn.onclick = () => {
      if (multi) {
        if (selectedIndices.has(index)) {
          selectedIndices.delete(index);
          btn.classList.remove("selected");
        } else {
          selectedIndices.add(index);
          btn.classList.add("selected");
        }
      } else {
        selectedIndices.clear();
        selectedIndices.add(index);
        document.querySelectorAll(".choice").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      }
    };

    $("#choices").appendChild(btn);
  });

  $("#sub").onclick = submitAnswer;
  $("#n").onclick = nextQ;
}

/**********************************************
  5. SUBMIT ANSWER
**********************************************/
function submitAnswer() {
  if (selectedIndices.size === 0) return;

  let s = sections[secIndex];
  let q = s.data[s.i];
  const correct = new Set(getCorrectIndexes(q));

  document.querySelectorAll(".choice").forEach((btn, idx) => {
    if (correct.has(idx)) {
      btn.classList.add("correct");
    }
    if (selectedIndices.has(idx) && !correct.has(idx)) {
      btn.classList.add("wrong");
    }
    btn.disabled = true;
  });

  let isCorrect =
    selectedIndices.size === correct.size &&
    [...selectedIndices].every(i => correct.has(i));

  if (isCorrect) s.correct++;

  $("#sub").style.display = "none";
  $("#n").style.display = "inline-block";
}

/**********************************************
  6. NEXT QUESTION
**********************************************/
function nextQ() {
  let s = sections[secIndex];
  s.i++;

  if (s.i >= s.data.length) {
    secIndex++;
    if (secIndex >= sections.length) {
      return renderResults();
    }
  }

  renderQ();
}

/**********************************************
  7. RESULTS PAGE
**********************************************/
function renderResults() {
  let output = `
    <div class="card">
      <h2>Test Results for ${student}</h2>
  `;

  sections.forEach(sec => {
    let total = sec.data.length;
    let pct = Math.round((sec.correct / total) * 100);

    let grade =
      pct >= 97 ? "A+" :
      pct >= 93 ? "A"  :
      pct >= 90 ? "A−" :
      pct >= 87 ? "B+" :
      pct >= 83 ? "B"  :
      pct >= 80 ? "B−" :
      pct >= 77 ? "C+" :
      pct >= 73 ? "C"  :
      pct >= 70 ? "C−" :
      pct >= 67 ? "D+" :
      pct >= 63 ? "D"  :
      pct >= 60 ? "D−" : "F";

    output += `<p>${sec.title}: ${sec.correct}/${total} (${pct}%) – ${grade}</p>`;
  });

  output += `</div>`;
  app.innerHTML = output;
}

/**********************************************
  START APP
**********************************************/
renderStart();
