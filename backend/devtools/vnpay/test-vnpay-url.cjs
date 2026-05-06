const crypto = require("crypto");
const qs = require("qs");

function sortObject(obj) {
  const sorted = {};
  const str = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (let key = 0; key < str.length; key++) {
    const originalKey = decodeURIComponent(str[key]);
    sorted[str[key]] = encodeURIComponent(String(obj[originalKey])).replace(/%20/g, "+");
  }
  return sorted;
}

const vnpParams = {
  vnp_Version: "2.1.0",
  vnp_Command: "pay",
  vnp_TmnCode: "MF33CGUI",
  vnp_Locale: "vn",
  vnp_CurrCode: "VND",
  vnp_TxnRef: "123",
  vnp_OrderInfo: "ThanhToanDonHang_123_MaverikStore",
  vnp_OrderType: "other",
  vnp_Amount: 15000000,
  vnp_ReturnUrl: "http://localhost:5000/api/v1/payments/vnpay/return",
  vnp_IpAddr: "127.0.0.1",
  vnp_CreateDate: "20260423172400",
};

const sorted = sortObject(vnpParams);
const signData = qs.stringify(sorted, { encode: false });

const signed = crypto
  .createHmac("sha512", "LN6Q8B39MD9DC7368TP3CXM300VZVLIK")
  .update(Buffer.from(signData, "utf-8"))
  .digest("hex");

const finalParams = { ...sorted, vnp_SecureHash: signed };
const url = `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${qs.stringify(finalParams, { encode: false })}`;

console.log("signData:", signData);
console.log("url:", url);
