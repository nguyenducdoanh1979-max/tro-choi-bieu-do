import { auth, provider, db } from "./firebase.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  getDoc,
  orderBy,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ALLOWED_TEACHER_EMAILS = ["nguyenducdoanh1979@gmail.com"];

const $ = (id) => document.getElementById(id);
const googleLoginBtn = $("googleLoginBtn");
const logoutBtn = $("logoutBtn");
const loginMessage = $("loginMessage");
const teacherCard = $("teacherCard");
const teacherEmail = $("teacherEmail");

const teacherRoomCode = $("teacherRoomCode");
const roomDuration = $("roomDuration");
const createRoomBtn = $("createRoomBtn");
const roomCreatedBox = $("roomCreatedBox");
const createdRoomInfo = $("createdRoomInfo");
const roomMessage = $("roomMessage");
const qrSection = $("qrSection");
const roomLink = $("roomLink");
const qrImageWrap = $("qrImageWrap");
const copyLinkBtn = $("copyLinkBtn");
const startRoomBtn = $("startRoomBtn");
const refreshRoomBtn = $("refreshRoomBtn");

const joinBtn = $("joinBtn");
const joinMessage = $("joinMessage");
const roomCodeInput = $("roomCode");
const studentNameInput = $("studentName");
const studentRoomBox = $("studentRoomBox");
const studentRoomInfo = $("studentRoomInfo");
const studentWaitingBox = $("studentWaitingBox");
const studentQuestionBox = $("studentQuestionBox");
const studentQuestionTitle = $("studentQuestionTitle");
const studentQuestionMeta = $("studentQuestionMeta");
const studentQuestionTable = $("studentQuestionTable");
const studentWorkArea = $("studentWorkArea");
const submitWorkBtn = $("submitWorkBtn");
const submitMessage = $("submitMessage");

const questionTitle = $("questionTitle");
const questionGrade = $("questionGrade");
const questionSubject = $("questionSubject");
const questionChartType = $("questionChartType");
const questionLabels = $("questionLabels");
const questionPeriods = $("questionPeriods");
const questionValues = $("questionValues");
const questionDuration = $("questionDuration");
const questionAxisMax = $("questionAxisMax");
const questionPictogramUnit = $("questionPictogramUnit");
const saveQuestionBtn = $("saveQuestionBtn");
const questionMessage = $("questionMessage");
const questionList = $("questionList");
const selectedQuestionName = $("selectedQuestionName");
const selectedQuestionNameRoom = $("selectedQuestionNameRoom");

const filterKeyword = $("filterKeyword");
const filterGrade = $("filterGrade");
const filterSubject = $("filterSubject");

const roomList = $("roomList");
const statQuestionCount = $("statQuestionCount");
const statRoomCount = $("statRoomCount");

let selectedQuestion = null;
let questionCache = [];
let roomCache = [];
let currentTeacherRoomId = null;
let currentTeacherRoomUnsub = null;
let currentStudentRoomUnsub = null;
let currentStudentRoomId = null;
let currentStudentQuestion = null;
let currentChart = null;

function showMessage(el, text, type = "") {
  el.textContent = text;
  el.className = "message";
  if (type) el.classList.add(type);
}

function setSelectedQuestion(item) {
  selectedQuestion = item;
  const name = item ? (item.title || "Đã chọn đề") : "Chưa chọn đề";
  selectedQuestionName.textContent = name;
  selectedQuestionNameRoom.textContent = name;
  if (item && item.duration) roomDuration.value = item.duration;
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === "tab-" + tabName);
  });
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

function renderTeacher(user) {
  if (user) {
    teacherCard.classList.remove("hidden");
    teacherEmail.textContent = user.email || "";
    googleLoginBtn.classList.add("hidden");
    loadQuestions();
    loadRooms();
  } else {
    teacherCard.classList.add("hidden");
    teacherEmail.textContent = "";
    googleLoginBtn.classList.remove("hidden");
    qrSection.classList.add("hidden");
    roomCreatedBox.classList.add("hidden");
    startRoomBtn.classList.add("hidden");
    refreshRoomBtn.classList.add("hidden");
    if (currentTeacherRoomUnsub) currentTeacherRoomUnsub();
    currentTeacherRoomUnsub = null;
    currentTeacherRoomId = null;
    questionList.innerHTML = "";
    roomList.innerHTML = "";
    questionCache = [];
    roomCache = [];
    setSelectedQuestion(null);
    statQuestionCount.textContent = "0";
    statRoomCount.textContent = "0";
    switchTab("overview");
  }
}

