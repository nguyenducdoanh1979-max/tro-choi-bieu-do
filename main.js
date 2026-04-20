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

const ALLOWED_TEACHER_EMAILS = [
  "nguyenducdoanh1979@gmail.com"
];

const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMessage = document.getElementById("loginMessage");
const teacherCard = document.getElementById("teacherCard");
const teacherEmail = document.getElementById("teacherEmail");

const teacherRoomCode = document.getElementById("teacherRoomCode");
const roomDuration = document.getElementById("roomDuration");
const createRoomBtn = document.getElementById("createRoomBtn");
const roomCreatedBox = document.getElementById("roomCreatedBox");
const createdRoomInfo = document.getElementById("createdRoomInfo");
const roomMessage = document.getElementById("roomMessage");
const qrSection = document.getElementById("qrSection");
const roomLink = document.getElementById("roomLink");
const qrImageWrap = document.getElementById("qrImageWrap");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const startRoomBtn = document.getElementById("startRoomBtn");
const refreshRoomBtn = document.getElementById("refreshRoomBtn");

const joinBtn = document.getElementById("joinBtn");
const joinMessage = document.getElementById("joinMessage");
const roomCodeInput = document.getElementById("roomCode");
const studentRoomBox = document.getElementById("studentRoomBox");
const studentRoomInfo = document.getElementById("studentRoomInfo");
const studentWaitingBox = document.getElementById("studentWaitingBox");
const studentQuestionBox = document.getElementById("studentQuestionBox");
const studentQuestionTitle = document.getElementById("studentQuestionTitle");
const studentQuestionMeta = document.getElementById("studentQuestionMeta");
const studentQuestionTable = document.getElementById("studentQuestionTable");

const questionTitle = document.getElementById("questionTitle");
const questionGrade = document.getElementById("questionGrade");
const questionSubject = document.getElementById("questionSubject");
const questionChartType = document.getElementById("questionChartType");
const questionLabels = document.getElementById("questionLabels");
const questionPeriods = document.getElementById("questionPeriods");
const questionValues = document.getElementById("questionValues");
const questionDuration = document.getElementById("questionDuration");
const saveQuestionBtn = document.getElementById("saveQuestionBtn");
const questionMessage = document.getElementById("questionMessage");
const questionList = document.getElementById("questionList");
const selectedQuestionName = document.getElementById("selectedQuestionName");
const selectedQuestionNameRoom = document.getElementById("selectedQuestionNameRoom");

const filterKeyword = document.getElementById("filterKeyword");
const filterGrade = document.getElementById("filterGrade");
const filterSubject = document.getElementById("filterSubject");

const roomList = document.getElementById("roomList");
const statQuestionCount = document.getElementById("statQuestionCount");
const statRoomCount = document.getElementById("statRoomCount");

let selectedQuestion = null;
let questionCache = [];
let roomCache = [];
let currentTeacherRoomId = null;
let currentTeacherRoomUnsub = null;
let currentStudentRoomUnsub = null;

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
    panel.classList.toggle("active", panel.id === `tab-${tabName}`);
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
    currentTeacherRoomId = null;
    if (currentTeacherRoomUnsub) currentTeacherRoomUnsub();
    currentTeacherRoomUnsub = null;
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

function renderStudentQuestion(question) {
  studentQuestionBox.classList.remove("hidden");
  studentQuestionTitle.textContent = question.title || "Đề thi";
  studentQuestionMeta.textContent = `Khối: ${question.grade || ""} | Môn: ${question.subject || ""} | Loại biểu đồ: ${question.chartType || ""} | Thời gian: ${question.duration || 15} phút`;

  const labels = question.labels || [];
  const periods = question.periods || [];
  const valuesByPeriod = question.valuesByPeriod || {};

  let html = "<thead><tr><th>Nhóm dữ liệu</th>";
  labels.forEach((label) => { html += `<th>${label}</th>`; });
  html += "</tr></thead><tbody>";

  periods.forEach((period) => {
    html += `<tr><td>${period}</td>`;
    (valuesByPeriod[period] || []).forEach((value) => { html += `<td>${value}</td>`; });
    html += "</tr>";
  });

  html += "</tbody>";
  studentQuestionTable.innerHTML = html;
}

