/**
 * product-detail.js — Maverik Store
 * Fetch product by slug từ URL và render lên product-detail.html
 */

const API_BASE = "http://localhost:5000/api/v1";
import * as bootstrap from 'bootstrap';

// ── Lấy slug từ URL (?slug=...) ──────────────────────────
const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

// ── Khởi động ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  if (!slug) {
    showError("Không tìm thấy sản phẩm. Vui lòng quay lại trang sản phẩm.");
    return;
  }
  await loadProduct();
});

// ════════════════════════════════════════════════════════════
// 1. LOAD PRODUCT
// ════════════════════════════════════════════════════════════
async function loadProduct() {
  try {
    const res = await fetch(`${API_BASE}/products/slug/${slug}`);
    const json = await res.json();

    if (!res.ok || json.status !== "success") {
      showError("Không tìm thấy sản phẩm này.");
      return;
    }

    renderProduct(json.data);
    loadRelatedProducts(json.data.category?.id, json.data.id);
  } catch (err) {
    showError("Lỗi kết nối đến server. Vui lòng kiểm tra backend.");
    console.error(err);
  }
}

// ════════════════════════════════════════════════════════════
// 2. RENDER PRODUCT
// ════════════════════════════════════════════════════════════
function renderProduct(product) {
  // Update page title
  document.title = `${product.name} - Maverik Store`;

  // Breadcrumb
  document.getElementById("breadcrumb-name").textContent = product.name;

  // Category name
  const catEl = document.getElementById("detail-category-name");
  if (catEl) catEl.textContent = product.category?.name || "Maverik";

  // Title
  document.getElementById("detail-name").textContent = product.name;

  // Stock status
  const stockEl = document.getElementById("detail-stock");
  const inStock = product.stockQuantity > 0;
  stockEl.innerHTML = inStock
    ? `<span class="stock-badge bg-success text-white">Còn hàng (${product.stockQuantity})</span>`
    : `<span class="stock-badge bg-secondary text-white">Hết hàng</span>`;

  // Price
  document.getElementById("detail-price").textContent = formatVND(product.price);

  // Description (short preview in right col)
  const shortDesc = document.getElementById("detail-desc-short");
  const fullDesc = document.getElementById("detail-desc-full");
  const descText = product.description || "";
  shortDesc.textContent = truncate(descText, 160);
  fullDesc.textContent = descText;

  // Buttons state
  const btnCart = document.getElementById("btn-add-cart");
  const btnBuy = document.getElementById("btn-buy-now");
  const btnNotify = document.getElementById("btn-notify");
  if (!inStock) {
    btnCart.disabled = true;
    btnBuy.disabled = true;
    btnCart.textContent = "Hết hàng";
    btnBuy.textContent = "Hết hàng";
    btnNotify.classList.remove("d-none");
  } else {
    btnNotify.classList.add("d-none");
    btnCart.addEventListener("click", () => handleAddToCart(product));
    btnBuy.addEventListener("click", () => handleBuyNow(product));
  }

  // Images — build gallery
  buildGallery(product);

  // Show content, hide skeleton
  document.getElementById("detail-skeleton").classList.add("d-none");
  document.getElementById("detail-content").classList.remove("d-none");
}

// ════════════════════════════════════════════════════════════
// 3. IMAGE GALLERY
// ════════════════════════════════════════════════════════════
function buildGallery(product) {
  const mainImg = document.getElementById("main-product-img");
  const thumbList = document.getElementById("thumbnail-list");

  // Collect all images: primary imageUrl + productImages array
  const allImages = [];

  if (product.imageUrl) allImages.push(product.imageUrl);

  if (product.images && product.images.length > 0) {
    product.images.forEach((img) => {
      if (!allImages.includes(img.url)) allImages.push(img.url);
    });
  }

  // Fallback nếu không có ảnh
  if (allImages.length === 0) {
    allImages.push("./assets/images/product-img-1.jpg");
  }

  // Set ảnh chính
  mainImg.src = allImages[0];
  mainImg.alt = product.name;

  // Build thumbnails
  thumbList.innerHTML = "";
  allImages.forEach((imgUrl, idx) => {
    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = `${product.name} - ${idx + 1}`;
    img.className = `thumbnail-item ${idx === 0 ? "active" : ""}`;
    img.onerror = function () {
      this.src = "./assets/images/product-img-1.jpg";
    };
    img.addEventListener("click", () => {
      mainImg.src = imgUrl;
      thumbList.querySelectorAll(".thumbnail-item").forEach((t) => t.classList.remove("active"));
      img.classList.add("active");
    });
    thumbList.appendChild(img);
  });
}

// ════════════════════════════════════════════════════════════
// 4. RELATED PRODUCTS
// ════════════════════════════════════════════════════════════
async function loadRelatedProducts(categoryId, excludeId) {
  const grid = document.getElementById("related-products-grid");

  try {
    const url = categoryId
      ? `${API_BASE}/products?categoryId=${categoryId}&limit=5`
      : `${API_BASE}/products?limit=5`;

    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.status !== "success") return;

    // Lọc bỏ sản phẩm đang xem + lọc bỏ null
    const related = json.data
      .filter((p) => p && p.id && p.id !== excludeId && p.price > 0)
      .slice(0, 4);

    if (related.length === 0) {
      grid.parentElement.classList.add("d-none");
      return;
    }

    grid.innerHTML = related.map((p) => buildRelatedCard(p)).join("");
  } catch (err) {
    console.warn("Không tải được sản phẩm liên quan:", err);
  }
}