function buildRoomLink(code, questionId) {
  const cleanCode = code.trim().toUpperCase();
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?room=${encodeURIComponent(cleanCode)}&questionId=${encodeURIComponent(questionId)}`;
}

function renderQrImage(link) {
  qrImageWrap.innerHTML = "";
  const img = document.createElement("img");
  img.alt = "Mã QR vào phòng";
  img.width = 220;
  img.height = 220;
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`;
  qrImageWrap.appendChild(img);
}

function parseCsvLikeText(text) {
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseValuesText(text) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const result = {};
  for (const line of lines) {
    const parts = line.split(":");
    if (parts.length < 2) continue;
    const period = parts[0].trim();
    const values = parts[1].split(",").map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));
    result[period] = values;
  }
  return result;
}

function validateQuestionForm() {
  if (!questionTitle.value.trim()) return "Bạn chưa nhập tên đề.";
  if (!questionGrade.value.trim()) return "Bạn chưa nhập khối/lớp.";
  if (!questionSubject.value.trim()) return "Bạn chưa nhập môn học.";
  if (!questionLabels.value.trim()) return "Bạn chưa nhập nhãn dữ liệu.";
  if (!questionPeriods.value.trim()) return "Bạn chưa nhập các đợt dữ liệu.";
  if (!questionValues.value.trim()) return "Bạn chưa nhập số liệu.";
  return "";
}

function renderStudentDataTable(question) {
  const labels = question.labels || [];
  const periods = question.periods || [];
  const valuesByPeriod = question.valuesByPeriod || {};
  let html = "<thead><tr><th>Nhóm dữ liệu</th>";
  labels.forEach((label) => html += `<th>${label}</th>`);
  html += "</tr></thead><tbody>";
  periods.forEach((period) => {
    html += `<tr><td>${period}</td>`;
    (valuesByPeriod[period] || []).forEach((value) => html += `<td>${value}</td>`);
    html += "</tr>";
  });
  html += "</tbody>";
  studentQuestionTable.innerHTML = html;
}

function chartLabelsFromQuestion(question) {
  return question.labels || [];
}

function defaultDatasetValues(question, periodIndex=0) {
  const periods = question.periods || [];
  const p = periods[periodIndex] || periods[0] || "";
  return [...((question.valuesByPeriod || {})[p] || [])];
}

function buildChartBox() {
  const chartBox = document.createElement("div");
  chartBox.className = "chart-box";
  const canvas = document.createElement("canvas");
  canvas.id = "studentChartCanvas";
  chartBox.appendChild(canvas);
  return { chartBox, canvas };
}

function destroyCurrentChart() {
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
}

function createBarInteractive(question) {
  const labels = chartLabelsFromQuestion(question);
  const maxY = Number(question.axisMax || 20);
  const values = defaultDatasetValues(question, 0);
  const { chartBox, canvas } = buildChartBox();
  studentWorkArea.appendChild(chartBox);

  currentChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Giá trị", data: values }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: maxY } } }
  });

  const grid = document.createElement("div");
  grid.className = "control-grid";
  labels.forEach((label, i) => {
    const card = document.createElement("div");
    card.className = "control-card";
    card.innerHTML = `
      <div class="control-title">${label}</div>
      <input type="range" min="0" max="${maxY}" value="${values[i] || 0}" data-i="${i}">
      <input type="number" min="0" max="${maxY}" value="${values[i] || 0}" data-i="${i}">
    `;
    const range = card.querySelector('input[type="range"]');
    const num = card.querySelector('input[type="number"]');
    range.oninput = () => { num.value = range.value; currentChart.data.datasets[0].data[i] = Number(range.value); currentChart.update(); };
    num.oninput = () => { range.value = num.value; currentChart.data.datasets[0].data[i] = Number(num.value || 0); currentChart.update(); };
    grid.appendChild(card);
  });
  studentWorkArea.appendChild(grid);
}

