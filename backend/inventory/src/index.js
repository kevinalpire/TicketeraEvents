const express = require("express");
require("dotenv").config();

const app = express();

app.use(express.json());

// Rutas
const inventoryRoutes = require("./routes/inventoryRoutes");
app.use("/inventory", inventoryRoutes);

// Servicio NATS
const {
    connectNATS,
    getNatsConnection
} = require("./services/natsService");

// Servicio Inventory
const {
    subscribeToPurchase
} = require("./services/inventoryService");

// CORS
app.use((req, res, next) => {

    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();

});

const PORT = process.env.PORT || 3002;

async function start() {

    try {

        // Conectar con NATS
        await connectNATS();

        // Escuchar eventos de compra
        subscribeToPurchase();

        // Levantar servidor HTTP
        app.listen(PORT, () => {
            console.log(`✓ Inventory Service running on port ${PORT}`);
        });

    } catch (err) {

        console.error("Error starting Inventory Service:", err);
        process.exit(1);

    }

}

start();

// Cerrar conexión al terminar
process.on("SIGTERM", async () => {

    const nc = getNatsConnection();

    if (nc) {
        await nc.close();
    }

    process.exit(0);

});