/**
 * products.js — Maverik Store
 * Fetch danh sách sản phẩm từ Backend API và render lên giao diện
 */

const getApiBase = () => {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return isDev
    ? "http://localhost:5000/api/v1"
    : `${window.location.origin}/api/v1`;
};
const API_BASE = getApiBase();

// ── State ─────────────────────────────────────────────────────
let currentPage = 1;
const LIMIT = 6;
let currentCategoryId = null;
let currentSearch = "";
let searchTimeout = null;

// ── Khởi động ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadCategories();
  loadProducts();
  setupSearch();
  setupSortSelect();
});

// ════════════════════════════════════════════════════════════
// 1. LOAD CATEGORIES (sidebar filter)
// ════════════════════════════════════════════════════════════
async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    const json = await res.json();
    if (!res.ok || json.status !== "success") return;

    const categories = json.data;
    const list = document.getElementById("category-filter-list");
    if (!list) return;

    // "Tất cả" option
    list.innerHTML = `
      <li>
        <a href="#" class="category-link text-dark fw-semibold active-cat" data-id="">
          Tất cả sản phẩm
        </a>
      </li>
    `;

    categories.forEach((cat) => {
      list.insertAdjacentHTML(
        "beforeend",
        `<li>
          <a href="#" class="category-link text-dark" data-id="${cat.id}">
            ${cat.name}
          </a>
        </li>`,
      );
    });

    // Gắn sự kiện click filter category
    list.querySelectorAll(".category-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        list
          .querySelectorAll(".category-link")
          .forEach((l) => l.classList.remove("active-cat", "fw-semibold"));
        link.classList.add("active-cat", "fw-semibold");
        currentCategoryId = link.dataset.id || null;
        currentPage = 1;
        loadProducts();
      });
    });
  } catch (err) {
    // Error loading categories - silent fail
  }
}

// ════════════════════════════════════════════════════════════
// 2. LOAD PRODUCTS
// ════════════════════════════════════════════════════════════
async function loadProducts() {
  showSkeleton();

  try {
    // Build URL query
    const params = new URLSearchParams({
      page: currentPage,
      limit: LIMIT,
    });
    if (currentCategoryId) params.append("categoryId", currentCategoryId);
    if (currentSearch) params.append("search", currentSearch);

    const res = await fetch(`${API_BASE}/products?${params}`);
    const json = await res.json();

    if (!res.ok || json.status !== "success") {
      showError("Không thể tải sản phẩm. Vui lòng thử lại.");
      return;
    }

    renderProducts(json.data);
    renderPagination(json.meta);
    updateProductCount(json.meta.total);
  } catch (err) {
    showError("Lỗi kết nối đến server. Vui lòng kiểm tra backend.");
  }
}

// ════════════════════════════════════════════════════════════
// 3. RENDER PRODUCTS
// ════════════════════════════════════════════════════════════
function renderProducts(products) {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-search fs-1 text-muted mb-3 d-block"></i>
        <h5 class="text-muted">Không tìm thấy sản phẩm nào</h5>
        <p class="text-muted small">Thử tìm kiếm với từ khóa khác hoặc chọn danh mục khác</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map((p) => buildProductCard(p)).join("");
}

