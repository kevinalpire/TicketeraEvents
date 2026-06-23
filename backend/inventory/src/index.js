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
  const sub = nc.subscribe('ticket.purchase_requested');
  
  console.log('✓ Listening to ticket.purchase_requested');

  for await (const msg of sub) {
    try {
      const purchaseData = JSON.parse(sc.decode(msg.data));
      console.log('📨 Purchase request received:', purchaseData);

      const { inventory_id, event_id, users, quantity } = purchaseData;

      // Get event details
      const eventResult = await pool.query(
        'SELECT id, capacity FROM events WHERE id = $1',
        [event_id]
      );

      if (eventResult.rows.length === 0) {
        // Event not found - publish sold_out
        await pool.query(
          'UPDATE inventory SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['cancelled', inventory_id]
        );

        nc.publish('ticket.sold_out', JSON.stringify({
          inventory_id,
          event_id,
          users,
          quantity,
          reason: 'Event not found',
          timestamp: new Date().toISOString()
        }));
        console.log('❌ Event not found');
        continue;
      }

      const event = eventResult.rows[0];

      // Count reserved + confirmed entries
      const reservedResult = await pool.query(
        `SELECT COALESCE(SUM(quantity), 0) as booked 
         FROM inventory 
         WHERE event_id = $1 AND status IN ('reserved', 'confirmed')`,
        [event_id]
      );

      const booked = parseInt(reservedResult.rows[0].booked);
      const available = event.capacity - booked;

      console.log(`Event ${event_id}: capacity=${event.capacity}, booked=${booked}, available=${available}, requested=${quantity}`);

      if (available >= quantity) {
        // RESERVE entries
        await pool.query(
          'UPDATE inventory SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['reserved', inventory_id]
        );

        // Publish success event
        nc.publish('ticket.reserved', JSON.stringify({
          inventory_id,
          event_id,
          users,
          quantity,
          timestamp: new Date().toISOString()
        }));
        
        console.log('✅ Entries RESERVED (ready for payment)');
      } else {
        // Not enough capacity - REJECT
        await pool.query(
          'UPDATE inventory SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['cancelled', inventory_id]
        );

        nc.publish('ticket.sold_out', JSON.stringify({
          inventory_id,
          event_id,
          users,
          quantity,
          available,
          requested: quantity,
          reason: 'Not enough capacity',
          timestamp: new Date().toISOString()
        }));
        
        console.log(`❌ SOLD OUT - only ${available} available`);
      }
    } catch (err) {
      console.error('Error processing message:', err);
    }
  }
}

async function start() {
  await connectNATS();
  console.log(`✓ Inventory service started`);
}

start().catch(err => {
  console.error('Failed to start service:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  if (nc) await nc.close();
  process.exit(0);
});