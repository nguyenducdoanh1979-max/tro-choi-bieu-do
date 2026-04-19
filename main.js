import { auth, provider } from "./firebase.js";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Chỉ các email trong danh sách này mới đăng nhập được
const ALLOWED_TEACHER_EMAILS = [
  "nguyenducdoanh1979@gmail.com"
];

const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMessage = document.getElementById("loginMessage");
const teacherCard = document.getElementById("teacherCard");
const teacherEmail = document.getElementById("teacherEmail");

const joinBtn = document.getElementById("joinBtn");
const joinMessage = document.getElementById("joinMessage");

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
  }
}

googleLoginBtn.addEventListener("click", async () => {
  showMessage(loginMessage, "");
  try {
    const result = await signInWithPopup(auth, provider);
    const email = result.user?.email || "";

    if (!ALLOWED_TEACHER_EMAILS.includes(email)) {
      await signOut(auth);
      showMessage(
        loginMessage,
        "Email này không có quyền truy cập phần giáo viên.",
        "error"
      );
      return;
    }

    showMessage(loginMessage, "Đăng nhập Google thành công.", "success");
  } catch (error) {
    console.error(error);
    showMessage(
      loginMessage,
      "Đăng nhập Google thất bại. Kiểm tra lại Firebase Authentication và domain được phép.",
      "error"
    );
  }
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showMessage(loginMessage, "Đã đăng xuất.", "success");
});

onAuthStateChanged(auth, (user) => {
  renderTeacher(user);
});

joinBtn.addEventListener("click", () => {
  const roomCode = document.getElementById("roomCode").value.trim();
  if (!roomCode) {
    showMessage(joinMessage, "Vui lòng nhập mã phòng.", "error");
    return;
  }
  showMessage(
    joinMessage,
    `Đã nhập mã phòng: ${roomCode}. Phần vào phòng thật sẽ làm ở bước tiếp theo.`,
    "success"
  );
});