function createDoubleBarInteractive(question) {
  const labels = chartLabelsFromQuestion(question);
  const periods = question.periods || [];
  const maxY = Number(question.axisMax || 20);
  const p1 = periods[0] || "Đợt 1";
  const p2 = periods[1] || "Đợt 2";
  const values1 = defaultDatasetValues(question, 0);
  const values2 = defaultDatasetValues(question, 1);

  const { chartBox, canvas } = buildChartBox();
  studentWorkArea.appendChild(chartBox);

  currentChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: { labels, datasets: [{ label: p1, data: values1 }, { label: p2, data: values2 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: maxY } } }
  });

  const grid = document.createElement("div");
  grid.className = "control-grid";
  [p1, p2].forEach((period, datasetIndex) => {
    labels.forEach((label, i) => {
      const val = datasetIndex === 0 ? values1[i] || 0 : values2[i] || 0;
      const card = document.createElement("div");
      card.className = "control-card";
      card.innerHTML = `
        <div class="control-title">${period} - ${label}</div>
        <input type="range" min="0" max="${maxY}" value="${val}">
        <input type="number" min="0" max="${maxY}" value="${val}">
      `;
      const range = card.querySelector('input[type="range"]');
      const num = card.querySelector('input[type="number"]');
      range.oninput = () => { num.value = range.value; currentChart.data.datasets[datasetIndex].data[i] = Number(range.value); currentChart.update(); };
      num.oninput = () => { range.value = num.value; currentChart.data.datasets[datasetIndex].data[i] = Number(num.value || 0); currentChart.update(); };
      grid.appendChild(card);
    });
  });
  studentWorkArea.appendChild(grid);
}

function createLineInteractive(question) {
  const labels = chartLabelsFromQuestion(question);
  const maxY = Number(question.axisMax || 20);
  const values = defaultDatasetValues(question, 0);

  const { chartBox, canvas } = buildChartBox();
  studentWorkArea.appendChild(chartBox);

  currentChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: { labels, datasets: [{ label: "Đường biểu diễn", data: values, tension: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: maxY } } }
  });

  const grid = document.createElement("div");
  grid.className = "control-grid";
  labels.forEach((label, i) => {
    const card = document.createElement("div");
    card.className = "control-card";
    card.innerHTML = `
      <div class="control-title">${label}</div>
      <input type="range" min="0" max="${maxY}" value="${values[i] || 0}">
      <input type="number" min="0" max="${maxY}" value="${values[i] || 0}">
    `;
    const range = card.querySelector('input[type="range"]');
    const num = card.querySelector('input[type="number"]');
    range.oninput = () => { num.value = range.value; currentChart.data.datasets[0].data[i] = Number(range.value); currentChart.update(); };
    num.oninput = () => { range.value = num.value; currentChart.data.datasets[0].data[i] = Number(num.value || 0); currentChart.update(); };
    grid.appendChild(card);
  });
  studentWorkArea.appendChild(grid);
}

function updatePieTotal() {
  const nums = [...studentWorkArea.querySelectorAll('[data-pie-number]')].map(el => Number(el.value || 0));
  const total = nums.reduce((a,b)=>a+b,0);
  const box = studentWorkArea.querySelector('.pie-total');
  if (box) {
    box.textContent = `Tổng hiện tại: ${total}%`;
    box.className = total === 100 ? "pie-total ok" : "pie-total warn";
  }
}

