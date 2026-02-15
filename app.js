const DB_KEY = "cbt_ppg_db";
const SESSION_KEY = "cbt_ppg_session";

const defaultDb = {
  admins: [{ username: "admin", password: "admin123" }],
  participants: [],
  questions: [],
  settings: { defaultDuration: 60, defaultQuestionCount: 10 },
  histories: [],
  stats: {}
};

const state = {
  db: loadDb(),
  session: JSON.parse(localStorage.getItem(SESSION_KEY) || "null"),
  activeExam: null,
  editingQuestionId: null,
  adminTab: "bank"
};

const el = {
  authBadge: qs("#authBadge"),
  landingView: qs("#landingView"),
  participantView: qs("#participantView"),
  adminLoginView: qs("#adminLoginView"),
  adminView: qs("#adminView"),
  participantLoginForm: qs("#participantLoginForm"),
  adminLoginForm: qs("#adminLoginForm"),
  participantGreeting: qs("#participantGreeting"),
  examCard: qs("#examCard"),
  historyCard: qs("#historyCard"),
  adminTabBank: qs("#adminTab-bank"),
  adminTabImport: qs("#adminTab-import"),
  adminTabSettings: qs("#adminTab-settings"),
  adminTabHistories: qs("#adminTab-histories"),
  overlay: qs("#overlay"),
  modal: qs("#modal"),
  toast: qs("#toast")
};

bindGlobalEvents();
render();

function bindGlobalEvents() {
  qs("#openAdminLogin").addEventListener("click", () => {
    el.landingView.classList.add("hidden");
    el.adminLoginView.classList.remove("hidden");
  });

  qs("#backToParticipant").addEventListener("click", () => {
    el.adminLoginView.classList.add("hidden");
    el.landingView.classList.remove("hidden");
  });

  el.participantLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = qs("#participantName").value.trim();
    const password = qs("#participantPassword").value.trim();
    if (!username || !password) return;
    let participant = state.db.participants.find((x) => x.username === username);
    if (!participant) {
      participant = { username, password, createdAt: Date.now() };
      state.db.participants.push(participant);
    }
    if (participant.password !== password) return toast("Kata sandi peserta tidak sesuai.");
    state.session = { role: "participant", username };
    persist();
    render();
    toast("Login peserta berhasil.");
  });

  el.adminLoginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = qs("#adminUsername").value.trim();
    const password = qs("#adminPassword").value.trim();
    const found = state.db.admins.some((a) => a.username === username && a.password === password);
    if (!found) return toast("Login admin gagal.");
    state.session = { role: "admin", username };
    persist();
    render();
    toast("Login admin berhasil.");
  });

  qs("#participantLogout").addEventListener("click", logout);
  qs("#adminLogout").addEventListener("click", logout);

  qs("#startExamBtn").addEventListener("click", openExamSetupModal);
  qs("#showHistoryBtn").addEventListener("click", renderParticipantHistory);

  el.overlay.addEventListener("click", closeModal);

  qsa(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.adminTab = btn.dataset.tab;
      qsa(".tab-btn").forEach((x) => x.classList.remove("active"));
      btn.classList.add("active");
      renderAdminTabs();
    });
  });
}

function render() {
  const session = state.session;
  el.authBadge.textContent = session ? `Aktif: ${session.role} (${session.username})` : "Belum login";

  el.landingView.classList.add("hidden");
  el.participantView.classList.add("hidden");
  el.adminLoginView.classList.add("hidden");
  el.adminView.classList.add("hidden");

  if (!session) {
    el.landingView.classList.remove("hidden");
    return;
  }

  if (session.role === "participant") {
    el.participantView.classList.remove("hidden");
    el.participantGreeting.textContent = `Halo ${session.username}, siapkan diri untuk latihan UP PPG.`;
    el.examCard.classList.add("hidden");
    el.historyCard.classList.add("hidden");
    return;
  }

  el.adminView.classList.remove("hidden");
  renderAdminTabs();
}

