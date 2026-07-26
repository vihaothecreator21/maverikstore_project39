import { test, expect } from '@playwright/test';

test.describe('E2E Customer Checkout Flow', () => {
  test('Customer login, add product to cart and checkout with COD', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');

    // 2. Click "Đăng nhập" button in navbar (desktop version)
    await page.locator('button[data-bs-target="#loginModal"]').first().click();

    // 3. Fill login credentials (using seeded Customer 2: tuan.nguyen@gmail.com / Customer@1234)
    const loginModal = page.locator('#loginModal');
    // Ensure the modal is visible before interacting
    await expect(loginModal).toBeVisible();
    // Fill using precise IDs to bypass any label ambiguity
    await page.locator('#loginEmailModal').fill('customer@gmail.com');
    await page.locator('#loginPasswordModal').fill('Customer@1234');
    
    // Submit the login form and wait for reload
    await Promise.all([
      page.waitForNavigation(),
      page.locator('#loginFormModal button[type="submit"]').click()
    ]);
    
    // Verify login success - after successful reload, #userMenuBtn becomes visible
    // We expect the reload to happen, so wait for the DOM to settle and #userMenuBtn to appear
    await expect(page.locator('#userMenuBtn').first()).toBeVisible({ timeout: 15000 });

    // 5. Navigate to Products page
    await page.getByRole('link', { name: 'Sản phẩm' }).first().click();
    
    // Wait for products to load in the grid
    await expect(page.locator('.product-name').first()).toBeVisible();

    // 6. Click the first product
    await page.locator('.product-name').first().click();

    // 7. Add product to cart
    // The button typically has text "Thêm vào giỏ"
    const addToCartBtn = page.getByRole('button', { name: /Thêm vào giỏ/i });
    await expect(addToCartBtn).toBeVisible();
    // Wait for the success toast or cart update so the item is definitely added before navigation
    // The button might show a spinner, we wait for it to revert
    // Wait for the API call to complete
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('/api/v1/cart/items') && (response.status() === 200 || response.status() === 201)
    );
    await addToCartBtn.click();
    await responsePromise;

    // 8. Go to Cart
    await page.goto('/cart.html');

    // 9. Verify product is in cart  
    // .ci-name is the product name class in cart
    await expect(page.locator('.ci-name').first()).toBeVisible();

    // 10. Proceed to checkout
    await page.getByRole('button', { name: 'THANH TOÁN' }).click();

    // 11. Checkout Form
    // Wait for the form to be visible (it loads address using API)
    await expect(page.locator('#checkout-form')).toBeVisible();
    
    // Ensure we select COD
    await page.getByText('Thanh toán khi nhận hàng (COD)').click();

    // 12. Submit checkout
    await page.getByRole('button', { name: /ĐẶT HÀNG NGAY/i }).click();

    // 13. Verify success page
    // #co-success is the success overlay defined in checkout.html
    const successOverlay = page.locator('#co-success');
    await expect(successOverlay).toBeVisible({ timeout: 15000 });
    await expect(successOverlay.getByText('Đặt hàng thành công!')).toBeVisible();
  });
});
