import { getApiBase } from "./api-config.js";
import { showToast } from "./ui-feedback.js";

const API_BASE = getApiBase();

const reviewForm = document.getElementById("store-review-form");
const productSelect = document.getElementById("review-product");
const ratingSelect = document.getElementById("review-rating");
const commentInput = document.getElementById("review-comment");
const reviewList = document.getElementById("latest-review-list");
const emptyState = document.getElementById("latest-review-empty");

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  loadLatestReviews();
  setupReviewForm();
});

async function loadProducts() {
  if (!productSelect) return;

  try {
    const response = await fetch(`${API_BASE}/products?limit=100`);
    const json = await response.json();
    if (!response.ok || json.status !== "success") return;

    productSelect.innerHTML = `<option value="">Chọn sản phẩm để đánh giá</option>`;
    json.data.forEach((product) => {
      productSelect.insertAdjacentHTML(
        "beforeend",
        `<option value="${product.id}">${escapeHtml(product.name)}</option>`,
      );
    });
  } catch (error) {
    showToast("Không tải được danh sách sản phẩm", "error");
  }
}

async function loadLatestReviews() {
  if (!reviewList) return;

  reviewList.innerHTML = `<div class="col-12 text-center text-muted py-4">Đang tải đánh giá...</div>`;
  if (emptyState) emptyState.classList.add("d-none");

  try {
    const response = await fetch(`${API_BASE}/reviews/latest`);
    const json = await response.json();
    if (!response.ok || json.status !== "success") throw new Error(json.message);

    renderReviews(json.data || []);
  } catch (error) {
    reviewList.innerHTML = `<div class="col-12 text-center text-muted py-4">Chưa tải được đánh giá mới nhất.</div>`;
  }
}

function renderReviews(reviews) {
  reviewList.innerHTML = "";

  if (!reviews.length) {
    if (emptyState) emptyState.classList.remove("d-none");
    return;
  }

  if (emptyState) emptyState.classList.add("d-none");
  reviews.forEach((review) => {
    reviewList.insertAdjacentHTML(
      "beforeend",
      `<div class="col-lg-4 col-md-6 col-12">
        <div class="card h-100">
          <div class="card-body p-4">
            <div class="text-warning mb-2">${renderStars(review.rating)}</div>
            <p class="fst-italic mb-3">"${escapeHtml(review.comment || "")}"</p>
            <h4 class="fs-6 mb-1">${escapeHtml(review.user?.username || "Khách hàng")}</h4>
            <small class="text-muted">${escapeHtml(review.product?.name || "Sản phẩm Maverik")}</small>
          </div>
        </div>
      </div>`,
    );
  });
}

function setupReviewForm() {
  if (!reviewForm) return;

  reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = localStorage.getItem("authToken");
    if (!token) {
      showToast("Vui lòng đăng nhập để gửi đánh giá", "warning");
      return;
    }

    const productId = Number(productSelect.value);
    const rating = Number(ratingSelect.value);
    const comment = commentInput.value.trim();

    if (!productId || !rating || comment.length < 3) {
      showToast("Vui lòng chọn sản phẩm, số sao và viết đánh giá", "warning");
      return;
    }

    const submitButton = reviewForm.querySelector("button[type='submit']");
    submitButton.disabled = true;

    try {
      const response = await fetch(`${API_BASE}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ productId, rating, comment }),
      });
      const json = await response.json();

      if (!response.ok || json.status !== "success") {
        throw new Error(json.message || "Không lưu được đánh giá");
      }

      reviewForm.reset();
      showToast("Đã lưu đánh giá của bạn", "success");
      loadLatestReviews();
    } catch (error) {
      showToast(error.message || "Không lưu được đánh giá", "error");
    } finally {
      submitButton.disabled = false;
    }
  });
}

function renderStars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
