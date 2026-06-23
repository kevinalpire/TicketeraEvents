const { connect, StringCodec } = require('nats');
require('dotenv').config();
const pool = require('./db');

const sc = StringCodec();
let nc;

async function connectNATS() {
  try {
    nc = await connect({ servers: process.env.NATS_URL });
    console.log(`✓ ${process.env.SERVICE_NAME} connected to NATS`);
    subscribeToEvents();
  } catch (err) {
    console.error('NATS connection error:', err);
    process.exit(1);
  }
}

async function subscribeToEvents() {
  // Listen to reserved entries (ready for payment)
  const sub1 = nc.subscribe('ticket.reserved');
  // Listen to sold out events (notify customer)
  const sub2 = nc.subscribe('ticket.sold_out');

  console.log('✓ Listening to ticket.reserved and ticket.sold_out');

  // Process reserved entries
  (async () => {
    for await (const msg of sub1) {
      try {
        const data = JSON.parse(sc.decode(msg.data));
        console.log('💳 Processing payment for reserved entry:', data);

        const { inventory_id, event_id, users, quantity } = data;

        // Get inventory details to calculate amount
        const inventoryResult = await pool.query(
          'SELECT i.*, e.price FROM inventory i JOIN events e ON i.event_id = e.id WHERE i.id = $1',
          [inventory_id]
        );

        if (inventoryResult.rows.length === 0) {
          console.error('❌ Inventory record not found');
          return;
        }

        const inventory = inventoryResult.rows[0];
        const amount = inventory.quantity * inventory.price;

        // Simulate payment processing (90% success rate)
        const paymentSuccess = Math.random() > 0.1;
        const transaction_id = `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (paymentSuccess) {
          // PAYMENT CONFIRMED
          await pool.query(
            'UPDATE inventory SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['confirmed', inventory_id]
          );

          // Insert payment record
          await pool.query(
            `INSERT INTO payments (inventory_id, amount, status, payment_method, transaction_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [inventory_id, amount, 'confirmed', 'credit_card', transaction_id]
          );

          console.log(`✅ PAYMENT CONFIRMED - Amount: $${amount}, Transaction: ${transaction_id}`);
          
          nc.publish('ticket.sold', JSON.stringify({
            inventory_id,
            event_id,
            users,
            quantity,
            amount,
            payment_status: 'confirmed',
            transaction_id,
            timestamp: new Date().toISOString()
          }));
        } else {
          // PAYMENT FAILED
          await pool.query(
            'UPDATE inventory SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['cancelled', inventory_id]
          );

          // Insert payment record (failed)
          await pool.query(
            `INSERT INTO payments (inventory_id, amount, status, payment_method)
             VALUES ($1, $2, $3, $4)`,
            [inventory_id, amount, 'failed', 'credit_card']
          );

          console.log(`❌ PAYMENT FAILED - Entry released`);
          
          nc.publish('ticket.payment_failed', JSON.stringify({
            inventory_id,
            event_id,
            users,
            quantity,
            amount,
            payment_status: 'failed',
            reason: 'Payment declined',
            timestamp: new Date().toISOString()
          }));
        }
      } catch (err) {
        console.error('Error processing payment:', err);
      }
    }
  })();

  // Notify customer of sold out
  (async () => {
    for await (const msg of sub2) {
      try {
        const data = JSON.parse(sc.decode(msg.data));
        console.log('❌ CUSTOMER NOTIFICATION - Event sold out:', data);
        
        // Update inventory to cancelled if it was only pending
        await pool.query(
          'UPDATE inventory SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = $3',
          ['cancelled', data.inventory_id, 'pending']
        );

        nc.publish('notification.sold_out_sent', JSON.stringify({
          inventory_id: data.inventory_id,
          users: data.users,
          event_id: data.event_id,
          reason: data.reason,
          available: data.available,
          timestamp: new Date().toISOString()
        }));
      } catch (err) {
        console.error('Error processing sold out notification:', err);
      }
    }
  })();
}

async function start() {
  await connectNATS();
  console.log(`✓ Payments service started`);
}

start().catch(err => {
  console.error('Failed to start service:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  if (nc) await nc.close();
  process.exit(0);
});