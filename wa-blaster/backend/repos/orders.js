const db = require('../db');

const PAKEJ_QTY = { '1_botol': 1, '2_botol': 2, '3_botol': 3 };

async function create(prospectId, deviceId, productId, pakej, totalPrice, paymentMethod) {
  const [result] = await db.query(
    `INSERT INTO orders (prospect_id, device_id, product_id, pakej, quantity, total_price, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [prospectId, deviceId, productId, pakej, PAKEJ_QTY[pakej] || 1, totalPrice, paymentMethod]
  );
  return result.insertId;
}

async function updateDelivery(orderId, deliveryName, deliveryAddress) {
  await db.query(
    'UPDATE orders SET delivery_name = ?, delivery_address = ?, status = ? WHERE id = ?',
    [deliveryName, deliveryAddress, 'confirmed', orderId]
  );
}

async function getById(orderId) {
  const [rows] = await db.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
  return rows[0] || null;
}

module.exports = { create, updateDelivery, getById };
