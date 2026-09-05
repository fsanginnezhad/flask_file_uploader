Auth.requireAuth({ adminOnly: true });

// اگه با دکمه‌ی back به این صفحه برگردیم (بعد از لاگ‌اوت)، دوباره چک کنیم
window.addEventListener("pageshow", () => {
  Auth.requireAuth({ adminOnly: true });
});

document.getElementById("logout-btn").addEventListener("click", () => Auth.logout());

// ---------------------------------------------------------------------
// تب‌ها
// ---------------------------------------------------------------------
const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");

    if (btn.dataset.tab === "settings") loadSettings();
    if (btn.dataset.tab === "folders") loadFolders();
    if (btn.dataset.tab === "upload") loadUploadTargets();
  });
});

// ---------------------------------------------------------------------
// تب کاربران
// ---------------------------------------------------------------------
const usersTbody = document.getElementById("users-tbody");
let cachedUsers = [];

async function loadUsers() {
  const res = await apiFetch("/admin/users");
  const data = await res.json();
  cachedUsers = data.users || [];
  renderUsers();
}

function renderUsers() {
  usersTbody.innerHTML = "";
  cachedUsers.forEach((u) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.username}</td>
      <td><input type="text" value="${u.display_name ?? ""}" placeholder="${u.username}" data-field="display_name" /></td>
      <td>
        <span class="badge ${u.is_admin ? "" : "muted"}">${u.is_admin ? "ادمین" : "کاربر عادی"}</span>
      </td>
      <td>
        <span class="badge ${u.is_active ? "" : "muted"}">${u.is_active ? "فعال" : "غیرفعال"}</span>
      </td>
      <td><input type="number" min="1" value="${u.max_file_size_mb ?? ""}" placeholder="${u.effective_max_file_size_mb}" data-field="max_file_size_mb" /></td>
      <td><input type="text" value="${u.allowed_extensions ?? ""}" placeholder="${u.effective_allowed_extensions.join(",")}" data-field="allowed_extensions" /></td>
      <td>
        <div class="row-actions">
          <button class="btn btn-primary btn-small" data-action="save">ذخیره</button>
          <button class="btn btn-ghost btn-small" data-action="toggle-active">${u.is_active ? "غیرفعال کردن" : "فعال کردن"}</button>
          <button class="btn btn-ghost btn-small" data-action="toggle-admin">${u.is_admin ? "حذف ادمین" : "ادمین کردن"}</button>
          <button class="btn btn-danger btn-small" data-action="delete">حذف</button>
        </div>
      </td>
    `;

    tr.querySelector('[data-action="save"]').addEventListener("click", () => saveUserFields(u.id, tr));
    tr.querySelector('[data-action="toggle-active"]').addEventListener("click", () => toggleActive(u));
    tr.querySelector('[data-action="toggle-admin"]').addEventListener("click", () => toggleAdmin(u));
    tr.querySelector('[data-action="delete"]').addEventListener("click", () => deleteUser(u));

    usersTbody.appendChild(tr);
  });
}

async function saveUserFields(userId, tr) {
  const displayNameInput = tr.querySelector('[data-field="display_name"]');
  const maxSizeInput = tr.querySelector('[data-field="max_file_size_mb"]');
  const extInput = tr.querySelector('[data-field="allowed_extensions"]');

  const payload = {
    display_name: displayNameInput.value.trim() === "" ? "" : displayNameInput.value.trim(),
    max_file_size_mb: maxSizeInput.value.trim() === "" ? null : Number(maxSizeInput.value),
    allowed_extensions: extInput.value.trim() === "" ? null : extInput.value.trim(),
  };

  const res = await apiFetch(`/admin/users/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || "خطا در ذخیره تغییرات");
    return;
  }
  showToast("تغییرات ذخیره شد");
  loadUsers();
}

async function toggleActive(user) {
  const res = await apiFetch(`/admin/users/${user.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: !user.is_active }),
  });
  if (!res.ok) {
    const data = await res.json();
    showToast(data.error || "خطا");
    return;
  }
  loadUsers();
}

async function toggleAdmin(user) {
  const res = await apiFetch(`/admin/users/${user.id}/promote`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_admin: !user.is_admin }),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || "خطا");
    return;
  }
  loadUsers();
}

async function deleteUser(user) {
  if (!confirm(`کاربر «${user.username}» حذف شود؟ تمام فایل‌های او هم حذف خواهد شد.`)) return;

  const res = await apiFetch(`/admin/users/${user.id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || "خطا در حذف کاربر");
    return;
  }
  showToast("کاربر حذف شد");
  loadUsers();
}

// فرم افزودن کاربر
const addUserBtn = document.getElementById("add-user-btn");
const addUserForm = document.getElementById("add-user-form");

addUserBtn.addEventListener("click", () => {
  addUserForm.style.display = addUserForm.style.display === "none" ? "block" : "none";
});

document.getElementById("cancel-new-user-btn").addEventListener("click", () => {
  addUserForm.style.display = "none";
});

document.getElementById("save-new-user-btn").addEventListener("click", async () => {
  const username = document.getElementById("new-username").value.trim();
  const displayName = document.getElementById("new-display-name").value.trim();
  const password = document.getElementById("new-password").value;
  const isAdmin = document.getElementById("new-is-admin").checked;

  if (!username || !password) {
    showToast("نام کاربری و رمز عبور الزامی است");
    return;
  }

  const res = await apiFetch("/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, display_name: displayName, password, is_admin: isAdmin }),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || "خطا در ساخت کاربر");
    return;
  }

  showToast("کاربر ساخته شد");
  document.getElementById("new-username").value = "";
  document.getElementById("new-display-name").value = "";
  document.getElementById("new-password").value = "";
  document.getElementById("new-is-admin").checked = false;
  addUserForm.style.display = "none";
  loadUsers();
});

