import { VNPay, HashAlgorithm, ignoreLogger } from "vnpay";

/**
 * VNPay singleton instance
 * Khởi tạo một lần — dùng lại cho toàn bộ app
 *
 * Credentials lấy từ env variables (không hardcode vào code)
 */
let _vnpay: VNPay | null = null;

export const getVNPay = (): VNPay => {
  if (_vnpay) return _vnpay;

  const tmnCode    = process.env.VNPAY_TMN_CODE    ?? "";
  const hashSecret = process.env.VNPAY_HASH_SECRET ?? "";

  if (!tmnCode || !hashSecret) {
    throw new Error(
      "VNPay config missing: VNPAY_TMN_CODE and VNPAY_HASH_SECRET are required"
    );
  }

  _vnpay = new VNPay({
    tmnCode,
    secureSecret: hashSecret,
    vnpayHost:    "https://sandbox.vnpayment.vn",
    testMode:     true,
    hashAlgorithm: HashAlgorithm.SHA512,
    enableLog:    false,
    loggerFn:     ignoreLogger,
  });

  return _vnpay;
};
