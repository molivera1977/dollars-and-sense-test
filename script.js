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
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

/*************************************************
  NEW READ ALOUD (WORD-BY-WORD HIGHLIGHTING)
*************************************************/
function readAloudWithHighlight(questionEl, choiceButtons) {
  // 1. Stop any current speaking
  window.speechSynthesis.cancel();

  // 2. Build the list of things to read
  const parts = [];

  // Add Question
  parts.push({
    el: questionEl,
    text: questionEl.innerText,
    originalHTML: questionEl.innerHTML // Save original formatting
  });

  // Add Answer Choices (Targeting the span inside the button)
  choiceButtons.forEach((btn, i) => {
    const span = btn.querySelector(".choice-text");
    parts.push({
      el: span,
      text: `Choice ${String.fromCharCode(65 + i)}. ${span.innerText}`,
      originalHTML: span.innerHTML
    });
  });

  let index = 0;

  function speakNext() {
    // If we are done with all parts, stop.
    if (index >= parts.length) return;

    const part = parts[index];
    
    // Create the speech object
    const utterance = new SpeechSynthesisUtterance(part.text);
    utterance.rate = 0.9; 
    
    // --- WORD HIGHLIGHTING LOGIC ---
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        const textLen = part.text.length;
        
        // Find end of current word
        let nextSpace = part.text.indexOf(' ', charIndex + 1);
        if (nextSpace === -1) nextSpace = textLen;
        
        // Split text
        // NOTE: We replace newlines (\n) with <br> so paragraphs don't collapse
        const before = part.text.substring(0, charIndex).replace(/\n/g, "<br>");
        const word = part.text.substring(charIndex, nextSpace);
        const after = part.text.substring(nextSpace).replace(/\n/g, "<br>");

        // Inject the highlight span
        part.el.innerHTML = `${before}<span class="highlight-word">${word}</span>${after}`;
      }
    };

    // When this part finishes...
    utterance.onend = () => {
      // 1. Restore original clean text
      part.el.innerHTML = part.originalHTML;
      // 2. Move to next part
      index++;
      speakNext();
    };

    // Start speaking
    window.speechSynthesis.speak(utterance);
  }

  // Kick off the loop
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
  let choiceIndices = q.choices.map((_, i) => i);
  choiceIndices = shuffle(choiceIndices);

  choiceIndices.forEach((originalIndex) => {
    const choiceText = q.choices[originalIndex];
    
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.innerHTML = `<span class="choice-text">${choiceText}</span>`;
    
    btn.dataset.index = originalIndex;

    btn.onclick = () => {
      if (btn.disabled) return; 
      
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
    const idx = parseInt(btn.dataset.index); 

    if (correct.has(idx)) btn.classList.add("correct");
    if (selected.has(idx) && !correct.has(idx)) btn.classList.add("wrong");
    btn.disabled = true;
  });

  const isCorrect =
    selected.size === correct.size &&
    [...selected].every(i => correct.has(i));

  if (isCorrect) section.correct++;

  saveProgress();

  $("#submitBtn").style.display = "none";
  $("#nextBtn").style.display = "inline-block";
  $("#nextBtn").focus(); 
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
        colors: ['#00578a', '#008b4a', '#f4c542'] 
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