const pool = require("../config/db");
const { getNatsConnection } = require("./natsService");
const { StringCodec } = require("nats");

const sc = StringCodec();

// Escuchar las compras enviadas por Events
async function subscribeToPurchase() {

    const nc = getNatsConnection();

    const sub = nc.subscribe("ticket.purchase_requested");

    console.log("✓ Listening to ticket.purchase_requested");

    for await (const msg of sub) {

        const purchaseData = JSON.parse(
            sc.decode(msg.data)
        );

        console.log("📨 Purchase request received:", purchaseData);

        await processPurchase(purchaseData);

    }

}

async function processPurchase(purchaseData) {

    const nc = getNatsConnection();

    const {
        inventory_id,
        event_id,
        users,
        quantity
    } = purchaseData;

    try {

        // Buscar evento
        const eventResult = await pool.query(
            "SELECT id, capacity FROM events WHERE id = $1",
            [event_id]
        );

        // No existe el evento
        if (eventResult.rows.length === 0) {

            await pool.query(
                "UPDATE inventory SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
                ["cancelled", inventory_id]
            );

            nc.publish(
                "ticket.sold_out",
                JSON.stringify({
                    inventory_id,
                    event_id,
                    users,
                    quantity,
                    reason: "Event not found",
                    timestamp: new Date().toISOString()
                })
            );

            console.log("❌ Event not found");

            return;
        }

        const event = eventResult.rows[0];

        // Entradas reservadas
        const reservedResult = await pool.query(
            `SELECT COALESCE(SUM(quantity),0) AS booked
             FROM inventory
             WHERE event_id=$1
             AND status IN ('reserved','confirmed')`,
            [event_id]
        );

        const booked = parseInt(reservedResult.rows[0].booked);

        const available = event.capacity - booked;

        console.log(
            `Event ${event_id}: capacity=${event.capacity}, booked=${booked}, available=${available}, requested=${quantity}`
        );

        // Hay capacidad
        if (available >= quantity) {

            await pool.query(
                "UPDATE inventory SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
                ["reserved", inventory_id]
            );

            nc.publish(
                "ticket.reserved",
                JSON.stringify({
                    inventory_id,
                    event_id,
                    users,
                    quantity,
                    timestamp: new Date().toISOString()
                })
            );

            console.log("✅ Entries RESERVED");

        } else {

            await pool.query(
                "UPDATE inventory SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2",
                ["cancelled", inventory_id]
            );

            nc.publish(
                "ticket.sold_out",
                JSON.stringify({
                    inventory_id,
                    event_id,
                    users,
                    quantity,
                    available,
                    requested: quantity,
                    reason: "Not enough capacity",
                    timestamp: new Date().toISOString()
                })
            );

            console.log(`❌ SOLD OUT - only ${available} available`);

        }

    } catch (err) {

        console.error("Error processing purchase:", err);

    }

}

module.exports = {
    subscribeToPurchase,
    processPurchase
};