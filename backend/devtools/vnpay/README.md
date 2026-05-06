# VNPay DevTools

This directory contains various debug, manual testing, and experimental scripts used during the VNPay integration phase. These scripts are not part of the production application but serve as utilities to verify hash calculations, URL generation, and signature encoding behaviors.

## Files
- `debug-vnpay.mjs`: Tests generating a VNPay payment URL using the `vnpay` npm library and compares the hash data against the manual implementation.
- `debug-vnpay-sort.mjs`: Tests the custom `sortObject` implementation to ensure object keys are correctly sorted and URL encoded according to VNPay specs.
- `debug-vnpay-encoding.mjs`: Compares PHP-like URL encoding against standard `qs.stringify` behavior with varying encode options to find the correct hash match.
- `vnpay_debug.mjs`: Extended debug script logging out detailed parameter lists and generated URLs for manual inspection.
- `vnpay_hash_compare.mjs`: Simulates receiving an IPN/Return request from VNPay and verifies if the recalculated hash matches the provided `vnp_SecureHash`.
- `test_vnpay.cjs`: Basic CommonJS test script to generate a VNPay payment URL for manual testing in the browser.
- `test-vnpay-url.cjs`: Another CommonJS script focusing on date formatting and basic payment URL generation.
