const { connect } = require("nats");
require("dotenv").config();

let nc;

async function connectNATS() {
    try {
        nc = await connect({
            servers: process.env.NATS_URL
        });

        console.log(`✓ ${process.env.SERVICE_NAME} connected to NATS`);

    } catch (err) {

        console.error("NATS connection error:", err);
        process.exit(1);

    }
}

function getNatsConnection() {
    return nc;
}

module.exports = {
    connectNATS,
    getNatsConnection
};