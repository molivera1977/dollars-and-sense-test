/*************************************************
  SHORTCUTS
*************************************************/
const $ = sel => document.querySelector(sel);
const app = document.getElementById("app");

/*************************************************
  BETTER SHUFFLE (Fisher-Yates Algorithm)
*************************************************/
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  
  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

/*************************************************
  READ ALOUD + HIGHLIGHTING
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
  START SCREEN & PERSISTENCE CHECK
*************************************************/
function renderStart() {
  // Check if there is a saved test in progress
  const savedState = localStorage.getItem("dollars_progress");
  
  let resumeBtnHTML = "";
  if (savedState) {
    resumeBtnHTML = `<button class="start-btn" id="resumeBtn" style="background:var(--accent); color:black; margin-top:10px;">Resume Previous Test</button>`;
  }

  app.innerHTML = `
    <div class="card">
      <h2>Enter Your Name</h2>
      <input id="studentName" type="text" placeholder="Full name">
      <button class="start-btn" id="startBtn">Start New Test</button>
      ${resumeBtnHTML}
    </div>
  `;

  $("#startBtn").onclick = () => {
    studentName = $("#studentName").value.trim();
    if (!studentName) return;
    // If starting new, clear old progress
    localStorage.removeItem("dollars_progress");
    renderCodeScreen();
  };

  if (document.getElementById("resumeBtn")) {
    $("#resumeBtn").onclick = () => {
      const state = JSON.parse(savedState);
      studentName = state.studentName;
      sections = state.sections;
      sectionIndex = state.sectionIndex;
      renderQuestion();
    };
  }
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
  // Shuffle questions at start
  sections = [
    { title: "Vocabulary", data: shuffle([...VOCAB_BANK]), i: 0, correct: 0 },
    { title: "Comprehension", data: shuffle([...COMP_BANK]), i: 0, correct: 0 },
    { title: "Cloze", data: shuffle([...CLOZE_BANK]), i: 0, correct: 0 }
  ];

  sectionIndex = 0;
  saveProgress();
  renderQuestion();
}

function saveProgress() {
  const state = {
    studentName,
    sections,
    sectionIndex
  };
  localStorage.setItem("dollars_progress", JSON.stringify(state));
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
  RENDER QUESTION (SHUFFLED ANSWERS)
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

  // SHUFFLE ANSWER CHOICES LOGIC
  // 1. Create an array of indices [0, 1, 2, 3...]
  let choiceIndices = q.choices.map((_, i) => i);
  // 2. Shuffle the indices
  choiceIndices = shuffle(choiceIndices);

  // 3. Create buttons in the shuffled order
  choiceIndices.forEach((originalIndex) => {
    const choiceText = q.choices[originalIndex];
    
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.innerHTML = `<span class="choice-text">${choiceText}</span>`;
    
    // Store original index for checking answer later
    btn.dataset.index = originalIndex;

    btn.onclick = () => {
      if (btn.disabled) return; // Prevent clicking after submit
      
      if (multi) {
        btn.classList.toggle("selected");
        selected.has(originalIndex) ? selected.delete(originalIndex) : selected.add(originalIndex);
      } else {
        selected.clear();
        document.querySelectorAll(".choice").forEach(b => b.classList.remove("selected"));
        selected.add(originalIndex);
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

  document.querySelectorAll(".choice").forEach((btn) => {
    const idx = parseInt(btn.dataset.index); // Get the original index back

    if (correct.has(idx)) btn.classList.add("correct");
    if (selected.has(idx) && !correct.has(idx)) btn.classList.add("wrong");
    btn.disabled = true;
  });

  const isCorrect =
    selected.size === correct.size &&
    [...selected].every(i => correct.has(i));

  if (isCorrect) section.correct++;

  // Save progress after answering
  saveProgress();

  $("#submitBtn").style.display = "none";
  $("#nextBtn").style.display = "inline-block";
  $("#nextBtn").focus(); // Accessibility focus
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

  saveProgress();
  renderQuestion();
}

/*************************************************
  RESULTS
*************************************************/
function renderResults() {
  // Clear saved progress since test is done
  localStorage.removeItem("dollars_progress");

  let totalCorrect = 0;
  let totalQuestions = 0;

  let html = `
    <div class="card">
      <h2>Test Results</h2>
      <p><strong>${studentName}</strong></p>
  `;

  sections.forEach(sec => {
    const percent = Math.round((sec.correct / sec.data.length) * 100);
    html += `<p>${sec.title}: ${sec.correct}/${sec.data.length} (${percent}%)</p>`;
    totalCorrect += sec.correct;
    totalQuestions += sec.data.length;
  });

  html += `</div>`;
  app.innerHTML = html;

  // CONFETTI REWARD
  const totalPercent = (totalCorrect / totalQuestions) * 100;
  if (totalPercent >= 70) {
    launchConfetti();
  }
}

function launchConfetti() {
  if (typeof confetti === 'function') {
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#00578a', '#008b4a', '#f4c542'] // Brand colors
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#00578a', '#008b4a', '#f4c542']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }
}

/*************************************************
  INIT
*************************************************/
renderStart();