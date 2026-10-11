// Vonx Launcher Website — auth, profile, admin

let currentUser = null;
let currentProfile = null;

const defaultAvatar = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#2a2a32" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="#7c5cff" font-size="36" font-family="sans-serif">V</text></svg>'
);

// ---------- Auth ----------
function loginGoogle() {
  if (!isFirebaseConfigured()) {
    alert("Сначала настрой Firebase в файле js/firebase-config.js\nСмотри инструкцию в README.");
    return;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => {
    console.error(err);
    alert("Ошибка входа: " + err.message);
  });
}

function logout() {
  auth.signOut();
}

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    await ensureUserDoc(user);
    currentProfile = await loadProfile(user.uid);
    showLoggedIn(currentProfile);
    loadLatestVersion();
  } else {
    currentProfile = null;
    showLoggedOut();
    loadLatestVersion();
  }
});

async function ensureUserDoc(user) {
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  const isSuperAdmin = user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  if (!snap.exists) {
    await ref.set({
      email: user.email || "",
      nick: user.displayName || (user.email ? user.email.split("@")[0] : "Player"),
      avatar: user.photoURL || defaultAvatar,
      role: isSuperAdmin ? "admin" : "member",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else if (isSuperAdmin && snap.data().role !== "admin") {
    // всегда держим супер-админа админом
    await ref.update({ role: "admin" });
  }
}

async function loadProfile(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? { uid, ...snap.data() } : null;
}

function showLoggedIn(profile) {
  document.getElementById("btnLogin").classList.add("hidden");
  const menu = document.getElementById("userMenu");
  menu.classList.remove("hidden");
  document.getElementById("navNick").textContent = profile.nick || "User";
  document.getElementById("navAvatar").src = profile.avatar || defaultAvatar;
  const adminBtn = document.getElementById("btnAdmin");
  if (profile.role === "admin") adminBtn.classList.remove("hidden");
  else adminBtn.classList.add("hidden");
}

function showLoggedOut() {
  document.getElementById("btnLogin").classList.remove("hidden");
  document.getElementById("userMenu").classList.add("hidden");
}

function isFirebaseConfigured() {
  return typeof firebaseConfig !== "undefined" &&
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "YOUR_API_KEY";
}

// ---------- Profile ----------
function openProfile() {
  if (!currentProfile) return;
  document.getElementById("profileNick").value = currentProfile.nick || "";
  document.getElementById("profileRole").value = currentProfile.role === "admin" ? "Admin" : "Member";
  document.getElementById("profileAvatar").src = currentProfile.avatar || defaultAvatar;
  document.getElementById("profileModal").classList.remove("hidden");
}

function closeProfile() {
  document.getElementById("profileModal").classList.add("hidden");
}

async function saveProfile() {
  if (!currentUser || !currentProfile) return;
  const nick = document.getElementById("profileNick").value.trim();
  if (!nick) {
    alert("Введи ник");
    return;
  }
  try {
    await db.collection("users").doc(currentUser.uid).update({ nick });
    currentProfile.nick = nick;
    document.getElementById("navNick").textContent = nick;
    closeProfile();
  } catch (e) {
    alert("Ошибка сохранения: " + e.message);
  }
}

async function uploadAvatar(event) {
  const file = event.target.files[0];
  if (!file || !currentUser) return;
  if (file.size > 2 * 1024 * 1024) {
    alert("Максимум 2 МБ");
    return;
  }
  try {
    const path = "avatars/" + currentUser.uid + "/" + Date.now() + "_" + file.name;
    const ref = storage.ref(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.collection("users").doc(currentUser.uid).update({ avatar: url });
    currentProfile.avatar = url;
    document.getElementById("profileAvatar").src = url;
    document.getElementById("navAvatar").src = url;
  } catch (e) {
    // fallback: base64 если Storage не настроен
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result;
        await db.collection("users").doc(currentUser.uid).update({ avatar: dataUrl });
        currentProfile.avatar = dataUrl;
        document.getElementById("profileAvatar").src = dataUrl;
        document.getElementById("navAvatar").src = dataUrl;
      } catch (err) {
        alert("Ошибка аватара: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  }
}

// ---------- Versions / Download ----------
async function loadLatestVersion() {
  const el = document.getElementById("latestVersion");
  const btn = document.getElementById("downloadBtn");
  if (!isFirebaseConfigured()) {
    el.textContent = "Настрой Firebase, чтобы публиковать версии";
    btn.href = "#";
    return;
  }
  try {
    const snap = await db.collection("versions").orderBy("createdAt", "desc").limit(1).get();
    if (snap.empty) {
      el.textContent = "Версии пока не добавлены";
      btn.href = "#";
      return;
    }
    const v = snap.docs[0].data();
    el.textContent = "Версия " + v.name + (v.notes ? " — " + v.notes : "");
    btn.dataset.url = v.url || "";
  } catch (e) {
    el.textContent = "Не удалось загрузить версию";
    console.error(e);
  }
}

function downloadLauncher(e) {
  e.preventDefault();
  const btn = document.getElementById("downloadBtn");
  const url = btn.dataset.url;
  if (!url) {
    alert("Файл ещё не опубликован. Админ должен добавить версию в панели.");
    return;
  }
  window.open(url, "_blank");
}

// ---------- Admin ----------
function openAdmin() {
  if (!currentProfile || currentProfile.role !== "admin") {
    alert("Только для админов");
    return;
  }
  document.getElementById("adminModal").classList.remove("hidden");
  showAdminTab("versions");
  refreshVersionsList();
  refreshUsersList();
}

function closeAdmin() {
  document.getElementById("adminModal").classList.add("hidden");
}

function showAdminTab(name) {
  document.getElementById("tabVersions").classList.toggle("hidden", name !== "versions");
  document.getElementById("tabUsers").classList.toggle("hidden", name !== "users");
  document.querySelectorAll(".admin-tabs .tab").forEach((t, i) => {
    t.classList.toggle("active", (name === "versions" && i === 0) || (name === "users" && i === 1));
  });
}

async function addVersion() {
  if (!currentProfile || currentProfile.role !== "admin") return;
  const name = document.getElementById("newVerName").value.trim();
  const url = document.getElementById("newVerUrl").value.trim();
  const notes = document.getElementById("newVerNotes").value.trim();
  if (!name || !url) {
    alert("Укажи название и ссылку");
    return;
  }
  try {
    await db.collection("versions").add({
      name,
      url,
      notes,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.email
    });
    document.getElementById("newVerName").value = "";
    document.getElementById("newVerUrl").value = "";
    document.getElementById("newVerNotes").value = "";
    refreshVersionsList();
    loadLatestVersion();
    alert("Версия добавлена");
  } catch (e) {
    alert("Ошибка: " + e.message);
  }
}

async function refreshVersionsList() {
  const box = document.getElementById("versionsList");
  box.innerHTML = "Загрузка...";
  try {
    const snap = await db.collection("versions").orderBy("createdAt", "desc").get();
    if (snap.empty) {
      box.innerHTML = "<p style='color:#a0a0b0;font-size:13px'>Пока нет версий</p>";
      return;
    }
    box.innerHTML = "";
    snap.forEach(doc => {
      const v = doc.data();
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div class="info">
          <strong>${escapeHtml(v.name)}</strong>
          <span>${escapeHtml(v.notes || "")} · ${escapeHtml(v.url || "")}</span>
        </div>
        <button class="btn-small danger" onclick="deleteVersion('${doc.id}')">Удалить</button>
      `;
      box.appendChild(div);
    });
  } catch (e) {
    box.innerHTML = "<p style='color:#f87171'>Ошибка: " + escapeHtml(e.message) + "</p>";
  }
}

async function deleteVersion(id) {
  if (!confirm("Удалить версию?")) return;
  await db.collection("versions").doc(id).delete();
  refreshVersionsList();
  loadLatestVersion();
}

async function refreshUsersList() {
  const box = document.getElementById("usersList");
  box.innerHTML = "Загрузка...";
  try {
    const snap = await db.collection("users").orderBy("createdAt", "desc").get();
    box.innerHTML = "";
    snap.forEach(doc => {
      const u = doc.data();
      const role = u.role || "member";
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <img src="${escapeAttr(u.avatar || defaultAvatar)}" alt="" />
        <div class="info">
          <strong>${escapeHtml(u.nick || "—")}</strong>
          <span>${escapeHtml(u.email || "")}</span>
        </div>
        <span class="badge ${role === "admin" ? "badge-admin" : "badge-member"}">${role}</span>
        ${role === "admin"
          ? `<button class="btn-small" onclick="setRole('${doc.id}','member')">Снять admin</button>`
          : `<button class="btn-small accent" onclick="setRole('${doc.id}','admin')">Дать admin</button>`
        }
      `;
      box.appendChild(div);
    });
  } catch (e) {
    box.innerHTML = "<p style='color:#f87171'>Ошибка: " + escapeHtml(e.message) + "</p>";
  }
}

async function setRole(uid, role) {
  if (!currentProfile || currentProfile.role !== "admin") return;
  try {
    await db.collection("users").doc(uid).update({ role });
    refreshUsersList();
  } catch (e) {
    alert("Ошибка: " + e.message);
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

// close modals on backdrop click
document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m) {
      m.classList.add("hidden");
    }
  });
});
