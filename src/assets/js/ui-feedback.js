/**
 * ui-feedback.js — Hệ thống thông báo tập trung cho toàn bộ frontend
 *
 * Xuất 2 hàm chính:
 * - showToast(message, type, timeout) : Hiển thị toast notification góc phải màn hình
 * - showConfirm(message, options)      : Hiển thị dialog xác nhận (thay window.confirm)
 *
 * Tại sao không dùng window.alert/confirm mặc định?
 * → Xấu, không thể style, chặn UI thread, không accessible
 * → Module này cung cấp UI đẹp, không chặn, hỗ trợ keyboard (Escape)
 *
 * Cách dùng:
 *   import { showToast, showConfirm } from './ui-feedback.js';
 *   showToast('Đặt hàng thành công', 'success');
 *   const ok = await showConfirm('Bạn có chắc muốn xóa?', { tone: 'danger' });
 */

// Cấu hình icon và màu cho từng loại toast
const TOAST_META = {
  success: { icon: "bi-check2-circle", accent: "#198754", label: "Thành công" },
  error:   { icon: "bi-exclamation-circle", accent: "#dc3545", label: "Có lỗi" },
  warning: { icon: "bi-exclamation-triangle", accent: "#f59f00", label: "Lưu ý" },
  default: { icon: "bi-info-circle", accent: "#212529", label: "Thông báo" },
};

function ensureFeedbackStyles() {
  if (document.getElementById("maverik-ui-feedback-styles")) return;

  const style = document.createElement("style");
  style.id = "maverik-ui-feedback-styles";
  style.textContent = `
    .maverik-toast-stack {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 20000;
      display: grid;
      gap: 10px;
      width: min(360px, calc(100vw - 32px));
      pointer-events: none;
    }

    .maverik-toast {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) 28px;
      align-items: center;
      gap: 12px;
      min-height: 64px;
      padding: 12px 12px 12px 14px;
      background: #fff;
      border: 1px solid #ececec;
      border-left: 4px solid var(--maverik-toast-accent, #212529);
      border-radius: 8px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, .16);
      color: #171717;
      pointer-events: auto;
      transform: translateX(18px);
      opacity: 0;
      transition: opacity .18s ease, transform .18s ease;
    }

    .maverik-toast.is-visible {
      opacity: 1;
      transform: translateX(0);
    }

    .maverik-toast__icon {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--maverik-toast-accent, #212529) 12%, #fff);
      color: var(--maverik-toast-accent, #212529);
      font-size: 1rem;
    }

    .maverik-toast__title {
      margin: 0 0 2px;
      font-size: .76rem;
      font-weight: 700;
      letter-spacing: .04em;
      text-transform: uppercase;
      color: #6c757d;
    }

    .maverik-toast__message {
      margin: 0;
      font-size: .9rem;
      font-weight: 600;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .maverik-toast__close {
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 50%;
      background: #f6f6f6;
      color: #555;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .maverik-confirm-backdrop {
      position: fixed;
      inset: 0;
      z-index: 20001;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(17, 17, 17, .46);
      opacity: 0;
      transition: opacity .18s ease;
    }

    .maverik-confirm-backdrop.is-visible {
      opacity: 1;
    }

    .maverik-confirm {
      width: min(420px, 100%);
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 24px 70px rgba(0, 0, 0, .26);
      overflow: hidden;
      transform: translateY(12px) scale(.98);
      transition: transform .18s ease;
    }

    .maverik-confirm-backdrop.is-visible .maverik-confirm {
      transform: translateY(0) scale(1);
    }

    .maverik-confirm__body {
      padding: 24px 24px 18px;
    }

    .maverik-confirm__eyebrow {
      margin: 0 0 8px;
      color: #6c757d;
      font-size: .74rem;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .maverik-confirm__message {
      margin: 0;
      color: #151515;
      font-size: 1rem;
      font-weight: 650;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .maverik-confirm__actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 0 24px 24px;
    }

    .maverik-confirm__btn {
      min-width: 96px;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: .88rem;
      font-weight: 700;
      border: 1px solid #d8d8d8;
      background: #fff;
      color: #222;
      cursor: pointer;
    }

    .maverik-confirm__btn--primary {
      border-color: var(--maverik-confirm-accent, #212529);
      background: var(--maverik-confirm-accent, #212529);
      color: #fff;
    }

    @media (max-width: 575px) {
      .maverik-toast-stack {
        top: 14px;
        right: 14px;
        left: 14px;
        width: auto;
      }

      .maverik-confirm__actions {
        flex-direction: column-reverse;
      }

      .maverik-confirm__btn {
        width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Lấy (hoặc tạo) container chứa tất cả toast notifications
 * Dùng lazy creation: chỉ tạo DOM element khi có toast đầu tiên
 */
function getToastStack() {
  ensureFeedbackStyles();
  let stack = document.getElementById("maverik-toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "maverik-toast-stack";
    stack.className = "maverik-toast-stack";
    document.body.appendChild(stack);
  }
  return stack;
}

/**
 * Loại bỏ emoji/ký tự đặc biệt ở đầu message để tránh hiển thị 2 lần
 * (vì toast đã có icon riêng)
 */
function normalizeMessage(message) {
  return String(message ?? "")
    .replace(/^[\s✅❌⚠️!]+/u, "")
    .trim();
}

/**
 * Tự động xác định loại toast từ nội dung message nếu type không được chỉ định
 * Giúp gọi showToast với 1 tham số: showToast('Đặt hàng thành công')
 */
function inferToastType(message, type) {
  if (type && type !== "default") return type; // Type đã được chỉ định → dùng luôn
  const raw = String(message ?? "").toLowerCase();
  if (/[❌]|lỗi|thất bại|không thể|không hợp lệ/.test(raw)) return "error";
  if (/[⚠️]|kiểm tra|lưu ý/.test(raw)) return "warning";
  if (/[✅]|thành công|đã gửi|đã đăng xuất/.test(raw)) return "success";
  return "default"; // Không khớp pattern nào → thông báo thông thường
}

/**
 * Hiển thị toast notification ở góc phải màn hình
 *
 * @param {string} message - Nội dung thông báo
 * @param {string} type    - Loại: 'success' | 'error' | 'warning' | 'default'
 *                          Nếu không truyền → tự suy ra từ nội dung message
 * @param {number} timeout - Thời gian tự ẩn (ms), mặc định 3.6 giây
 *
 * @example
 * showToast('Đặt hàng thành công!', 'success');
 * showToast('Email không hợp lệ', 'error', 5000);
 */
export function showToast(message, type = "default", timeout = 3600) {
  const resolvedType = inferToastType(message, type);
  const meta = TOAST_META[resolvedType] || TOAST_META.default;
  const toast = document.createElement("div");
  toast.className = "maverik-toast";
  toast.style.setProperty("--maverik-toast-accent", meta.accent);
  toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <span class="maverik-toast__icon"><i class="bi ${meta.icon}"></i></span>
    <span>
      <p class="maverik-toast__title">${meta.label}</p>
      <p class="maverik-toast__message"></p>
    </span>
    <button class="maverik-toast__close" type="button" aria-label="Đóng"><i class="bi bi-x"></i></button>
  `;
  toast.querySelector(".maverik-toast__message").textContent = normalizeMessage(message);

  const removeToast = () => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector("button")?.addEventListener("click", removeToast);
  getToastStack().appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(removeToast, timeout);
}

