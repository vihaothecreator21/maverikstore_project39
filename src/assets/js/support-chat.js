import { getApiBase } from "./api-config.js";

/**
 * Maverik Support Chat Widget
 *
 * File này tự tạo toàn bộ giao diện chatbot bằng JavaScript:
 * - Không cần sửa nhiều HTML ở từng trang.
 * - Chỉ cần import file này, widget sẽ tự xuất hiện ở góc phải.
 * - API key Gemini KHÔNG nằm ở frontend; frontend chỉ gọi backend /support-chat.
 *
 * Event chính:
 * - Nút toggle mở/đóng panel chat.
 * - Form submit/chip click gọi sendMessage().
 * - sendMessage() POST /support-chat kèm message, lịch sử ngắn, context trang hiện tại.
 */

const API_BASE = getApiBase();
const STORAGE_KEY = "maverik_support_chat_history";

// Giữ lịch sử ngắn ở browser để chatbot nhớ vài câu gần nhất.
// Không lưu quá nhiều để tránh gửi dữ liệu dài/tốn token.
let chatHistory = loadHistory();
let isOpen = false;
let isSending = false;

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw).slice(-8) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory.slice(-8)));
}

function getCurrentPageContext() {
  const params = new URLSearchParams(window.location.search);

  // Context này giúp backend biết khách đang xem trang nào.
  // Nếu đang ở trang chi tiết sản phẩm, gửi slug/id để AI tư vấn đúng sản phẩm đó.
  return {
    currentPage: window.location.pathname.split("/").pop() || "index.html",
    productId: params.get("id") || undefined,
    productSlug: params.get("slug") || undefined,
  };
}

function createStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .mav-chat-root {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 1050;
      font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
    }

    .mav-chat-toggle {
      width: 56px;
      height: 56px;
      border: 0;
      border-radius: 50%;
      background: #1a1a1a;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 12px 34px rgba(0,0,0,.22);
      cursor: pointer;
      transition: transform .18s ease, background .18s ease;
    }

    .mav-chat-toggle:hover { transform: translateY(-2px); background: #333; }
    .mav-chat-toggle i { font-size: 1.35rem; }

    .mav-chat-panel {
      width: min(360px, calc(100vw - 32px));
      height: min(560px, calc(100vh - 110px));
      margin-bottom: 14px;
      background: #fff;
      border: 1px solid #e5e5e5;
      box-shadow: 0 18px 48px rgba(0,0,0,.2);
      display: none;
      flex-direction: column;
    }

    .mav-chat-panel.open { display: flex; }

    .mav-chat-header {
      padding: 14px 16px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #1a1a1a;
      color: #fff;
    }

    .mav-chat-title { font-size: .9rem; font-weight: 700; letter-spacing: .02em; }
    .mav-chat-subtitle { font-size: .72rem; opacity: .78; margin-top: 2px; }

    .mav-chat-close {
      border: 0;
      background: transparent;
      color: #fff;
      font-size: 1.1rem;
      cursor: pointer;
      line-height: 1;
    }

    .mav-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      background: #fafaf8;
    }

    .mav-chat-msg {
      max-width: 86%;
      padding: 10px 12px;
      margin-bottom: 10px;
      font-size: .84rem;
      line-height: 1.45;
      border: 1px solid #e8e8e8;
      white-space: pre-wrap;
    }

    .mav-chat-msg.user {
      margin-left: auto;
      background: #1a1a1a;
      color: #fff;
      border-color: #1a1a1a;
    }

    .mav-chat-msg.assistant {
      margin-right: auto;
      background: #fff;
      color: #222;
    }

    .mav-chat-products {
      display: grid;
      gap: 8px;
      margin: 4px 0 12px;
    }

    .mav-chat-product {
      display: block;
      color: #1a1a1a;
      text-decoration: none;
      background: #fff;
      border: 1px solid #e4e4e4;
      padding: 9px 10px;
      font-size: .78rem;
    }

    .mav-chat-product strong { display: block; margin-bottom: 2px; }
    .mav-chat-product span { color: #c43228; font-weight: 700; }

    .mav-chat-quick {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 10px 14px 0;
      background: #fafaf8;
    }

    .mav-chat-chip {
      border: 1px solid #ddd;
      background: #fff;
      padding: 6px 9px;
      font-size: .72rem;
      cursor: pointer;
    }

    .mav-chat-form {
      display: flex;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #eee;
      background: #fff;
    }

    .mav-chat-input {
      flex: 1;
      border: 1px solid #ddd;
      padding: 10px 11px;
      font-size: .84rem;
      outline: none;
    }

    .mav-chat-input:focus { border-color: #1a1a1a; }

    .mav-chat-send {
      width: 42px;
      border: 0;
      background: #1a1a1a;
      color: #fff;
      cursor: pointer;
    }

    .mav-chat-send:disabled { background: #aaa; cursor: not-allowed; }

    @media (max-width: 575px) {
      .mav-chat-root { right: 16px; bottom: 16px; }
      .mav-chat-panel { height: min(560px, calc(100vh - 96px)); }
    }
  `;
  document.head.appendChild(style);
}

function createWidget() {
  createStyles();

  const root = document.createElement("div");
  root.className = "mav-chat-root";
  root.innerHTML = `
    <section class="mav-chat-panel" aria-label="Maverik AI Support">
      <header class="mav-chat-header">
        <div>
          <div class="mav-chat-title">Maverik AI Support</div>
          <div class="mav-chat-subtitle">Product, checkout, VNPay help</div>
        </div>
        <button class="mav-chat-close" type="button" aria-label="Close chat">×</button>
      </header>
      <div class="mav-chat-messages"></div>
      <div class="mav-chat-quick">
        <button class="mav-chat-chip" type="button">Find sofas</button>
        <button class="mav-chat-chip" type="button">VNPay international cards</button>
        <button class="mav-chat-chip" type="button">How to checkout?</button>
      </div>
      <form class="mav-chat-form">
        <input class="mav-chat-input" type="text" maxlength="1200" placeholder="Ask Maverik AI..." autocomplete="off" />
        <button class="mav-chat-send" type="submit" aria-label="Send message">
          <i class="bi bi-send"></i>
        </button>
      </form>
    </section>
    <button class="mav-chat-toggle" type="button" aria-label="Open support chat">
      <i class="bi bi-chat-dots"></i>
    </button>
  `;

  document.body.appendChild(root);

  const panel = root.querySelector(".mav-chat-panel");
  const toggle = root.querySelector(".mav-chat-toggle");
  const close = root.querySelector(".mav-chat-close");
  const form = root.querySelector(".mav-chat-form");
  const input = root.querySelector(".mav-chat-input");
  const chips = root.querySelectorAll(".mav-chat-chip");

  toggle.addEventListener("click", () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    if (isOpen) input.focus();
  });

  close.addEventListener("click", () => {
    isOpen = false;
    panel.classList.remove("open");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || isSending) return;
    input.value = "";
    await sendMessage(message);
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", async () => {
      if (isSending) return;
      await sendMessage(chip.textContent.trim());
    });
  });

  renderMessages();
}

function renderMessages(extraProducts = []) {
  const messagesEl = document.querySelector(".mav-chat-messages");
  if (!messagesEl) return;

  const welcome =
    chatHistory.length === 0
      ? [
          {
            role: "assistant",
            content:
              "Hi! I can help you find furniture, check payment options, and guide checkout. VNPay supports international cards too.",
          },
        ]
      : [];

  messagesEl.innerHTML = [...welcome, ...chatHistory]
    .map((item) => `<div class="mav-chat-msg ${item.role}">${escapeHtml(item.content)}</div>`)
    .join("");

  if (extraProducts.length > 0) {
    const productsHtml = extraProducts
      .slice(0, 3)
      .map(
        (product) => `
          <a class="mav-chat-product" href="${escapeAttr(product.url)}">
            <strong>${escapeHtml(product.name)}</strong>
            <span>${Number(product.price).toLocaleString("vi-VN")}đ</span>
          </a>
        `,
      )
      .join("");

    messagesEl.insertAdjacentHTML("beforeend", `<div class="mav-chat-products">${productsHtml}</div>`);
  }

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage(message) {
  isSending = true;
  setSendingState(true);

  chatHistory.push({ role: "user", content: message });
  saveHistory();
  renderMessages();

  try {
    const response = await fetch(`${API_BASE}/support-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: chatHistory.slice(-6),
        context: getCurrentPageContext(),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || "Chatbot request failed");
    }

    chatHistory.push({ role: "assistant", content: payload.data.reply });
    saveHistory();
    renderMessages(payload.data.products || []);
  } catch (error) {
    chatHistory.push({
      role: "assistant",
      content: "Xin lỗi, chatbot đang tạm thời không phản hồi. Bạn thử lại sau nhé.",
    });
    saveHistory();
    renderMessages();
    console.error("[support-chat]", error);
  } finally {
    isSending = false;
    setSendingState(false);
  }
}

function setSendingState(value) {
  const button = document.querySelector(".mav-chat-send");
  const input = document.querySelector(".mav-chat-input");
  if (button) button.disabled = value;
  if (input) input.disabled = value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createWidget);
} else {
  createWidget();
}
