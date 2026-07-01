
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