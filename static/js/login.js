// اگه کاربر از قبل توکن معتبر داره، مستقیم بفرستش به صفحه‌ی مربوطه.
// از رویداد pageshow استفاده می‌کنیم (نه فقط اجرای مستقیم اسکریپت) چون این رویداد
// هم موقع لود عادی صفحه و هم موقع برگشت با دکمه‌ی back (از حافظه‌ی bfcache) فایر می‌شه —
// در غیر این صورت با زدن back ممکنه صفحه‌ی لاگین (نسخه‌ی کش‌شده) دوباره نمایش داده بشه.
window.addEventListener("pageshow", () => {
  const token = Auth.getToken();
  if (!token) return;

  if (Auth.isExpired()) {
    Auth.clear(); // فقط پاک می‌کنیم، چون از قبل تو صفحه‌ی لاگین هستیم
    return;
  }

  Auth.touchActivity();
  window.location.href = Auth.getIsAdmin() ? "/panel" : "/upload";
});

const form = document.getElementById("login-form");
const errorBox = document.getElementById("error-box");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.classList.remove("visible");
  submitBtn.disabled = true;
  submitBtn.textContent = "در حال ورود...";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "ورود ناموفق بود");
    }

    Auth.save(data.access_token, data.user);
    window.location.href = data.user.is_admin ? "/panel" : "/upload";
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.add("visible");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "ورود";
  }
});
