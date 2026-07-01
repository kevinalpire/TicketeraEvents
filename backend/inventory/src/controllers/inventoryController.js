const pool = require("../config/db");
const { getNatsConnection } = require("../services/natsService");

// Obtener todo el inventario
exports.getInventory = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT i.*,
                   e.name AS event_name,
                   e.capacity,
                   e.price
            FROM inventory i
            JOIN events e ON i.event_id = e.id
            ORDER BY i.created_at DESC
        `);

        res.json(result.rows);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
};

// Obtener un registro del inventario
exports.getInventoryById = async (req, res) => {

    const { inventory_id } = req.params;

    try {

        const result = await pool.query(
            "SELECT * FROM inventory WHERE id = $1",
            [inventory_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "Inventory not found"
            });
        }

        res.json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }

};

// Comprar ticket
exports.purchaseTicket = async (req, res) => {

    const { event_id, users, quantity } = req.body;

    try {

        // Buscar evento
        const eventResult = await pool.query(
            "SELECT * FROM events WHERE id = $1",
            [event_id]
        );

        if (eventResult.rows.length === 0) {
            return res.status(404).json({
                error: "Event not found"
            });
        }

        const event = eventResult.rows[0];

        // capacity ahora representa cupo restante real.
        // Solo se descuenta lo reservado en curso para evitar sobreventa.
        const bookedResult = await pool.query(
            `SELECT COALESCE(SUM(quantity),0) AS booked
             FROM inventory
             WHERE event_id=$1
             AND status = 'reserved'`,
            [event_id]
        );

        const booked = parseInt(bookedResult.rows[0].booked);
        const available = event.capacity - booked;

        if (available < quantity) {

            return res.status(400).json({
                error: "Not enough capacity",
                available
            });

        }

        // Crear registro pendiente
        const inventoryResult = await pool.query(
            `INSERT INTO inventory(event_id,users,quantity,status)
             VALUES($1,$2,$3,$4)
             RETURNING id`,
            [event_id, users, quantity, "pending"]
        );

        const inventory_id = inventoryResult.rows[0].id;

        const purchaseData = {
            inventory_id,
            event_id,
            users,
            quantity,
            timestamp: new Date().toISOString()
        };

        const nc = getNatsConnection();

        nc.publish(
            "ticket.purchase_requested",
            JSON.stringify(purchaseData)
        );

        res.status(202).json({
            message: "Purchase request submitted",
            inventory_id,
            status: "pending"
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Error processing purchase"
        });

    }

};