function createPieInteractive(question) {
  const labels = chartLabelsFromQuestion(question);
  const values = labels.map(() => Math.round(100 / Math.max(labels.length, 1)));
  const { chartBox, canvas } = buildChartBox();
  studentWorkArea.appendChild(chartBox);

  currentChart = new Chart(canvas.getContext("2d"), {
    type: "pie",
    data: { labels, datasets: [{ data: values }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const grid = document.createElement("div");
  grid.className = "control-grid one-col";
  labels.forEach((label, i) => {
    const card = document.createElement("div");
    card.className = "control-card";
    card.innerHTML = `
      <div class="control-title">${label}</div>
      <input type="range" min="0" max="100" value="${values[i]}" data-pie-range="${i}">
      <input type="number" min="0" max="100" value="${values[i]}" data-pie-number="${i}">
    `;
    const range = card.querySelector('[data-pie-range]');
    const num = card.querySelector('[data-pie-number]');
    range.oninput = () => { num.value = range.value; currentChart.data.datasets[0].data[i] = Number(range.value); currentChart.update(); updatePieTotal(); };
    num.oninput = () => { range.value = num.value; currentChart.data.datasets[0].data[i] = Number(num.value || 0); currentChart.update(); updatePieTotal(); };
    grid.appendChild(card);
  });
  studentWorkArea.appendChild(grid);

  const total = document.createElement("div");
  total.className = "pie-total warn";
  total.textContent = "Tổng hiện tại: 0%";
  studentWorkArea.appendChild(total);
  updatePieTotal();
}

function createPictogramInteractive(question) {
  const labels = chartLabelsFromQuestion(question);
  const values = defaultDatasetValues(question, 0);
  const unit = Number(question.pictogramUnit || 1);

  const note = document.createElement("div");
  note.className = "small";
  note.textContent = `Biểu đồ tranh: 1 ô vuông tương ứng ${unit} đơn vị. Học sinh bấm vào ô để tô.`;
  studentWorkArea.appendChild(note);

  labels.forEach((label, i) => {
    const section = document.createElement("div");
    section.className = "pictogram-section";
    const needed = Math.ceil((values[i] || 0) / Math.max(unit,1));
    section.innerHTML = `
      <div class="pictogram-head">
        <strong>${label}</strong>
        <span class="small">Cần thể hiện: ${values[i] || 0} đơn vị</span>
      </div>
      <div class="pictogram-grid" data-picto-grid="${i}"></div>
      <div class="small">Số ô đã tô: <span data-picto-count="${i}">0</span></div>
    `;
    studentWorkArea.appendChild(section);
    const grid = section.querySelector(`[data-picto-grid="${i}"]`);
    for (let k = 0; k < 40; k++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "picto-cell";
      cell.dataset.active = "0";
      cell.dataset.group = String(i);
      cell.addEventListener("click", () => {
        cell.dataset.active = cell.dataset.active === "1" ? "0" : "1";
        cell.classList.toggle("active", cell.dataset.active === "1");
        updatePictogramCount(i);
      });
      grid.appendChild(cell);
    }
    for (let k = 0; k < needed && k < 40; k++) {
      const cell = grid.children[k];
      cell.dataset.active = "1";
      cell.classList.add("active");
    }
    updatePictogramCount(i);
  });
}

function updatePictogramCount(groupIndex) {
  const cells = [...studentWorkArea.querySelectorAll(`.picto-cell[data-group="${groupIndex}"]`)];
  const active = cells.filter(c => c.dataset.active === "1").length;
  const countBox = studentWorkArea.querySelector(`[data-picto-count="${groupIndex}"]`);
  if (countBox) countBox.textContent = String(active);
}

function renderWorkArea(question) {
  destroyCurrentChart();
  studentWorkArea.innerHTML = "";

  const title = document.createElement("div");
  title.className = "work-title";
  title.textContent = "Khu vực làm bài";
  studentWorkArea.appendChild(title);

  const type = question.chartType || "bar";
  if (type === "bar") createBarInteractive(question);
  else if (type === "double_bar") createDoubleBarInteractive(question);
  else if (type === "line") createLineInteractive(question);
  else if (type === "pie") createPieInteractive(question);
  else if (type === "pictogram") createPictogramInteractive(question);
}

function collectStudentAnswer() {
  if (!currentStudentQuestion) return null;
  const type = currentStudentQuestion.chartType || "bar";

  if (type === "pie") {
    const values = {};
    [...studentWorkArea.querySelectorAll('[data-pie-number]')].forEach((el, i) => {
      const label = currentStudentQuestion.labels[i];
      values[label] = Number(el.value || 0);
    });
    return { mode: "pie", values };
  }

  if (type === "pictogram") {
    const values = {};
    (currentStudentQuestion.labels || []).forEach((label, i) => {
      const cells = [...studentWorkArea.querySelectorAll(`.picto-cell[data-group="${i}"]`)];
      values[label] = cells.filter(c => c.dataset.active === "1").length;
    });
    return { mode: "pictogram", unit: Number(currentStudentQuestion.pictogramUnit || 1), values };
  }

  if (currentChart) {
    return { mode: type, datasets: currentChart.data.datasets.map(ds => ({ label: ds.label, data: [...ds.data] })) };
  }

  return null;
}

async function renderStudentRoomFromData(roomDocId, roomData) {
  currentStudentRoomId = roomDocId;
  studentRoomBox.classList.remove("hidden");
  studentRoomInfo.textContent = `Mã phòng: ${roomData.roomCode} | Thời gian: ${roomData.duration || 15} phút | Đề: ${roomData.questionTitle || ""}`;

  if (roomData.status !== "started") {
    studentWaitingBox.classList.remove("hidden");
    studentQuestionBox.classList.add("hidden");
    return;
  }

  studentWaitingBox.classList.add("hidden");

  if (roomData.questionId) {
    const questionRef = doc(db, "question_bank", roomData.questionId);
    const questionSnap = await getDoc(questionRef);
    if (questionSnap.exists()) {
      currentStudentQuestion = { id: questionSnap.id, ...questionSnap.data() };
      studentQuestionBox.classList.remove("hidden");
      studentQuestionTitle.textContent = currentStudentQuestion.title || "Đề thi";
      studentQuestionMeta.textContent = `Khối: ${currentStudentQuestion.grade || ""} | Môn: ${currentStudentQuestion.subject || ""} | Loại biểu đồ: ${currentStudentQuestion.chartType || ""} | Thời gian: ${currentStudentQuestion.duration || 15} phút`;
      renderStudentDataTable(currentStudentQuestion);
      renderWorkArea(currentStudentQuestion);
    } else {
      studentQuestionBox.classList.add("hidden");
    }
  } else {
    studentQuestionBox.classList.add("hidden");
  }
}

function watchStudentRoom(roomDocId) {
  if (currentStudentRoomUnsub) currentStudentRoomUnsub();
  const ref = doc(db, "rooms", roomDocId);
  currentStudentRoomUnsub = onSnapshot(ref, async (snap) => {
    if (!snap.exists()) return;
    const roomData = snap.data();
    await renderStudentRoomFromData(roomDocId, roomData);
  });
}

async function openStudentRoom(roomCode) {
  try {
    const q = query(collection(db, "rooms"), where("roomCode", "==", roomCode));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      showMessage(joinMessage, "Không tìm thấy phòng thi này.", "error");
      studentRoomBox.classList.add("hidden");
      studentQuestionBox.classList.add("hidden");
      studentWaitingBox.classList.add("hidden");
      return;
    }

    const roomDoc = snapshot.docs[0];
    const roomData = roomDoc.data();
    showMessage(joinMessage, `Đã vào phòng: ${roomData.roomCode}`, "success");
    watchStudentRoom(roomDoc.id);
    await renderStudentRoomFromData(roomDoc.id, roomData);
  } catch (error) {
    console.error(error);
    showMessage(joinMessage, "Không mở được phòng thi.", "error");
  }
}

async function applyRoomFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  if (room) {
    roomCodeInput.value = room;
    showMessage(joinMessage, `Đã nhận mã phòng từ QR: ${room}`, "success");
    await openStudentRoom(room.toUpperCase());
  }
}

function updateTeacherRoomBox(roomData) {
  roomCreatedBox.classList.remove("hidden");
  qrSection.classList.remove("hidden");
  const statusText = roomData.status === "started" ? "đã bắt đầu" : "chờ bắt đầu";
  createdRoomInfo.textContent = `Mã phòng: ${roomData.roomCode} | Đề: ${roomData.questionTitle || ""} | Thời gian: ${roomData.duration || 15} phút | Trạng thái: ${statusText}`;

  if (roomData.status === "started") {
    startRoomBtn.textContent = "Đã bắt đầu";
    startRoomBtn.disabled = true;
  } else {
    startRoomBtn.textContent = "Bắt đầu";
    startRoomBtn.disabled = false;
  }
  startRoomBtn.classList.remove("hidden");
  refreshRoomBtn.classList.remove("hidden");
}

function watchTeacherRoom(roomId) {
  if (currentTeacherRoomUnsub) currentTeacherRoomUnsub();
  const ref = doc(db, "rooms", roomId);
  currentTeacherRoomUnsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    updateTeacherRoomBox(snap.data());
  });
}