/**
 * Hiển thị dialog xác nhận (thay thế window.confirm)
 * Trả về Promise<boolean> — true nếu user bấm Xác nhận, false nếu Hủy/Escape
 *
 * @param {string} message         - Câu hỏi xác nhận
 * @param {Object} options
 * @param {string} options.title       - Tiêu đề nhỏ phía trên (mặc định: "Xác nhận thao tác")
 * @param {string} options.tone        - 'danger' → nút xác nhận màu đỏ (cho hành động nguy hiểm)
 * @param {string} options.confirmText - Text nút xác nhận (mặc định: "Xác nhận")
 * @param {string} options.cancelText  - Text nút hủy (mặc định: "Hủy")
 *
 * @example
 * const ok = await showConfirm('Xóa sản phẩm này?', { tone: 'danger', confirmText: 'Xóa' });
 * if (ok) { // user đã xác nhận }
 */
export function showConfirm(message, options = {}) {
  ensureFeedbackStyles();

  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const accent = options.tone === "danger" ? "#dc3545" : "#212529";
    const backdrop = document.createElement("div");
    backdrop.className = "maverik-confirm-backdrop";
    backdrop.innerHTML = `
      <div class="maverik-confirm" role="dialog" aria-modal="true" aria-labelledby="maverik-confirm-title" style="--maverik-confirm-accent:${accent}">
        <div class="maverik-confirm__body">
          <p class="maverik-confirm__eyebrow" id="maverik-confirm-title">${options.title || "Xác nhận thao tác"}</p>
          <p class="maverik-confirm__message"></p>
        </div>
        <div class="maverik-confirm__actions">
          <button class="maverik-confirm__btn" type="button" data-result="false">${options.cancelText || "Hủy"}</button>
          <button class="maverik-confirm__btn maverik-confirm__btn--primary" type="button" data-result="true">${options.confirmText || "Xác nhận"}</button>
        </div>
      </div>
    `;
    backdrop.querySelector(".maverik-confirm__message").textContent = normalizeMessage(message);

    const close = (result) => {
      backdrop.classList.remove("is-visible");
      document.removeEventListener("keydown", handleKeydown);
      setTimeout(() => {
        backdrop.remove();
        if (previousFocus?.focus) previousFocus.focus();
        resolve(result);
      }, 180);
    };

    const handleKeydown = (event) => {
      if (event.key === "Escape") close(false);
    };

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(false);
    });
    backdrop.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => close(button.dataset.result === "true"));
    });
    document.addEventListener("keydown", handleKeydown);
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => {
      backdrop.classList.add("is-visible");
      backdrop.querySelector("[data-result='true']")?.focus();
    });
  });
}

// Expose lên window object để dùng được từ HTML inline script (không dùng ES module)
// và override window.alert để tất cả alert() trong app đều dùng toast thay vì popup xấu
if (typeof window !== "undefined") {
  window.MaverikUI = { toast: showToast, confirm: showConfirm };
  window.alert = (message) => showToast(message); // Override alert mặc định của browser
}