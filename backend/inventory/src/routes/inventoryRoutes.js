const express = require("express");

const router = express.Router();

const inventoryController = require("../controllers/inventoryController");

// GET inventory
router.get("/", inventoryController.getInventory);

// GET by id
router.get("/:inventory_id", inventoryController.getInventoryById);

// POST purchase ticket 
router.post("/purchase", inventoryController.purchaseTicket);


module.exports=router;