function renderAdminTabs() {
  [el.adminTabBank, el.adminTabImport, el.adminTabSettings, el.adminTabHistories].forEach((x) => x.classList.add("hidden"));
  if (state.adminTab === "bank") {
    el.adminTabBank.classList.remove("hidden");
    renderBankSoal();
  }
  if (state.adminTab === "import") {
    el.adminTabImport.classList.remove("hidden");
    renderImportSoal();
  }
  if (state.adminTab === "settings") {
    el.adminTabSettings.classList.remove("hidden");
    renderAdminSettings();
  }
  if (state.adminTab === "histories") {
    el.adminTabHistories.classList.remove("hidden");
    renderAdminHistories();
  }
}

function renderBankSoal() {
  const rows = state.db.questions
    .map(
      (q) => `<tr>
        <td><input type="checkbox" class="question-check" value="${q.id}" /></td>
        <td>${escapeHtml(q.category)}</td>
        <td>${escapeHtml(q.text)}</td>
        <td>${Object.entries(q.options).map(([k, v]) => `${k}. ${escapeHtml(v)}`).join("<br>")}</td>
        <td>${q.correct}</td>
        <td>
          <button class="btn btn-secondary" data-action="edit" data-id="${q.id}">Edit</button>
        </td>
      </tr>`
    )
    .join("");

  el.adminTabBank.innerHTML = `
    <div class="row-between">
      <h3>Bank Soal</h3>
      <button id="openQuestionForm" class="btn btn-primary">Tambah Soal</button>
    </div>
    <div class="action-row">
      <label><input type="checkbox" id="selectAllQuestions" /> Pilih semua soal</label>
      <button id="deleteSelectedQuestions" class="btn btn-danger">Hapus Soal Terpilih</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th></th><th>Kategori</th><th>Soal</th><th>Pilihan (A-E)</th><th>Benar</th><th>Aksi</th></tr>
        </thead>
        <tbody>${rows || "<tr><td colspan='6'>Belum ada soal.</td></tr>"}</tbody>
      </table>
    </div>
  `;

  qs("#openQuestionForm").addEventListener("click", () => openQuestionModal());

  qs("#selectAllQuestions").addEventListener("change", (event) => {
    qsa(".question-check").forEach((cb) => {
      cb.checked = event.target.checked;
    });
  });

  qs("#deleteSelectedQuestions").addEventListener("click", () => {
    const selected = qsa(".question-check:checked").map((x) => x.value);
    if (!selected.length) return toast("Pilih soal terlebih dahulu.");
    state.db.questions = state.db.questions.filter((q) => !selected.includes(q.id));
    Object.keys(state.db.stats).forEach((user) => {
      selected.forEach((id) => delete state.db.stats[user][id]);
    });
    persist();
    renderBankSoal();
    toast(`${selected.length} soal dihapus.`);
  });

  qsa("button[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", () => openQuestionModal(btn.dataset.id));
  });
}