// ---------------------------------------------------------------------
// تب تنظیمات سراسری
// ---------------------------------------------------------------------
async function loadSettings() {
  const res = await apiFetch("/admin/settings");
  const data = await res.json();
  document.getElementById("settings-max-size").value = data.settings.default_max_file_size_mb;
  document.getElementById("settings-extensions").value = data.settings.default_allowed_extensions;
}

document.getElementById("save-settings-btn").addEventListener("click", async () => {
  const payload = {
    default_max_file_size_mb: Number(document.getElementById("settings-max-size").value),
    default_allowed_extensions: document.getElementById("settings-extensions").value.trim(),
  };
  const res = await apiFetch("/admin/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || "خطا در ذخیره تنظیمات");
    return;
  }
  showToast("تنظیمات پیش‌فرض ذخیره شد");
});

// ---------------------------------------------------------------------
// تب پوشه‌ها
// ---------------------------------------------------------------------
const folderList = document.getElementById("folder-list");
const folderFilesHint = document.getElementById("folder-files-hint");
const folderFilesTable = document.getElementById("folder-files-table");
const folderFilesTbody = document.getElementById("folder-files-tbody");

async function loadFolders() {
  const res = await apiFetch("/admin/folders");
  const data = await res.json();
  folderList.innerHTML = "";

  (data.folders || []).forEach((f) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.innerHTML = `${f.owner_username} <span class="count">(${f.file_count})</span>`;
    btn.addEventListener("click", () => {
      folderList.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadFolderFiles(f.owner_id, f.owner_username);
    });
    li.appendChild(btn);
    folderList.appendChild(li);
  });
}

async function loadFolderFiles(userId, username) {
  const res = await apiFetch(`/admin/folders/${userId}/files`);
  const data = await res.json();
  const files = data.files || [];

  folderFilesHint.textContent = files.length === 0 ? `پوشه‌ی «${username}» خالی است` : "";
  folderFilesTable.style.display = files.length === 0 ? "none" : "table";
  folderFilesTbody.innerHTML = "";

  files.forEach((f) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${f.original_filename}</td>
      <td>${formatBytes(f.size_bytes)}</td>
      <td>${new Date(f.uploaded_at).toLocaleString("fa-IR")}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-small" data-action="rename">تغییر نام</button>
          <button class="btn btn-danger btn-small" data-action="delete">حذف</button>
        </div>
      </td>
    `;
    tr.querySelector('[data-action="rename"]').addEventListener("click", () => renameFile(f, userId, username));
    tr.querySelector('[data-action="delete"]').addEventListener("click", () => deleteFile(f, userId, username));
    folderFilesTbody.appendChild(tr);
  });
}

async function renameFile(file, userId, username) {
  const newName = prompt("نام جدید فایل:", file.original_filename);
  if (!newName || newName.trim() === "") return;

  const res = await apiFetch(`/admin/files/${file.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ original_filename: newName.trim() }),
  });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || "خطا در تغییر نام");
    return;
  }
  showToast("نام فایل تغییر کرد");
  loadFolderFiles(userId, username);
}

async function deleteFile(file, userId, username) {
  if (!confirm(`فایل «${file.original_filename}» حذف شود؟`)) return;

  const res = await apiFetch(`/admin/files/${file.id}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) {
    showToast(data.error || "خطا در حذف فایل");
    return;
  }
  showToast("فایل حذف شد");
  loadFolders();
  loadFolderFiles(userId, username);
}

// ---------------------------------------------------------------------
// تب آپلود توسط ادمین
// ---------------------------------------------------------------------
async function loadUploadTargets() {
  const select = document.getElementById("admin-upload-target");
  if (cachedUsers.length === 0) {
    const res = await apiFetch("/admin/users");
    const data = await res.json();
    cachedUsers = data.users || [];
  }
  select.innerHTML = cachedUsers
    .map((u) => {
      const label = u.display_name ? `${u.display_name} (${u.username})` : u.username;
      return `<option value="${u.id}">${label}</option>`;
    })
    .join("");
}

document.getElementById("admin-upload-btn").addEventListener("click", async () => {
  const targetId = document.getElementById("admin-upload-target").value;
  const input = document.getElementById("admin-upload-input");
  const resultBox = document.getElementById("admin-upload-result");

  if (!input.files.length) {
    showToast("فایلی انتخاب نشده است");
    return;
  }

  const formData = new FormData();
  formData.append("target_user_id", targetId);
  Array.from(input.files).forEach((f) => formData.append("files", f));

  const res = await apiFetch("/admin/upload", { method: "POST", body: formData });
  const data = await res.json();

  resultBox.classList.add("visible");
  if (!res.ok) {
    resultBox.className = "result-box visible";
    resultBox.textContent = data.error || "خطا در آپلود";
    return;
  }

  resultBox.className = "result-box success visible";
  resultBox.textContent = `${(data.uploaded || []).length} فایل با موفقیت آپلود شد.`;
  input.value = "";
  loadFolders();
});

// ---------------------------------------------------------------------
// بارگذاری اولیه
// ---------------------------------------------------------------------
loadUsers();