googleLoginBtn.addEventListener("click", async () => {
  showMessage(loginMessage, "");
  try {
    const result = await signInWithPopup(auth, provider);
    const email = (result.user && result.user.email ? result.user.email : "").toLowerCase().trim();
    const allowed = ALLOWED_TEACHER_EMAILS.map(x => x.toLowerCase());
    if (!allowed.includes(email)) {
      await signOut(auth);
      showMessage(loginMessage, `Email ${email} không có quyền truy cập phần giáo viên.`, "error");
      return;
    }
    showMessage(loginMessage, "Đăng nhập Google thành công.", "success");
  } catch (error) {
    console.error(error);
    let msg = "Đăng nhập Google thất bại.";
    if (error && error.code === "auth/unauthorized-domain") msg = "Domain này chưa được thêm trong Firebase Authorized domains.";
    else if (error && error.code === "auth/popup-closed-by-user") msg = "Bạn đã đóng cửa sổ đăng nhập Google.";
    else if (error && error.code === "auth/popup-blocked") msg = "Trình duyệt đang chặn popup đăng nhập Google.";
    else msg = "Đăng nhập Google thất bại. Hãy kiểm tra Google provider và Authorized domains.";
    showMessage(loginMessage, msg, "error");
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showMessage(loginMessage, "Đã đăng xuất.", "success");
});

onAuthStateChanged(auth, (user) => renderTeacher(user));

createRoomBtn.addEventListener("click", async () => {
  const code = teacherRoomCode.value.trim().toUpperCase();
  const duration = Number(roomDuration.value || (selectedQuestion ? selectedQuestion.duration : 15) || 15);

  if (!code) return showMessage(roomMessage, "Bạn chưa nhập mã phòng.", "error");
  if (!selectedQuestion) return showMessage(roomMessage, "Bạn chưa chọn đề trong ngân hàng đề.", "error");

  try {
    const added = await addDoc(collection(db, "rooms"), {
      roomCode: code,
      questionId: selectedQuestion.id,
      questionTitle: selectedQuestion.title || "",
      duration,
      teacherEmail: teacherEmail.textContent || "",
      createdAt: serverTimestamp(),
      status: "waiting"
    });

    currentTeacherRoomId = added.id;
    const link = buildRoomLink(code, selectedQuestion.id);
    roomLink.value = link;
    renderQrImage(link);
    watchTeacherRoom(added.id);

    roomCreatedBox.classList.remove("hidden");
    qrSection.classList.remove("hidden");
    startRoomBtn.classList.remove("hidden");
    refreshRoomBtn.classList.remove("hidden");
    startRoomBtn.disabled = false;
    startRoomBtn.textContent = "Bắt đầu";

    showMessage(roomMessage, "Đã tạo phòng thi. QR vẫn giữ nguyên tại đây. Giáo viên bấm Bắt đầu khi sẵn sàng.", "success");
    await loadRooms();
    switchTab("room");
  } catch (error) {
    console.error(error);
    showMessage(roomMessage, "Tạo phòng thi thất bại. Kiểm tra Firestore Rules.", "error");
  }
});

startRoomBtn.addEventListener("click", async () => {
  if (!currentTeacherRoomId) return showMessage(roomMessage, "Chưa có phòng hiện tại để bắt đầu.", "error");
  try {
    await updateDoc(doc(db, "rooms", currentTeacherRoomId), { status: "started", startedAt: serverTimestamp() });
    showMessage(roomMessage, "Đã bắt đầu phòng thi. Học sinh đang chờ sẽ tự chạy.", "success");
    await loadRooms();
  } catch (err) {
    console.error(err);
    showMessage(roomMessage, "Không bắt đầu được phòng thi.", "error");
  }
});

refreshRoomBtn.addEventListener("click", async () => {
  if (!currentTeacherRoomId) return;
  const snap = await getDoc(doc(db, "rooms", currentTeacherRoomId));
  if (snap.exists()) updateTeacherRoomBox(snap.data());
});

copyLinkBtn.addEventListener("click", async () => {
  if (!roomLink.value) return;
  try {
    await navigator.clipboard.writeText(roomLink.value);
    showMessage(roomMessage, "Đã sao chép link vào phòng.", "success");
  } catch {
    showMessage(roomMessage, "Không sao chép được. Bạn hãy copy thủ công.", "error");
  }
});

joinBtn.addEventListener("click", async () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!roomCode) return showMessage(joinMessage, "Vui lòng nhập mã phòng.", "error");
  await openStudentRoom(roomCode);
});