function openQuestionModal(questionId = null) {
  state.editingQuestionId = questionId;
  const q = questionId ? state.db.questions.find((x) => x.id === questionId) : null;

  openModal(`
    <h3>${q ? "Edit" : "Tambah"} Soal</h3>
    <form id="questionForm" class="form-grid">
      <label>Kategori <input required name="category" value="${q ? escapeAttribute(q.category) : ""}" /></label>
      <label>Soal <textarea required name="text" rows="4">${q ? escapeHtml(q.text) : ""}</textarea></label>
      ${["A", "B", "C", "D", "E"].map((k) => `<label>Jawaban ${k} <input required name="opt${k}" value="${q ? escapeAttribute(q.options[k]) : ""}" /></label>`).join("")}
      <label>Jawaban Benar
        <select name="correct" required>
          ${["A", "B", "C", "D", "E"].map((k) => `<option value="${k}" ${q && q.correct === k ? "selected" : ""}>${k}</option>`).join("")}
        </select>
      </label>
      <div class="row-between">
        <button type="button" class="btn btn-link" id="cancelQuestionForm">Batal</button>
        <button type="submit" class="btn btn-primary" id="saveQuestionBtn">Simpan</button>
      </div>
    </form>
  `);

  qs("#cancelQuestionForm").addEventListener("click", closeModal);
  qs("#questionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const fd = new FormData(event.target);
    const payload = {
      id: q?.id || uid(),
      category: String(fd.get("category")).trim(),
      text: String(fd.get("text")).trim(),
      options: {
        A: String(fd.get("optA")).trim(),
        B: String(fd.get("optB")).trim(),
        C: String(fd.get("optC")).trim(),
        D: String(fd.get("optD")).trim(),
        E: String(fd.get("optE")).trim()
      },
      correct: String(fd.get("correct")),
      updatedAt: Date.now()
    };

    animateButton(qs("#saveQuestionBtn"));

    setTimeout(() => {
      if (q) {
        const idx = state.db.questions.findIndex((x) => x.id === q.id);
        state.db.questions[idx] = payload;
      } else {
        payload.createdAt = Date.now();
        state.db.questions.push(payload);
      }
      persist();
      closeModal();
      renderBankSoal();
      toast("Soal tersimpan.");
    }, 500);
  });
}

function renderImportSoal() {
  el.adminTabImport.innerHTML = `
    <h3>Impor Soal Cepat</h3>
    <p class="small">Format: Kategori | Soal | Jawaban A | Jawaban B | Jawaban C | Jawaban D | Jawaban E | Jawaban Benar. Pisahkan antar soal dengan 1 baris kosong.</p>
    <textarea id="bulkImportInput" rows="12" placeholder="Profesional | Pertanyaan ... | Pilihan A ... | ... | B"></textarea>
    <div class="row-between">
      <span class="small">Tip: gunakan huruf A-E sebagai jawaban benar.</span>
      <button id="importNowBtn" class="btn btn-primary">Impor Sekarang</button>
    </div>
  `;

  qs("#importNowBtn").addEventListener("click", () => {
    const raw = qs("#bulkImportInput").value.trim();
    if (!raw) return toast("Masukkan data impor dulu.");
    animateButton(qs("#importNowBtn"));

    setTimeout(() => {
      const blocks = raw.split(/\n\s*\n/);
      const imported = [];
      blocks.forEach((line) => {
        const cols = line.split("|").map((x) => x.trim());
        if (cols.length !== 8) return;
        const [category, text, a, b, c, d, e, correct] = cols;
        const ans = correct.toUpperCase();
        if (!["A", "B", "C", "D", "E"].includes(ans)) return;
        imported.push({
          id: uid(),
          category,
          text,
          options: { A: stripChoicePrefix(a), B: stripChoicePrefix(b), C: stripChoicePrefix(c), D: stripChoicePrefix(d), E: stripChoicePrefix(e) },
          correct: ans,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      });

      state.db.questions.push(...imported);
      persist();
      toast(`${imported.length} soal berhasil diimpor.`);
      qs("#bulkImportInput").value = "";
      renderBankSoal();
    }, 650);
  });
}

function renderAdminSettings() {
  const settings = state.db.settings;
  el.adminTabSettings.innerHTML = `
    <h3>Pengaturan Default Ujian</h3>
    <form id="settingsForm" class="form-grid">
      <label>Durasi Default (menit)
        <input type="number" min="1" name="duration" value="${settings.defaultDuration}" />
      </label>
      <label>Jumlah Soal Default
        <input type="number" min="1" max="${Math.max(1, state.db.questions.length)}" name="count" value="${settings.defaultQuestionCount}" />
      </label>
      <button type="submit" class="btn btn-primary" id="saveSettingsBtn">Simpan Pengaturan</button>
    </form>
  `;

  qs("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const fd = new FormData(event.target);
    state.db.settings.defaultDuration = clamp(Number(fd.get("duration")) || 1, 1, 180);
    state.db.settings.defaultQuestionCount = clamp(Number(fd.get("count")) || 1, 1, Math.max(1, state.db.questions.length || 1));
    animateButton(qs("#saveSettingsBtn"));
    setTimeout(() => {
      persist();
      toast("Pengaturan default disimpan.");
    }, 350);
  });
}

function renderAdminHistories() {
  const cards = state.db.histories
    .slice()
    .reverse()
    .map(
      (h) => `<div class="question-card">
        <div class="row-between">
          <strong>${escapeHtml(h.username)}</strong>
          <button class="btn btn-danger" data-action="delete-history" data-id="${h.id}">Hapus Riwayat</button>
        </div>
        <p class="small">${new Date(h.createdAt).toLocaleString("id-ID")} • Nilai ${h.score} • ${h.correctCount}/${h.questionCount} benar</p>
      </div>`
    )
    .join("");

  el.adminTabHistories.innerHTML = `
    <h3>Riwayat Ujian Peserta</h3>
    ${cards || "<p>Belum ada riwayat.</p>"}
  `;

  qsa("button[data-action='delete-history']").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.db.histories = state.db.histories.filter((x) => x.id !== btn.dataset.id);
      persist();
      renderAdminHistories();
      toast("Riwayat dihapus.");
    });
  });
}

