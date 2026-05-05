const crypto = require('crypto');
const qs = require('qs');

function getVNPayCreateDate(date) {
  const now  = date ?? new Date();
  const gmt7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y    = gmt7.getUTCFullYear();
  const mo   = String(gmt7.getUTCMonth() + 1).padStart(2, '0');
  const d    = String(gmt7.getUTCDate()).padStart(2, '0');
  const h    = String(gmt7.getUTCHours()).padStart(2, '0');
  const mi   = String(gmt7.getUTCMinutes()).padStart(2, '0');
  const s    = String(gmt7.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}${s}`;
}

function sortObject(obj) {
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    if (obj[key] !== '' && obj[key] !== undefined && obj[key] !== null) {
      sorted[key] = String(obj[key]);
    }
  }
  return sorted;
}

const vnpParams = {
  vnp_Version:    '2.1.0',
  vnp_Command:    'pay',
  vnp_TmnCode:    'MF33CGUI',
  vnp_Locale:     'vn',
  vnp_CurrCode:   'VND',
  vnp_TxnRef:     '123',
  vnp_OrderInfo:  'ThanhToanDonHang_123_MaverikStore',
  vnp_OrderType:  'other',
  vnp_Amount:     10000000,
  vnp_ReturnUrl:  'http://localhost:5000/api/v1/payments/vnpay/return',
  vnp_IpAddr:     '127.0.0.1',
  vnp_CreateDate: getVNPayCreateDate(),
};

const sorted = sortObject(vnpParams);
const signData = qs.stringify(sorted, { encode: false });
const signed = crypto.createHmac('sha512', 'LN6Q8B39MD9DC7368TP3CXM300VZVLIK').update(Buffer.from(signData, 'utf-8')).digest('hex');
console.log('signData:', signData);
console.log('signed:', signed);
const finalParams = { ...sorted, vnp_SecureHash: signed };
console.log('URL:\nhttps://sandbox.vnpayment.vn/paymentv2/vpcpay.html?' + qs.stringify(finalParams, { encode: true }));