submitWorkBtn.addEventListener("click", async () => {
  const studentName = studentNameInput.value.trim();
  if (!studentName) return showMessage(submitMessage, "Bạn chưa nhập họ tên hoặc tên nhóm.", "error");
  if (!currentStudentRoomId || !currentStudentQuestion) return showMessage(submitMessage, "Chưa có dữ liệu bài làm để nộp.", "error");

  try {
    const answerData = collectStudentAnswer();
    await addDoc(collection(db, "submissions"), {
      roomId: currentStudentRoomId,
      roomCode: roomCodeInput.value.trim().toUpperCase(),
      studentName,
      questionId: currentStudentQuestion.id,
      questionTitle: currentStudentQuestion.title || "",
      chartType: currentStudentQuestion.chartType || "",
      answerData,
      submittedAt: serverTimestamp()
    });
    showMessage(submitMessage, "Đã nộp bài thành công.", "success");
  } catch (err) {
    console.error(err);
    showMessage(submitMessage, "Nộp bài thất bại. Kiểm tra Firestore Rules.", "error");
  }
});

saveQuestionBtn.addEventListener("click", async () => {
  const error = validateQuestionForm();
  if (error) return showMessage(questionMessage, error, "error");

  try {
    const labels = parseCsvLikeText(questionLabels.value);
    const periods = parseCsvLikeText(questionPeriods.value);
    const valuesByPeriod = parseValuesText(questionValues.value);

    await addDoc(collection(db, "question_bank"), {
      title: questionTitle.value.trim(),
      grade: questionGrade.value.trim(),
      subject: questionSubject.value.trim(),
      chartType: questionChartType.value,
      labels,
      periods,
      valuesByPeriod,
      duration: Number(questionDuration.value || 15),
      axisMax: Number(questionAxisMax.value || 20),
      pictogramUnit: Number(questionPictogramUnit.value || 1),
      createdAt: serverTimestamp(),
      teacherEmail: teacherEmail.textContent || ""
    });

    showMessage(questionMessage, "Đã lưu đề vào ngân hàng.", "success");
    questionTitle.value = "";
    questionGrade.value = "";
    questionSubject.value = "";
    questionLabels.value = "";
    questionPeriods.value = "";
    questionValues.value = "";
    questionDuration.value = 15;
    questionAxisMax.value = 20;
    questionPictogramUnit.value = 1;
    await loadQuestions();
    switchTab("bank");
  } catch (err) {
    console.error(err);
    showMessage(questionMessage, "Lưu đề thất bại. Kiểm tra Firestore Rules.", "error");
  }
});