function openExamSetupModal() {
  const user = state.session.username;
  const pool = buildQuestionPool(user);
  const maxQuestions = pool.length;
  if (!maxQuestions) return toast("Soal belum tersedia.");
  const settings = state.db.settings;
  let selectedCount = clamp(settings.defaultQuestionCount, 1, maxQuestions);

  openModal(`
    <h3>Pengaturan Sebelum Ujian</h3>
    <label>Durasi (menit)
      <input id="examDurationInput" type="number" min="1" max="180" value="${settings.defaultDuration}" />
    </label>
    <p class="small">Pilih jumlah soal (maks ${maxQuestions}):</p>
    <div class="number-grid" id="countGrid">
      ${Array.from({ length: maxQuestions }, (_, i) => i + 1)
        .map((n) => `<button type="button" class="num-pill ${n === selectedCount ? "active" : ""}" data-count="${n}">${n}</button>`)
        .join("")}
    </div>
    <div class="row-between" style="margin-top:14px;">
      <button class="btn btn-link" id="cancelExamSetup">Batal</button>
      <button class="btn btn-primary" id="startExamConfirmed">Mulai Sekarang</button>
    </div>
  `);

  qsa(".num-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      selectedCount = Number(pill.dataset.count);
      qsa(".num-pill").forEach((x) => x.classList.remove("active"));
      pill.classList.add("active");
    });
  });

  qs("#cancelExamSetup").addEventListener("click", closeModal);
  qs("#startExamConfirmed").addEventListener("click", () => {
    const duration = clamp(Number(qs("#examDurationInput").value) || settings.defaultDuration, 1, 180);
    closeModal();
    startExam(user, selectedCount, duration);
  });
}

function startExam(username, count, durationMin) {
  const questionPool = buildQuestionPool(username);
  const selected = pickQuestionsByPriority(questionPool, count);
  const shuffled = selected.map((q) => shuffleQuestion(q));

  if (!shuffled.length) return toast("Tidak ada soal yang bisa ditampilkan.");

  state.activeExam = {
    username,
    startAt: Date.now(),
    durationMs: durationMin * 60 * 1000,
    questions: shuffled,
    index: 0,
    answers: {}
  };

  el.historyCard.classList.add("hidden");
  el.examCard.classList.remove("hidden");
  renderExamQuestion();
}

