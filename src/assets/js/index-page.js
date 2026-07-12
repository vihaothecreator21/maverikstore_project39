import { API_CONFIG } from './api-config.js';
import { initializeSwiperCarousels } from './swiper.js';

/**
 * index-page.js
 *
 * Chức năng:
 * - Trang chủ kéo sản phẩm động từ backend rồi render vào các slider.
 * - GET /products?limit=5 cho New Arrivals.
 * - GET /products/featured/best-sellers?limit=8 cho Best Sellers.
 * - Sau khi thay HTML slider phải gọi initializeSwiperCarousels() để Swiper nhận DOM mới.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Initial static render or placeholder if needed
    await Promise.all([
        loadNewArrivals(),
        loadBestSellers()
    ]);
});

async function loadNewArrivals() {
    try {
        // Lấy 5 sản phẩm mới nhất
        const response = await fetch(`${API_CONFIG.BASE_URL}/products?limit=5`);
        const data = await response.json();

        if (data.status === 'success') {
            renderSlider(data.data);
            // Re-init swiper after DOM update
            initializeSwiperCarousels();
        }
    } catch (err) {
        console.error('Error loading new arrivals:', err);
    }
}

async function loadBestSellers() {
    try {
        // Lấy 8 sản phẩm bán chạy nhất
        const response = await fetch(`${API_CONFIG.BASE_URL}/products/featured/best-sellers?limit=8`);
        const data = await response.json();

        if (data.status === 'success') {
            renderBestSellers(data.data);
            // Re-init swiper after DOM update
            initializeSwiperCarousels();
        }
    } catch (err) {
        console.error('Error loading best sellers:', err);
    }
}

function renderSlider(products) {
    const swiperWrapper = document.querySelector('#swiper-6 .swiper-wrapper');
    if (!swiperWrapper || !products.length) return;

    swiperWrapper.innerHTML = products.map(product => `
        <div class="swiper-slide">
            <div class="container">
                <div class="row align-items-center min-vh-75 py-5">

                    <div class="col-lg-6 order-2 order-lg-1 text-center text-lg-start ps-lg-11 pe-lg-5">

                        <h5 class="text-uppercase tracking-widest text-secondary fw-bold mb-3 fst-italic" style="font-size: 0.9rem;">
                            New Arrival
                        </h5>

                        <h2 class="fw-bold mb-4 text-dark shadow-text" style="font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1.1; letter-spacing: -1px;">
                            ${product.name}
                        </h2>

                        <p class="text-muted mb-5 d-none d-md-block" style="max-width: 450px; line-height: 1.6; font-size: 1.05rem;">
                            ${product.description || 'Thiết kế tinh tế, chất liệu cao cấp mang lại vẻ đẹp vĩnh cửu cho không gian sống.'}
                        </p>

                        <div class="mb-5" style="font-size: 2rem;">
                            ${renderPriceHtml(product)}
                        </div>

                        <div class="d-flex gap-3 justify-content-center justify-content-lg-start align-items-center">
                            <a href="product-detail.html?slug=${product.slug}"
                               class="btn btn-primary btn-lg px-5 py-3 shadow-sm fw-bold"
                               style="white-space: nowrap; min-width: 200px;">
                                VIEW DETAILS
                            </a>
                        </div>
                    </div>

                    <div class="col-lg-6 order-1 order-lg-2">
                        <div class="product-img-wrapper text-center px-4">
                            <img src="${product.imageUrl || './assets/images/placeholder.jpg'}"
                                 alt="${product.name}"
                                 class="img-fluid"
                                 style="max-height: 500px; width: 100%; object-fit: contain;">
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `).join('');
}
function renderBestSellers(products) {
    const swiperWrapper = document.querySelector('#swiper-3 .swiper-wrapper');
    if (!swiperWrapper || !products.length) return;

    swiperWrapper.innerHTML = products.map(product => `
        <div class="swiper-slide">
            <div class="card border-0 product-card h-100">
                <div class="position-relative overflow-hidden">
                    <a href="product-detail.html?slug=${product.slug}">
                        <img src="${product.imageUrl || './assets/images/placeholder.jpg'}"
                             alt="${product.name}"
                             class="img-fluid w-100"
                             style="height: 350px; object-fit: cover;">
                    </a>
                    <div class="position-absolute top-0 start-0 m-3">
                        <span class="badge bg-danger">Best Seller</span>
                    </div>
                </div>
                <div class="card-body text-center px-0">
                    <h3 class="h5 mb-2">
                        <a href="product-detail.html?slug=${product.slug}" class="text-decoration-none text-dark">
                            ${product.name}
                        </a>
                    </h3>
                    <div class="d-flex justify-content-center gap-2">
                        ${renderPriceHtml(product)}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function getDiscountInfo(product) {
    const price = Number(product.price || 0);
    const discountPercent = Number(product.discountPercent || 0);
    const discountAmount = Number(product.discountAmount || 0);
    const discountValue = discountPercent > 0 ? price * discountPercent / 100 : discountAmount;
    const salePrice = Math.max(0, Math.round(price - discountValue));
    return { price, salePrice, hasDiscount: discountValue > 0 && salePrice < price };
}

function renderPriceHtml(product) {
    const discount = getDiscountInfo(product);
    if (!discount.hasDiscount) {
        return `<span class="fw-bold text-primary">${discount.price.toLocaleString()} đ</span>`;
    }

    return `
        <span class="d-inline-flex flex-column align-items-center align-items-lg-start">
            <span class="text-muted text-decoration-line-through" style="font-size:.55em;">${discount.price.toLocaleString()} đ</span>
            <span class="fw-bold text-danger">${discount.salePrice.toLocaleString()} đ</span>
        </span>
    `;
}
