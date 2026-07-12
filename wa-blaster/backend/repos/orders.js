const db = require('../db');

async function create(prospectId, deviceId, productId, pakej, quantity, totalPrice, paymentMethod) {
  const [result] = await db.query(
    `INSERT INTO orders (prospect_id, device_id, product_id, pakej, quantity, total_price, payment_method)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [prospectId, deviceId, productId, pakej, quantity, totalPrice, paymentMethod]
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
