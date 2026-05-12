async function test() {
    try {
        const response = await fetch('http://localhost:5000/api/v1/products/featured/best-sellers');
        const data = await response.json();
        console.log('Best Sellers:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