function buildProductCard(product) {
  const image = product.imageUrl || getPlaceholderImage(product.name);
  const categoryName = product.category?.name || "Maverik";
  const priceFormatted = formatVND(product.price);
  const inStock = product.stockQuantity > 0;
  const slug = product.slug;

  return `
    <div class="col-sm-6 col-md-4 product-item" data-aos="fade-up">
      <div class="card product-card h-100 border-0 shadow-sm">
        <div class="position-relative overflow-hidden product-img-wrap">
          <a href="product-detail.html?slug=${slug}">
            <img
              src="${image}"
              class="card-img-top product-card-img"
              alt="${product.name}"
              onerror="this.src='./assets/images/product-img-1.jpg'"
            />
          </a>
          ${!inStock ? `<span class="badge bg-secondary position-absolute top-0 end-0 m-2">Hết hàng</span>` : ""}
        </div>
        <div class="card-body d-flex flex-column">
          <p class="text-muted mb-1 text-uppercase small">${categoryName}</p>
          <h3 class="h6 mb-2">
            <a href="product-detail.html?slug=${slug}" class="text-dark text-decoration-none product-name">
              ${product.name}
            </a>
          </h3>
          <p class="text-muted small mb-3 product-desc">
            ${truncate(product.description || "", 80)}
          </p>
          <div class="mt-auto d-flex align-items-center justify-content-between">
            <span class="fw-bold text-dark">${priceFormatted}</span>
            <button
              class="btn btn-dark btn-sm add-to-cart-btn"
              data-product-id="${product.id}"
              data-product-name="${product.name}"
              data-product-price="${product.price}"
              ${!inStock ? "disabled" : ""}
            >
              ${inStock ? '<i class="bi bi-cart-plus me-1"></i>Thêm giỏ' : "Hết hàng"}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// 4. RENDER PAGINATION
// ════════════════════════════════════════════════════════════
function renderPagination(meta) {
  const nav = document.getElementById("pagination-nav");
  if (!nav) return;

  const { page, pages } = meta;
  if (pages <= 1) {
    nav.innerHTML = "";
    return;
  }

  let html = `<ul class="pagination justify-content-center">`;

  // Prev
  html += `
    <li class="page-item ${page === 1 ? "disabled" : ""}">
      <a class="page-link" href="#" data-page="${page - 1}">«</a>
    </li>
  `;

  // Page numbers
  for (let i = 1; i <= pages; i++) {
    html += `
      <li class="page-item ${i === page ? "active" : ""}">
        <a class="page-link" href="#" data-page="${i}">${i}</a>
      </li>
    `;
  }

  // Next
  html += `
    <li class="page-item ${page === pages ? "disabled" : ""}">
      <a class="page-link" href="#" data-page="${page + 1}">»</a>
    </li>
  </ul>`;

  nav.innerHTML = html;

  // Gắn sự kiện
  nav.querySelectorAll(".page-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const p = parseInt(link.dataset.page);
      if (p >= 1 && p <= pages && p !== currentPage) {
        currentPage = p;
        loadProducts();
        window.scrollTo({ top: 400, behavior: "smooth" });
      }
    });
  });
}

// ════════════════════════════════════════════════════════════
// 5. SEARCH
// ════════════════════════════════════════════════════════════
function setupSearch() {
  const input = document.getElementById("product-search-input");
  if (!input) return;

  input.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = input.value.trim();
      currentPage = 1;
      loadProducts();
    }, 400); // debounce 400ms
  });
}

// ════════════════════════════════════════════════════════════
// 6. SORT
// ════════════════════════════════════════════════════════════
function setupSortSelect() {
  const select = document.getElementById("sort-select");
  if (!select) return;

  select.addEventListener("change", () => {
    // TODO: Thêm sort param vào API khi backend hỗ trợ
    loadProducts();
  });
}

// ════════════════════════════════════════════════════════════
// 7. SKELETON LOADING
// ════════════════════════════════════════════════════════════
function showSkeleton() {
  const grid = document.getElementById("product-grid");
  if (!grid) return;

  const skeletons = Array(6)
    .fill(0)
    .map(
      () => `
    <div class="col-sm-6 col-md-4">
      <div class="card border-0 shadow-sm">
        <div class="skeleton skeleton-img"></div>
        <div class="card-body">
          <div class="skeleton skeleton-text mb-2" style="width:40%"></div>
          <div class="skeleton skeleton-text mb-2" style="width:80%"></div>
          <div class="skeleton skeleton-text" style="width:30%"></div>
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  grid.innerHTML = skeletons;
}

function showError(msg) {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  grid.innerHTML = `
    <div class="col-12 text-center py-5">
      <i class="bi bi-exclamation-triangle fs-1 text-warning mb-3 d-block"></i>
      <h5 class="text-muted">${msg}</h5>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// 8. HELPERS
// ════════════════════════════════════════════════════════════
function updateProductCount(total) {
  const el = document.getElementById("product-total-count");
  if (el) el.textContent = `${total} sản phẩm`;
}

function formatVND(price) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}

function getPlaceholderImage(name) {
  const index = (name.charCodeAt(0) % 7) + 1;
  return `./assets/images/product-img-${index}.jpg`;
}

// ════════════════════════════════════════════════════════════
// 9. ADD TO CART (placeholder — sẽ hoàn thiện ở bước Cart)
// ════════════════════════════════════════════════════════════
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".add-to-cart-btn");
  if (!btn) return;

  const token = localStorage.getItem("authToken");
  if (!token) {
    // Chưa đăng nhập → mở modal login
    const loginModal = document.getElementById("loginModal");
    if (loginModal) {
      new bootstrap.Modal(loginModal).show();
    } else {
      alert("Vui lòng đăng nhập để thêm vào giỏ hàng!");
    }
    return;
  }

  // TODO: Gọi API Cart khi đã làm module Cart
  const name = btn.dataset.productName;
  showToast(`✅ Đã thêm "${name}" vào giỏ hàng!`);
});

function showToast(message) {
  let toast = document.getElementById("cart-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "cart-toast";
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: #212529; color: white; padding: 12px 20px;
      border-radius: 8px; font-size: 14px; font-weight: 500;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
  }, 3000);
}
