const { connect, StringCodec } = require("nats");
require("dotenv").config();

let nc;
const sc = StringCodec();

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

function getStringCodec() {
    return sc;
}

module.exports = {

    connectNATS,
    getNatsConnection,
    getStringCodec

};