const pool = require("../config/db");

// Obtener todos los pagos
exports.getPayments = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                p.*,
                i.users,
                i.quantity,
                e.name AS event_name
            FROM payments p
            JOIN inventory i
                ON p.inventory_id = i.id
            JOIN events e
                ON i.event_id = e.id
            ORDER BY p.created_at DESC
        `);

        res.json(result.rows);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Database error"
        });

    }

};

// Obtener pago por inventory_id
exports.getPaymentByInventory = async (req, res) => {

    const { inventory_id } = req.params;

    try {

        const result = await pool.query(

            "SELECT * FROM payments WHERE inventory_id=$1",

            [inventory_id]

        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                error: "Payment not found"
            });

        }

        res.json(result.rows[0]);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Database error"
        });

    }

};