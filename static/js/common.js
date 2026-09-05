// توابع مشترک بین صفحات: مدیریت توکن، هدر Authorization، و پیام‌های toast
//
// نکته‌ی امنیتی: از sessionStorage به‌جای localStorage استفاده می‌کنیم چون
// sessionStorage با بسته‌شدن تب/مرورگر خودش پاک می‌شه — یعنی کاربر خودکار لاگ‌اوت می‌شه.
// (توجه: اگه مرورگر با قابلیت «بازیابی تب‌های قبلی» باز بشه، بعضی مرورگرها
// sessionStorage رو هم بازیابی می‌کنن؛ این محدودیتِ شناخته‌شده‌ی این روشه.)

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // ۱۵ دقیقه
let _activityWatcherStarted = false;

const Auth = {
  getToken() {
    return sessionStorage.getItem("access_token");
  },
  getIsAdmin() {
    return sessionStorage.getItem("is_admin") === "true";
  },
  getUsername() {
    return sessionStorage.getItem("username") || "";
  },
  getDisplayName() {
    return sessionStorage.getItem("display_name") || this.getUsername();
  },
  save(token, user) {
    sessionStorage.setItem("access_token", token);
    sessionStorage.setItem("is_admin", String(user.is_admin));
    sessionStorage.setItem("username", user.username);
    sessionStorage.setItem("display_name", user.effective_display_name || user.username);
    this.touchActivity();
  },
  /** فقط پاک می‌کنه، ریدایرکت نمی‌کنه (برای وقتی از قبل تو صفحه‌ی لاگین هستیم) */
  clear() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("is_admin");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("display_name");
    sessionStorage.removeItem("last_activity");
  },
  logout() {
    this.clear();
    window.location.href = "/";
  },
  touchActivity() {
    sessionStorage.setItem("last_activity", String(Date.now()));
  },
  isExpired() {
    const last = Number(sessionStorage.getItem("last_activity") || 0);
    if (!last) return false;
    return Date.now() - last > INACTIVITY_LIMIT_MS;
  },
  /** اگه توکن نبود، منقضی شده بود، یا (در صورت نیاز) ادمین نبود، ریدایرکت می‌کنه */
  requireAuth({ adminOnly = false } = {}) {
    const token = this.getToken();
    if (!token) {
      window.location.href = "/";
      return null;
    }
    if (this.isExpired()) {
      this.logout();
      return null;
    }
    if (adminOnly && !this.getIsAdmin()) {
      window.location.href = "/upload";
      return null;
    }
    this.touchActivity();
    startActivityWatcher();
    return token;
  },
};

/**
 * فعالیت کاربر (کلیک، تایپ، اسکرول و ...) رو زیر نظر می‌گیره و اگه ۱۵ دقیقه
 * هیچ فعالیتی ثبت نشه، خودکار لاگ‌اوت می‌کنه. فقط یک بار در هر صفحه فعال می‌شه.
 */
function startActivityWatcher() {
  if (_activityWatcherStarted) return;
  _activityWatcherStarted = true;

  let lastTouch = 0;
  const throttledTouch = () => {
    const now = Date.now();
    if (now - lastTouch < 10000) return; // حداکثر هر ۱۰ ثانیه یک‌بار بنویسیم
    lastTouch = now;
    Auth.touchActivity();
  };

  ["click", "mousemove", "keydown", "touchstart", "scroll"].forEach((evt) =>
    document.addEventListener(evt, throttledTouch, { passive: true })
  );

  setInterval(() => {
    if (Auth.isExpired()) {
      Auth.logout();
    }
  }, 20000);
}

function authHeader() {
  return { Authorization: `Bearer ${Auth.getToken()}` };
}

/** fetch با هدر Authorization و مدیریت خطای ۴۰۱ (توکن منقضی) */
async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}), ...authHeader() };
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    Auth.logout();
    throw new Error("توکن منقضی شده — لطفاً دوباره وارد شوید");
  }
  return res;
}

function showToast(message, duration = 2600) {
  let el = document.getElementById("app-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("visible"), duration);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ثبت service worker (برای قابل‌نصب‌شدن PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/static/service-worker.js").catch(() => {});
  });
}