function renderQuestionList(items) {
  const keyword = filterKeyword.value.trim().toLowerCase();
  const grade = filterGrade.value.trim().toLowerCase();
  const subject = filterSubject.value.trim().toLowerCase();

  const filtered = items.filter((item) => {
    const okKeyword = !keyword || (item.title || "").toLowerCase().includes(keyword);
    const okGrade = !grade || (item.grade || "").toLowerCase().includes(grade);
    const okSubject = !subject || (item.subject || "").toLowerCase().includes(subject);
    return okKeyword && okGrade && okSubject;
  });

  questionList.innerHTML = "";
  if (filtered.length === 0) {
    questionList.innerHTML = "<div class='small'>Chưa có đề nào trong ngân hàng.</div>";
    return;
  }

  filtered.forEach((item) => {
    const box = document.createElement("div");
    box.className = "question-item";
    box.innerHTML = `
      <div class="question-item-title">${item.title || ""}</div>
      <div class="small">Khối: ${item.grade || ""} | Môn: ${item.subject || ""}</div>
      <div class="small">Loại: ${item.chartType || ""}</div>
      <div class="small">Nhãn: ${(item.labels || []).join(", ")}</div>
      <div class="small">Đợt dữ liệu: ${(item.periods || []).join(", ")}</div>
      <div class="question-actions">
        <button class="mini-btn select-btn">Chọn đề</button>
        <button class="mini-btn delete-btn">Xóa</button>
      </div>
    `;
    box.querySelector(".select-btn").addEventListener("click", () => {
      setSelectedQuestion(item);
      roomDuration.value = item.duration || 15;
      showMessage(questionMessage, `Đã chọn đề: ${item.title}`, "success");
      switchTab("room");
    });
    box.querySelector(".delete-btn").addEventListener("click", async () => {
      const ok = window.confirm(`Xóa đề "${item.title}"?`);
      if (!ok) return;
      await deleteDoc(doc(db, "question_bank", item.id));
      if (selectedQuestion && selectedQuestion.id === item.id) setSelectedQuestion(null);
      await loadQuestions();
    });
    questionList.appendChild(box);
  });
}

