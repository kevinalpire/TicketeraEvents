const pool = require("../config/db");

const {
    getNatsConnection,
    getStringCodec
} = require("./natsService");

async function subscribeToPayments() {

    const nc = getNatsConnection();
    const sc = getStringCodec();

    // Escuchar cuando Inventory reserva entradas
    const reservedSub = nc.subscribe("ticket.reserved");

    // Escuchar cuando Inventory informa que ya no hay cupos
    const soldOutSub = nc.subscribe("ticket.sold_out");

    console.log("✓ Listening to ticket.reserved and ticket.sold_out");

    // -------------------------------
    // Procesar pagos
    // -------------------------------
    (async () => {

        for await (const msg of reservedSub) {

            let currentInventoryId = null;

            try {

                const data = JSON.parse(sc.decode(msg.data));

                console.log("💳 Processing payment:", data);

                const {
                    inventory_id,
                    event_id,
                    users,
                    quantity
                } = data;

                currentInventoryId = inventory_id;

                // Buscar inventario y precio del evento
                const inventoryResult = await pool.query(
                    `SELECT i.*, e.price
                     FROM inventory i
                     JOIN events e ON i.event_id = e.id
                     WHERE i.id = $1`,
                    [inventory_id]
                );

                if (inventoryResult.rows.length === 0) {

                    console.log("Inventory not found");

                    continue;

                }

                const inventory = inventoryResult.rows[0];

                const amount = inventory.quantity * inventory.price;

                // Tasa de éxito configurable (por defecto 100% para demo estable).
                // Si quieres volver a simulación, usa PAYMENT_SUCCESS_RATE=0.9
                const successRate = Number(process.env.PAYMENT_SUCCESS_RATE || 1);
                const paymentSuccess = Math.random() < successRate;

                const transaction_id =
                    `TXN_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;

                if (paymentSuccess) {

                    // Confirmar pago + descontar cupo en una sola transaccion.
                    // Si falla cualquiera de los pasos, no se aplica ninguno.
                    await pool.query("BEGIN");

                    await pool.query(
                        `UPDATE inventory
                         SET status='confirmed',
                             updated_at=CURRENT_TIMESTAMP
                         WHERE id=$1`,
                        [inventory_id]
                    );

                    const capacityUpdate = await pool.query(
                        `UPDATE events
                         SET capacity = capacity - $1,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2
                           AND capacity >= $1
                         RETURNING id, capacity`,
                        [quantity, event_id]
                    );

                    if (capacityUpdate.rows.length === 0) {
                        throw new Error("Not enough remaining capacity to confirm payment");
                    }

                    await pool.query(
                        `INSERT INTO payments
                        (
                            inventory_id,
                            amount,
                            status,
                            payment_method,
                            transaction_id
                        )
                        VALUES($1,$2,$3,$4,$5)`,
                        [
                            inventory_id,
                            amount,
                            "confirmed",
                            "credit_card",
                            transaction_id
                        ]
                    );

                    await pool.query("COMMIT");

                    console.log("✅ Payment confirmed");

                    // Publicar evento
                    nc.publish(
                        "ticket.sold",
                        JSON.stringify({
                            inventory_id,
                            event_id,
                            users,
                            quantity,
                            amount,
                            payment_status: "confirmed",
                            transaction_id,
                            timestamp: new Date().toISOString()
                        })
                    );

                } else {

                    // Cancelar reserva
                    await pool.query(
                        `UPDATE inventory
                         SET status='cancelled',
                             updated_at=CURRENT_TIMESTAMP
                         WHERE id=$1`,
                        [inventory_id]
                    );

                    // Registrar intento fallido
                    await pool.query(
                        `INSERT INTO payments
                        (
                            inventory_id,
                            amount,
                            status,
                            payment_method
                        )
                        VALUES($1,$2,$3,$4)`,
                        [
                            inventory_id,
                            amount,
                            "failed",
                            "credit_card"
                        ]
                    );

                    console.log("❌ Payment failed");

                    nc.publish(
                        "ticket.payment_failed",
                        JSON.stringify({
                            inventory_id,
                            event_id,
                            users,
                            quantity,
                            amount,
                            payment_status: "failed",
                            reason: "Payment declined",
                            timestamp: new Date().toISOString()
                        })
                    );

                }

            } catch (err) {

                try {
                    await pool.query("ROLLBACK");
                } catch (rollbackError) {
                    console.error("Rollback Error:", rollbackError);
                }

                if (currentInventoryId) {
                    try {
                        await pool.query(
                            `UPDATE inventory
                             SET status='cancelled',
                                 updated_at=CURRENT_TIMESTAMP
                             WHERE id=$1
                               AND status='reserved'`,
                            [currentInventoryId]
                        );
                    } catch (cancelError) {
                        console.error("Cancel Reserved Error:", cancelError);
                    }
                }

                console.error("Payment Error:", err);

            }

        }

    })();

    // -------------------------------
    // Procesar evento sold_out
    // -------------------------------
    (async () => {

        for await (const msg of soldOutSub) {

            try {

                const data = JSON.parse(sc.decode(msg.data));

                console.log("❌ Event sold out:", data);

                await pool.query(
                    `UPDATE inventory
                     SET status='cancelled',
                         updated_at=CURRENT_TIMESTAMP
                     WHERE id=$1
                     AND status='pending'`,
                    [data.inventory_id]
                );

                nc.publish(
                    "notification.sold_out_sent",
                    JSON.stringify({
                        inventory_id: data.inventory_id,
                        users: data.users,
                        event_id: data.event_id,
                        reason: data.reason,
                        available: data.available,
                        timestamp: new Date().toISOString()
                    })
                );

            } catch (err) {

                console.error("Sold Out Error:", err);

            }

        }

    })();

}

module.exports = {
    subscribeToPayments
};