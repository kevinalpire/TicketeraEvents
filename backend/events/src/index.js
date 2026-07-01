
const express = require('express');
require('dotenv').config();

const app = express();

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
});

const eventRoutes = require("./routes/eventRoutes");
  // RUTAS DE EVENTOS
app.use("/events", eventRoutes);

const {
    connectNATS,
    getNatsConnection
} = require("./services/natsService");

const pool = require('./config/db');


// GET PAYMENT FOR SPECIFIC INVENTORY
app.get('/inventory/:inventory_id/payment', async (req, res) => {

    const { inventory_id } = req.params;

    try {

        const result = await pool.query(
            'SELECT * FROM payments WHERE inventory_id = $1',
            [inventory_id]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                error: 'Payment not found'
            });

        }

        res.json(result.rows[0]);

    } catch (err) {

        console.error('Error fetching payment:', err);

        res.status(500).json({
            error: 'Database error'
        });

    }

});

// GET ALL PAYMENTS
app.get('/payments', async (req, res) => {

    try {

        const result = await pool.query(
            `SELECT p.*,
                    i.users,
                    i.quantity,
                    e.name as event_name
             FROM payments p
             JOIN inventory i ON p.inventory_id = i.id
             JOIN events e ON i.event_id = e.id
             ORDER BY p.created_at DESC`
        );

        res.json(result.rows);

    } catch (err) {

        console.error('Error fetching payments:', err);

        res.status(500).json({
            error: 'Database error'
        });

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

    const nc = getNatsConnection();

    if (nc) {
        await nc.close();
    }

    process.exit(0);

});