import { auth, provider, db } from "./firebase.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ALLOWED_TEACHER_EMAIL = "nguyenducdoanh1979@gmail.com";

const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMessage = document.getElementById("loginMessage");
const teacherCard = document.getElementById("teacherCard");
const teacherEmail = document.getElementById("teacherEmail");

const teacherRoomCode = document.getElementById("teacherRoomCode");
const generateQrBtn = document.getElementById("generateQrBtn");
const qrSection = document.getElementById("qrSection");
const roomLink = document.getElementById("roomLink");
const qrImageWrap = document.getElementById("qrImageWrap");
const copyLinkBtn = document.getElementById("copyLinkBtn");

const joinBtn = document.getElementById("joinBtn");
const joinMessage = document.getElementById("joinMessage");
const roomCodeInput = document.getElementById("roomCode");

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

let selectedQuestion = null;

function showMessage(el, text, type = "") {
  el.textContent = text;
  el.className = "message";
  if (type) el.classList.add(type);
}

function renderTeacher(user) {
  if (user) {
    teacherCard.classList.remove("hidden");
    teacherEmail.textContent = user.email || "";
    googleLoginBtn.classList.add("hidden");
    loadQuestions();
  } else {
    teacherCard.classList.add("hidden");
    teacherEmail.textContent = "";
    googleLoginBtn.classList.remove("hidden");
    qrSection.classList.add("hidden");
    questionList.innerHTML = "";
    selectedQuestion = null;
    selectedQuestionName.textContent = "Chưa chọn đề";
  }
}

function buildRoomLink(code) {
  const cleanCode = code.trim().toUpperCase();
  const base = `${window.location.origin}${window.location.pathname}`;
  if (selectedQuestion?.id) {
    return `${base}?room=${encodeURIComponent(cleanCode)}&questionId=${encodeURIComponent(selectedQuestion.id)}`;
  }
  return `${base}?room=${encodeURIComponent(cleanCode)}`;
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

function applyRoomFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  if (room) {
    roomCodeInput.value = room;
    showMessage(joinMessage, `Đã nhận mã phòng từ QR: ${room}`, "success");
  }
}

function parseCsvLikeText(text) {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseValuesText(text) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const result = {};
  for (const line of lines) {
    const parts = line.split(":");
    if (parts.length < 2) continue;
    const period = parts[0].trim();
    const values = parts[1]
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => !Number.isNaN(v));
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

googleLoginBtn.addEventListener("click", async () => {
  showMessage(loginMessage, "");
  try {
    const result = await signInWithPopup(auth, provider);
    const email = (result.user?.email || "").toLowerCase().trim();

    if (email !== ALLOWED_TEACHER_EMAIL.toLowerCase()) {
      await signOut(auth);
      showMessage(
        loginMessage,
        `Email ${email} không có quyền truy cập. Chỉ cho phép: ${ALLOWED_TEACHER_EMAIL}`,
        "error"
      );
      return;
    }

    showMessage(loginMessage, "Đăng nhập Google thành công.", "success");
  } catch (error) {
    console.error(error);
    let msg = "Đăng nhập Google thất bại.";
    if (error?.code === "auth/unauthorized-domain") {
      msg = "Domain này chưa được thêm trong Firebase Authorized domains.";
    } else if (error?.code === "auth/popup-closed-by-user") {
      msg = "Bạn đã đóng cửa sổ đăng nhập Google.";
    } else if (error?.code === "auth/popup-blocked") {
      msg = "Trình duyệt đang chặn popup đăng nhập Google.";
    } else {
      msg = "Đăng nhập Google thất bại. Hãy kiểm tra Google provider đã bật và domain Vercel đã thêm trong Authorized domains.";
    }
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

generateQrBtn.addEventListener("click", () => {
  const code = teacherRoomCode.value.trim().toUpperCase();
  if (!code) {
    showMessage(loginMessage, "Vui lòng nhập mã phòng để tạo QR.", "error");
    return;
  }

  if (!selectedQuestion) {
    showMessage(loginMessage, "Bạn chưa chọn đề trong ngân hàng đề.", "error");
    return;
  }

  const link = buildRoomLink(code);
  roomLink.value = link;
  renderQrImage(link);
  qrSection.classList.remove("hidden");
  showMessage(loginMessage, "Đã tạo mã QR cho học sinh.", "success");
});

copyLinkBtn.addEventListener("click", async () => {
  if (!roomLink.value) return;
  try {
    await navigator.clipboard.writeText(roomLink.value);
    showMessage(loginMessage, "Đã sao chép link vào phòng.", "success");
  } catch (error) {
    showMessage(loginMessage, "Không sao chép được. Bạn hãy copy thủ công.", "error");
  }
});

joinBtn.addEventListener("click", () => {
  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (!roomCode) {
    showMessage(joinMessage, "Vui lòng nhập mã phòng.", "error");
    return;
  }
  showMessage(joinMessage, `Đã nhập mã phòng: ${roomCode}. Bước tiếp theo sẽ làm trang phòng thi thật.`, "success");
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
      labels,
      periods,
      valuesByPeriod,
      duration: Number(questionDuration.value || 15),
      createdAt: serverTimestamp(),
      teacherEmail: ALLOWED_TEACHER_EMAIL
    });

    showMessage(questionMessage, "Đã lưu đề vào ngân hàng.", "success");

    questionTitle.value = "";
    questionGrade.value = "";
    questionSubject.value = "";
    questionLabels.value = "";
    questionPeriods.value = "";
    questionValues.value = "";
    questionDuration.value = 15;

    loadQuestions();
  } catch (err) {
    console.error(err);
    showMessage(questionMessage, "Lưu đề thất bại.", "error");
  }
});

async function loadQuestions() {
  try {
    questionList.innerHTML = "<div class='small'>Đang tải dữ liệu...</div>";
    const snapshot = await getDocs(collection(db, "question_bank"));
    const items = [];

    snapshot.forEach((item) => {
      items.push({
        id: item.id,
        ...item.data()
      });
    });

    questionList.innerHTML = "";

    if (items.length === 0) {
      questionList.innerHTML = "<div class='small'>Chưa có đề nào trong ngân hàng.</div>";
      return;
    }

    items.forEach((item) => {
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
        selectedQuestion = item;
        selectedQuestionName.textContent = item.title || "Đã chọn đề";
        showMessage(questionMessage, `Đã chọn đề: ${item.title}`, "success");
      });

      box.querySelector(".delete-btn").addEventListener("click", async () => {
        const ok = window.confirm(`Xóa đề "${item.title}"?`);
        if (!ok) return;
        await deleteDoc(doc(db, "question_bank", item.id));
        if (selectedQuestion?.id === item.id) {
          selectedQuestion = null;
          selectedQuestionName.textContent = "Chưa chọn đề";
        }
        loadQuestions();
      });

      questionList.appendChild(box);
    });
  } catch (err) {
    console.error(err);
    questionList.innerHTML = "<div class='small error'>Không tải được ngân hàng đề.</div>";
  }
}

applyRoomFromQuery();
