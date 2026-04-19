import { auth, provider } from "./firebase.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
  } else {
    teacherCard.classList.add("hidden");
    teacherEmail.textContent = "";
    googleLoginBtn.classList.remove("hidden");
    qrSection.classList.add("hidden");
  }
}

function buildRoomLink(code) {
  const cleanCode = code.trim().toUpperCase();
  return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(cleanCode)}`;
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
    if (error && error.code === "auth/unauthorized-domain") {
      msg = "Domain này chưa được thêm trong Firebase Authorized domains.";
    } else if (error && error.code === "auth/popup-closed-by-user") {
      msg = "Bạn đã đóng cửa sổ đăng nhập Google.";
    } else if (error && error.code === "auth/popup-blocked") {
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

applyRoomFromQuery();