function renderExamQuestion() {
  const exam = state.activeExam;
  if (!exam) return;
  const q = exam.questions[exam.index];
  const remainMs = exam.durationMs - (Date.now() - exam.startAt);
  if (remainMs <= 0) return submitExam();

  const minutes = Math.floor(remainMs / 60000);
  const seconds = Math.floor((remainMs % 60000) / 1000).toString().padStart(2, "0");
  const selected = exam.answers[q.id];

  el.examCard.innerHTML = `
    <div class="row-between">
      <h3>Ujian Berlangsung (${exam.index + 1}/${exam.questions.length})</h3>
      <strong>${minutes}:${seconds}</strong>
    </div>
    <p class="small">Kategori: ${escapeHtml(q.category)}</p>
    <div class="question-card fade-in">
      <p><strong>${escapeHtml(q.text)}</strong></p>
      ${q.order.map((letter) => `<button class="btn option-btn ${selected === letter ? "selected" : ""}" data-option="${letter}">${letter}. ${escapeHtml(q.options[letter])}</button>`).join("")}
    </div>
    <div class="row-between" style="margin-top:12px;">
      <button class="btn btn-secondary" id="prevQuestionBtn" ${exam.index === 0 ? "disabled" : ""}>Sebelumnya</button>
      <button class="btn btn-primary" id="nextQuestionBtn">${exam.index === exam.questions.length - 1 ? "Selesai" : "Berikutnya"}</button>
    </div>
  `;

  qsa(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      exam.answers[q.id] = btn.dataset.option;
      renderExamQuestion();
    });
  });

  qs("#prevQuestionBtn").addEventListener("click", () => {
    exam.index -= 1;
    renderExamQuestion();
  });

  qs("#nextQuestionBtn").addEventListener("click", () => {
    if (exam.index === exam.questions.length - 1) return submitExam();
    exam.index += 1;
    renderExamQuestion();
  });

  clearTimeout(state.examTimer);
  state.examTimer = setTimeout(renderExamQuestion, 1000);
}

function submitExam() {
  const exam = state.activeExam;
  if (!exam) return;
  clearTimeout(state.examTimer);

  let correctCount = 0;
  const results = exam.questions.map((q) => {
    const selected = exam.answers[q.id] || null;
    const isCorrect = selected === q.correct;
    if (isCorrect) correctCount += 1;

    if (!state.db.stats[exam.username]) state.db.stats[exam.username] = {};
    if (!state.db.stats[exam.username][q.id]) state.db.stats[exam.username][q.id] = { shown: 0, correct: 0, wrong: 0 };
    state.db.stats[exam.username][q.id].shown += 1;
    if (isCorrect) state.db.stats[exam.username][q.id].correct += 1;
    else state.db.stats[exam.username][q.id].wrong += 1;

    return {
      questionId: q.id,
      category: q.category,
      text: q.text,
      options: q.options,
      order: q.order,
      correct: q.correct,
      selected
    };
  });

  const score = Math.round((correctCount / exam.questions.length) * 100);
  state.db.histories.push({
    id: uid(),
    username: exam.username,
    createdAt: Date.now(),
    durationMin: Math.ceil(exam.durationMs / 60000),
    questionCount: exam.questions.length,
    correctCount,
    score,
    results
  });

  state.activeExam = null;
  persist();

  el.examCard.classList.add("hidden");
  renderParticipantHistory();
  toast(`Ujian selesai. Nilai Anda: ${score}`);
}

function renderParticipantHistory() {
  const username = state.session.username;
  const histories = state.db.histories.filter((h) => h.username === username).slice().reverse();

  const html = histories
    .map(
      (h) => `<div class="question-card">
        <div class="row-between">
          <div>
            <strong>${new Date(h.createdAt).toLocaleString("id-ID")}</strong>
            <p class="small">Nilai: ${h.score} • Benar: ${h.correctCount}/${h.questionCount} • Durasi: ${h.durationMin} menit</p>
          </div>
          <button class="btn btn-secondary" data-action="preview-history" data-id="${h.id}">Preview Detail</button>
        </div>
      </div>`
    )
    .join("");

  el.historyCard.classList.remove("hidden");
  el.historyCard.innerHTML = `<h3>Riwayat Ujian</h3>${html || "<p>Anda belum memiliki riwayat ujian.</p>"}`;

  qsa("button[data-action='preview-history']").forEach((btn) => {
    btn.addEventListener("click", () => previewHistory(btn.dataset.id));
  });
}

