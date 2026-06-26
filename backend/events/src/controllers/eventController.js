const pool = require("../config/db");

// CREATE EVENT
exports.createEvent = async (req, res) => {
  const { name, description, date, capacity, price } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO events (name, description, date, capacity, price) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, description, date, capacity, price]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// READ ALL EVENTS
exports.getAllEvents = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM events ORDER BY date DESC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// READ EVENT BY ID
exports.getEventById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "SELECT * FROM events WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching event:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// UPDATE EVENT
exports.updateEvent = async (req, res) => {
  const { id } = req.params;
  const { name, description, date, capacity, price } = req.body;

  try {
    const result = await pool.query(
      `UPDATE events
       SET name = $1,
           description = $2,
           date = $3,
           capacity = $4,
           price = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [name, description, date, capacity, price, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({ error: "Database error" });
  }
};

// DELETE EVENT
exports.deleteEvent = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM events WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({
      message: "Event deleted",
      event: result.rows[0]
    });

  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({ error: "Database error" });
  }
};