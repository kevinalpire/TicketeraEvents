const express = require("express");

const router = express.Router();

const paymentController = require("../controllers/paymentController");

router.get("/", paymentController.getPayments);

router.get(
    "/inventory/:inventory_id",
    paymentController.getPaymentByInventory
);

module.exports = router;