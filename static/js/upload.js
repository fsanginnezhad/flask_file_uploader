Auth.requireAuth({ adminOnly: false });

// اگه با دکمه‌ی back به این صفحه برگردیم (بعد از لاگ‌اوت)، دوباره چک کنیم
window.addEventListener("pageshow", () => {
  Auth.requireAuth({ adminOnly: false });
});

document.getElementById("welcome-text").textContent = `خوش آمدید ${Auth.getDisplayName()}`;
document.getElementById("logout-btn").addEventListener("click", () => Auth.logout());

const fileInput = document.getElementById("file-input");
const filePicker = document.getElementById("file-picker");
const filePickerLabel = document.getElementById("file-picker-label");
const fileList = document.getElementById("file-list");
const clearFilesBtn = document.getElementById("clear-files-btn");
const uploadBtn = document.getElementById("upload-btn");
const uploadForm = document.getElementById("upload-form");
const errorBox = document.getElementById("error-box");
const resultBox = document.getElementById("result-box");
const progressTrack = document.getElementById("progress-track");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");

// فایل‌های انتخاب‌شده رو خودمون تو یه آرایه نگه می‌داریم (نه مستقیم fileInput.files)
// چون FileList بومی مرورگر قابل ویرایش نیست و نمی‌شه تکی حذف کرد.
let selectedFiles = [];

function addFiles(newFiles) {
  newFiles.forEach((f) => {
    const alreadyAdded = selectedFiles.some(
      (sf) => sf.name === f.name && sf.size === f.size && sf.lastModified === f.lastModified
    );
    if (!alreadyAdded) selectedFiles.push(f);
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

function clearAllFiles() {
  selectedFiles = [];
  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = "";
  resultBox.classList.remove("visible");
  errorBox.classList.remove("visible");

  if (selectedFiles.length === 0) {
    filePicker.classList.remove("has-files");
    filePickerLabel.textContent = "برای انتخاب فایل ضربه بزنید";
    uploadBtn.disabled = true;
    clearFilesBtn.style.display = "none";
    return;
  }

  filePicker.classList.add("has-files");
  filePickerLabel.textContent = `${selectedFiles.length} فایل انتخاب شد`;
  uploadBtn.disabled = false;
  clearFilesBtn.style.display = "inline-flex";

  selectedFiles.forEach((f, idx) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = `${f.name} — ${formatBytes(f.size)}`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-file-btn";
    removeBtn.setAttribute("aria-label", `حذف ${f.name}`);
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => removeFile(idx));

    li.appendChild(span);
    li.appendChild(removeBtn);
    fileList.appendChild(li);
  });
}

fileInput.addEventListener("change", () => {
  addFiles(Array.from(fileInput.files));
  fileInput.value = ""; // ریست می‌کنیم تا انتخاب بعدی به‌عنوان فایل‌های جدید اضافه بشه، نه جایگزین
  renderFileList();
});

clearFilesBtn.addEventListener("click", clearAllFiles);

uploadForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (selectedFiles.length === 0) return;

  errorBox.classList.remove("visible");
  resultBox.classList.remove("visible");
  uploadBtn.disabled = true;
  uploadBtn.textContent = "در حال آپلود...";

  const formData = new FormData();
  selectedFiles.forEach((f) => formData.append("files", f));

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/files/upload");
  xhr.setRequestHeader("Authorization", `Bearer ${Auth.getToken()}`);

  progressTrack.classList.add("visible");
  progressLabel.classList.add("visible");
  progressFill.style.width = "0%";
  progressLabel.textContent = "۰٪";

  xhr.upload.addEventListener("progress", (event) => {
    if (!event.lengthComputable) return;
    const percent = Math.round((event.loaded / event.total) * 100);
    progressFill.style.width = `${percent}%`;
    progressLabel.textContent = `${percent}٪`;
  });

  xhr.onload = () => {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "آپلود";
    progressTrack.classList.remove("visible");
    progressLabel.classList.remove("visible");

    let data;
    try {
      data = JSON.parse(xhr.responseText);
    } catch {
      data = null;
    }

    if (xhr.status === 401) {
      Auth.logout();
      return;
    }

    if (!data) {
      errorBox.textContent = "خطای غیرمنتظره در آپلود";
      errorBox.classList.add("visible");
      return;
    }

    const uploaded = data.uploaded || [];
    const errors = data.errors || [];

    if (uploaded.length > 0) {
      // اول فرم رو ریست می‌کنیم (چون renderFileList پیام قبلی رو پاک می‌کنه)، بعد پیام موفقیت رو نشون می‌دیم
      clearAllFiles();
      resultBox.className = "result-box success visible";
      let html = `آپلود ${uploaded.length} فایل با موفقیت انجام شد.`;
      if (errors.length > 0) {
        html += `<ul>${errors.map((e) => `<li>${e.filename}: ${e.error}</li>`).join("")}</ul>`;
      }
      resultBox.innerHTML = html;
      showToast("آپلود با موفقیت انجام شد");
    } else {
      errorBox.innerHTML =
        errors.length > 0
          ? errors.map((e) => `${e.filename}: ${e.error}`).join("<br />")
          : data.error || "آپلود ناموفق بود";
      errorBox.classList.add("visible");
    }

    uploadBtn.disabled = selectedFiles.length === 0;
  };

  xhr.onerror = () => {
    uploadBtn.disabled = false;
    uploadBtn.textContent = "آپلود";
    progressTrack.classList.remove("visible");
    progressLabel.classList.remove("visible");
    errorBox.textContent = "اتصال به سرور برقرار نشد";
    errorBox.classList.add("visible");
  };

  xhr.send(formData);
});