async function loadQuestions() {
  try {
    questionList.innerHTML = "<div class='small'>Đang tải dữ liệu...</div>";
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, "question_bank"), orderBy("createdAt", "desc")));
    } catch (err) {
      snapshot = await getDocs(collection(db, "question_bank"));
    }
    questionCache = [];
    snapshot.forEach((item) => questionCache.push({ id: item.id, ...item.data() }));
    statQuestionCount.textContent = String(questionCache.length);
    renderQuestionList(questionCache);
  } catch (err) {
    console.error(err);
    questionList.innerHTML = "<div class='small error'>Không tải được ngân hàng đề. Kiểm tra Firestore Rules.</div>";
  }
}

async function startRoomFromList(roomId) {
  try {
    await updateDoc(doc(db, "rooms", roomId), { status: "started", startedAt: serverTimestamp() });
    if (currentTeacherRoomId === roomId) showMessage(roomMessage, "Đã bắt đầu phòng thi.", "success");
    await loadRooms();
  } catch (err) {
    console.error(err);
  }
}

async function loadRooms() {
  try {
    roomList.innerHTML = "<div class='small'>Đang tải phòng thi...</div>";
    let snapshot;
    try {
      snapshot = await getDocs(query(collection(db, "rooms"), orderBy("createdAt", "desc")));
    } catch (err) {
      snapshot = await getDocs(collection(db, "rooms"));
    }
    roomCache = [];
    snapshot.forEach((item) => roomCache.push({ id: item.id, ...item.data() }));
    statRoomCount.textContent = String(roomCache.length);
    roomList.innerHTML = "";

    if (roomCache.length === 0) {
      roomList.innerHTML = "<div class='small'>Chưa có phòng thi nào.</div>";
      return;
    }

    roomCache.forEach((room) => {
      const box = document.createElement("div");
      box.className = "room-item";
      const started = room.status === "started";
      box.innerHTML = `
        <div class="question-item-title">${room.roomCode || ""}</div>
        <div class="small">Đề: ${room.questionTitle || ""}</div>
        <div class="small">Thời gian: ${room.duration || 15} phút</div>
        <div class="small">Trạng thái: ${started ? "đã bắt đầu" : "chờ bắt đầu"}</div>
        <div class="question-actions">
          <button class="mini-btn start-btn" ${started ? "disabled" : ""}>${started ? "Đã bắt đầu" : "Bắt đầu"}</button>
        </div>
      `;
      const btn = box.querySelector(".start-btn");
      if (!started) btn.addEventListener("click", () => startRoomFromList(room.id));
      roomList.appendChild(box);
    });
  } catch (err) {
    console.error(err);
    roomList.innerHTML = "<div class='small error'>Không tải được danh sách phòng. Kiểm tra Firestore Rules.</div>";
  }
}

[filterKeyword, filterGrade, filterSubject].forEach((input) => {
  input.addEventListener("input", () => renderQuestionList(questionCache));
});

applyRoomFromQuery();