function previewHistory(historyId) {
  const item = state.db.histories.find((x) => x.id === historyId);
  if (!item) return;
  openModal(`
    <h3>Detail Hasil Jawaban</h3>
    <p class="small">${item.username} • Nilai ${item.score}</p>
    ${item.results
      .map(
        (r, idx) => `<div class="question-card">
          <p><strong>${idx + 1}. ${escapeHtml(r.text)}</strong></p>
          <p class="small">Kategori: ${escapeHtml(r.category)}</p>
          ${r.order
            .map((k) => `<button class="btn option-btn ${r.correct === k ? "correct" : ""} ${r.selected && r.selected === k && r.selected !== r.correct ? "wrong" : ""}">${k}. ${escapeHtml(r.options[k])}</button>`)
            .join("")}
          <p class="small">Pilihan Anda: ${r.selected || "-"} • Jawaban benar: ${r.correct}</p>
        </div>`
      )
      .join("")}
    <div class="row-between"><span></span><button id="closePreview" class="btn btn-primary">Tutup</button></div>
  `);

  qs("#closePreview").addEventListener("click", closeModal);
}

function buildQuestionPool(username) {
  const stats = state.db.stats[username] || {};
  return state.db.questions
    .map((q) => ({ ...q, shown: stats[q.id]?.shown || 0 }))
    .sort((a, b) => a.shown - b.shown || a.createdAt - b.createdAt);
}

function pickQuestionsByPriority(pool, count) {
  const grouped = new Map();
  pool.forEach((q) => {
    if (!grouped.has(q.shown)) grouped.set(q.shown, []);
    grouped.get(q.shown).push(q);
  });

  const picked = [];
  const levels = [...grouped.keys()].sort((a, b) => a - b);
  for (const lvl of levels) {
    const set = shuffleArray(grouped.get(lvl));
    while (set.length && picked.length < count) picked.push(set.pop());
    if (picked.length >= count) break;
  }
  return picked;
}

function shuffleQuestion(question) {
  const letters = ["A", "B", "C", "D", "E"];
  const shuffledLetters = shuffleArray([...letters]);
  const values = shuffledLetters.map((l) => question.options[l]);

  const remappedOptions = {};
  letters.forEach((newL, idx) => {
    remappedOptions[newL] = values[idx];
  });

  const correctValue = question.options[question.correct];
  const newCorrect = letters.find((l) => remappedOptions[l] === correctValue);

  return {
    ...question,
    options: remappedOptions,
    correct: newCorrect,
    order: letters
  };
}

function openModal(content) {
  el.overlay.classList.remove("hidden");
  el.modal.classList.remove("hidden");
  el.modal.innerHTML = `<div class="fade-in">${content}</div>`;
}

function closeModal() {
  el.overlay.classList.add("hidden");
  el.modal.classList.add("hidden");
  el.modal.innerHTML = "";
}

function logout() {
  state.session = null;
  state.activeExam = null;
  clearTimeout(state.examTimer);
  persist();
  render();
}

function animateButton(button) {
  button.disabled = true;
  button.classList.add("spin");
  setTimeout(() => {
    button.disabled = false;
    button.classList.remove("spin");
  }, 400);
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.toast.classList.add("hidden"), 2200);
}

function loadDb() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DB_KEY) || "null");
    if (!parsed) return structuredClone(defaultDb);
    return {
      ...structuredClone(defaultDb),
      ...parsed,
      settings: { ...defaultDb.settings, ...(parsed.settings || {}) }
    };
  } catch {
    return structuredClone(defaultDb);
  }
}

function persist() {
  localStorage.setItem(DB_KEY, JSON.stringify(state.db));
  localStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
}

function stripChoicePrefix(value) {
  return value.replace(/^[A-E]\./i, "").trim();
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}
