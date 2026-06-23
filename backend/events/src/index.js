const express = require('express');
const { connect } = require('nats');
require('dotenv').config();
const pool = require('./db');

const app = express();
app.use(express.json());

let nc; // NATS connection

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Connect to NATS
async function connectNATS() {
  try {
    nc = await connect({ servers: process.env.NATS_URL });
    console.log(`✓ ${process.env.SERVICE_NAME} connected to NATS`);
  } catch (err) {
    console.error('NATS connection error:', err);
    process.exit(1);
  }
}

// ==================== CRUD EVENTOS ====================

// CREATE EVENT
app.post('/events', async (req, res) => {
  const { name, description, date, capacity, price } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO events (name, description, date, capacity, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description, date, capacity, price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// READ ALL EVENTS
app.get('/events', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// READ EVENT BY ID
app.get('/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// UPDATE EVENT
app.put('/events/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, date, capacity, price } = req.body;
  try {
    const result = await pool.query(
      'UPDATE events SET name = $1, description = $2, date = $3, capacity = $4, price = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [name, description, date, capacity, price, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE EVENT
app.delete('/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ message: 'Event deleted', event: result.rows[0] });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ==================== COMPRA DE ENTRADAS ====================

// BUY TICKET - publishes event to NATS
app.post('/inventory/purchase', async (req, res) => {
  const { event_id, users, quantity } = req.body;
  
  try {
    // Verify event exists
    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [event_id]);
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // VALIDATE CAPACITY BEFORE CREATING RECORD
    const bookedResult = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) as booked 
       FROM inventory 
       WHERE event_id = $1 AND status IN ('reserved', 'confirmed')`,
      [event_id]
    );

    const booked = parseInt(bookedResult.rows[0].booked);
    const available = event.capacity - booked;

    // If not enough capacity, reject immediately
    if (available < quantity) {
      return res.status(400).json({ 
        error: 'Not enough capacity',
        message: `Only ${available} tickets available, requested ${quantity}`,
        capacity: event.capacity,
        booked: booked,
        available: available
      });
    }

    // Create pending inventory record
    const inventoryResult = await pool.query(
      'INSERT INTO inventory (event_id, users, quantity, status) VALUES ($1, $2, $3, $4) RETURNING id',
      [event_id, users, quantity, 'pending']
    );

    const inventory_id = inventoryResult.rows[0].id;

    // Publish purchase request to inventory service via NATS
    const purchaseData = {
      inventory_id,
      event_id,
      users,
      quantity,
      timestamp: new Date().toISOString()
    };

    nc.publish('ticket.purchase_requested', JSON.stringify(purchaseData));
    
    res.status(202).json({ 
      message: 'Purchase request submitted',
      inventory_id,
      status: 'pending'
    });
  } catch (err) {
    console.error('Error processing purchase:', err);
    res.status(500).json({ error: 'Error processing purchase' });
  }
});

// GET INVENTORY STATUS
app.get('/inventory/:inventory_id', async (req, res) => {
  const { inventory_id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM inventory WHERE id = $1', [inventory_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching inventory:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET ALL INVENTORY
app.get('/inventory', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT i.*, e.name as event_name, e.capacity, e.price FROM inventory i JOIN events e ON i.event_id = e.id ORDER BY i.created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching inventory:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET PAYMENT FOR SPECIFIC INVENTORY
app.get('/inventory/:inventory_id/payment', async (req, res) => {
  const { inventory_id } = req.params;
  try {
    const result = await pool.query(
      'SELECT p.* FROM payments p WHERE p.inventory_id = $1',
      [inventory_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching payment:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET ALL PAYMENTS
app.get('/payments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT p.*, i.users, i.quantity, e.name as event_name FROM payments p JOIN inventory i ON p.inventory_id = i.id JOIN events e ON i.event_id = e.id ORDER BY p.created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3001;

async function start() {
  await connectNATS();
  
  app.listen(PORT, () => {
    console.log(`✓ Events service running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start service:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  if (nc) await nc.close();
  process.exit(0);
});