async function renderStudentRoomFromData(roomDocId, roomData) {
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
      renderStudentQuestion({ id: questionSnap.id, ...questionSnap.data() });
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
    const data = snap.data();
    updateTeacherRoomBox(data);
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

onAuthStateChanged(auth, (user) => {
  renderTeacher(user);
});

createRoomBtn.addEventListener("click", async () => {
  const code = teacherRoomCode.value.trim().toUpperCase();
  const duration = Number(roomDuration.value || (selectedQuestion ? selectedQuestion.duration : 15) || 15);

  if (!code) {
    showMessage(roomMessage, "Bạn chưa nhập mã phòng.", "error");
    return;
  }
  if (!selectedQuestion) {
    showMessage(roomMessage, "Bạn chưa chọn đề trong ngân hàng đề.", "error");
    return;
  }

  try {
    const added = await addDoc(collection(db, "rooms"), {
      roomCode: code,
      questionId: selectedQuestion.id,
      questionTitle: selectedQuestion.title || "",
      duration: duration,
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
  if (!currentTeacherRoomId) {
    showMessage(roomMessage, "Chưa có phòng hiện tại để bắt đầu.", "error");
    return;
  }
  try {
    await updateDoc(doc(db, "rooms", currentTeacherRoomId), {
      status: "started",
      startedAt: serverTimestamp()
    });
    showMessage(roomMessage, "Đã bắt đầu phòng thi. Học sinh đang chờ sẽ tự chạy.", "success");
    await loadRooms();
  } catch (err) {
    console.error(err);
    showMessage(roomMessage, "Không bắt đầu được phòng thi.", "error");
  }
});

refreshRoomBtn.addEventListener("click", async () => {
  if (currentTeacherRoomId) {
    const snap = await getDoc(doc(db, "rooms", currentTeacherRoomId));
    if (snap.exists()) updateTeacherRoomBox(snap.data());
  }
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
  if (!roomCode) {
    showMessage(joinMessage, "Vui lòng nhập mã phòng.", "error");
    return;
  }
  await openStudentRoom(roomCode);
});

saveQuestionBtn.addEventListener("click", async () => {
  const error = validateQuestionForm();
  if (error) {
    showMessage(questionMessage, error, "error");
    return;
  }

  try {
    const labels = parseCsvLikeText(questionLabels.value);
    const periods = parseCsvLikeText(questionPeriods.value);
    const valuesByPeriod = parseValuesText(questionValues.value);

    await addDoc(collection(db, "question_bank"), {
      title: questionTitle.value.trim(),
      grade: questionGrade.value.trim(),
      subject: questionSubject.value.trim(),
      chartType: questionChartType.value,
      labels: labels,
      periods: periods,
      valuesByPeriod: valuesByPeriod,
      duration: Number(questionDuration.value || 15),
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
    snapshot.forEach((item) => {
      questionCache.push({ id: item.id, ...item.data() });
    });

    statQuestionCount.textContent = String(questionCache.length);
    renderQuestionList(questionCache);
  } catch (err) {
    console.error(err);
    questionList.innerHTML = "<div class='small error'>Không tải được ngân hàng đề. Kiểm tra Firestore Rules.</div>";
  }
}

async function startRoomFromList(roomId) {
  try {
    await updateDoc(doc(db, "rooms", roomId), {
      status: "started",
      startedAt: serverTimestamp()
    });
    if (currentTeacherRoomId === roomId) {
      showMessage(roomMessage, "Đã bắt đầu phòng thi.", "success");
    }
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
    snapshot.forEach((item) => {
      roomCache.push({ id: item.id, ...item.data() });
    });

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
      if (!started) {
        btn.addEventListener("click", () => startRoomFromList(room.id));
      }

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