function buildRelatedCard(product) {
  const image = product.imageUrl || "./assets/images/product-img-1.jpg";
  const inStock = product.stockQuantity > 0;
  return `
    <div class="col-6 col-md-3">
      <div class="related-card">
        <a href="product-detail.html?slug=${product.slug}" class="text-decoration-none text-dark">
          <div style="overflow:hidden;background:#f5f5f5;">
            <img src="${image}" alt="${product.name}"
              style="width:100%;height:260px;object-fit:cover;transition:transform .3s;"
              onerror="this.src='./assets/images/product-img-1.jpg'"
              onmouseover="this.style.transform='scale(1.05)'"
              onmouseout="this.style.transform='scale(1)'"
            />
          </div>
          <p class="card-name mt-2">${product.name}</p>
          <p class="card-price">${formatVND(product.price)}</p>
          ${!inStock ? `<p class="card-status">Hết hàng</p>` : ""}
        </a>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// 5. QUANTITY CONTROL
// ════════════════════════════════════════════════════════════
window.changeQty = function (delta) {
  const input = document.getElementById("qty-input");
  let val = parseInt(input.value) + delta;
  if (val < 1) val = 1;
  if (val > 99) val = 99;
  input.value = val;
};

// ════════════════════════════════════════════════════════════
// 6. SELECTORS & ADD TO CART / BUY NOW
// ════════════════════════════════════════════════════════════
let selectedSize = "Small";
let selectedColor = "Default";

document.getElementById("size-selector")?.addEventListener("click", (e) => {
  if (e.target.classList.contains("size-btn")) {
    document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    selectedSize = e.target.dataset.size;
  }
});

document.getElementById("color-selector")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".color-btn");
  if (btn) {
    document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedColor = btn.dataset.color;
  }
});

async function handleAddToCart(product) {
  const qty = parseInt(document.getElementById("qty-input").value);
  const addBtn = document.getElementById("btn-add-cart");
  const originalText = addBtn.innerHTML;
  
  try {
    addBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Đang thêm...`;
    addBtn.disabled = true;

    // Lấy giỏ hàng từ localStorage
    let cart = JSON.parse(localStorage.getItem("maverik_cart") || "[]");

    // Lấy link ảnh
    const imgUrl = product.images && product.images.length > 0 
      ? product.images[0].url 
      : product.imageUrl || "./assets/images/product-img-1.jpg";

    // Tìm xem sản phẩm đã có trong giỏ chưa (cùng ID, Size, Color)
    const existingIndex = cart.findIndex(
      item => item.productId === product.id && 
              item.size === selectedSize && 
              item.color === selectedColor
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += qty;
    } else {
      cart.push({
        id: Date.now(), // Unique ID cho item trong giỏ
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: imgUrl,
        size: selectedSize,
        color: selectedColor,
        quantity: qty
      });
    }

    // Save lại vào localStorage
    localStorage.setItem("maverik_cart", JSON.stringify(cart));

    // Bắn event để update Navbar & Offcanvas
    window.dispatchEvent(new Event("cartUpdated"));
    
    // Automatically open the bootstrap offcanvas just like Maverik does!
    const offcanvasEl = document.getElementById('cartOffcanvas');
    if (offcanvasEl) {
      const oc = bootstrap.Offcanvas.getInstance(offcanvasEl) || new bootstrap.Offcanvas(offcanvasEl);
      oc.show();
    }

    // Delay giả lập API cho mượt UI
    await new Promise(resolve => setTimeout(resolve, 300));

  } catch (err) {
    showToast(`❌ Lỗi: ${err.message}`);
  } finally {
    addBtn.innerHTML = originalText;
    addBtn.disabled = false;
  }
}

function handleBuyNow(product) {
  const addBtn = document.getElementById("btn-buy-now");
  const originalText = addBtn.innerHTML;
  addBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Chờ...`;
  addBtn.disabled = true;

  handleAddToCart(product).then(() => {
    window.location.href = "cart.html";
  }).finally(() => {
     addBtn.innerHTML = originalText;
     addBtn.disabled = false;
  });
}


// ════════════════════════════════════════════════════════════
// 7. ERROR STATE
// ════════════════════════════════════════════════════════════
function showError(msg) {
  document.getElementById("detail-skeleton").classList.add("d-none");
  const main = document.querySelector("main .container");
  main.innerHTML = `
    <div class="text-center py-5 my-5">
      <i class="bi bi-exclamation-triangle fs-1 text-warning d-block mb-3"></i>
      <h4>${msg}</h4>
      <a href="products.html" class="btn btn-dark mt-3">← Quay lại danh sách sản phẩm</a>
    </div>
  `;
}

// ════════════════════════════════════════════════════════════
// 8. HELPERS
// ════════════════════════════════════════════════════════════
function formatVND(price) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
}

function truncate(str, max) {
  return str && str.length > max ? str.slice(0, max) + "..." : str || "";
}

function showToast(message) {
  let toast = document.getElementById("detail-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "detail-toast";
    toast.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:9999;
      background:#212529;color:white;padding:12px 20px;
      border-radius:4px;font-size:14px;font-weight:500;
      box-shadow:0 4px 20px rgba(0,0,0,.3);transition:all .3s ease;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
  }, 3000);
}
