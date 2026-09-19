const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files from the www directory (for index.html)
app.use(express.static('www'));

// =======================
// VOLUNTEERS API
// =======================
app.get('/api/volunteers', (req, res) => {
    db.all("SELECT * FROM volunteers ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Parse the JSON string array for registeredEvents
        const formattedRows = rows.map(r => ({
            ...r,
            registeredEvents: JSON.parse(r.registeredEvents)
        }));
        res.json(formattedRows);
    });
});

app.post('/api/volunteers', (req, res) => {
    const { id, name, roll, dept, year, blood, phone, email } = req.body;
    const insert = 'INSERT INTO volunteers (id, name, roll, dept, year, blood, phone, email) VALUES (?,?,?,?,?,?,?,?)';

    db.run(insert, [id, name, roll, dept, year, blood, phone, email], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, name, roll, dept, year, blood, phone, email, hours: 0, status: 'Active', registeredEvents: [] });
    });
});

// =======================
// EVENTS API
// =======================
app.get('/api/events', (req, res) => {
    db.all("SELECT * FROM events", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/events', (req, res) => {
    const { id, title, category, date, venue, hours, target, inCharge } = req.body;
    const insert = 'INSERT INTO events (id, title, category, date, venue, hours, target, registered, status, inCharge) VALUES (?,?,?,?,?,?,?,?,?,?)';

    db.run(insert, [id, title, category, date, venue, hours, target, 0, 'Upcoming', inCharge], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id, title, category, date, venue, hours, target, registered: 0, status: 'Upcoming', inCharge });
    });
});

app.post('/api/events/register', (req, res) => {
    const { eventId, volunteerId } = req.body;

    db.get("SELECT * FROM volunteers WHERE id = ?", [volunteerId], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Volunteer not found" });

        const registeredEvents = JSON.parse(row.registeredEvents);
        if (!registeredEvents.includes(eventId)) {
            registeredEvents.push(eventId);
            db.run("UPDATE volunteers SET registeredEvents = ? WHERE id = ?", [JSON.stringify(registeredEvents), volunteerId]);

            // Increment event registered count
            db.run("UPDATE events SET registered = registered + 1 WHERE id = ?", [eventId]);

            // Fetch event details to add to attendance queue
            db.get("SELECT * FROM events WHERE id = ?", [eventId], (err, eventRow) => {
                if (eventRow) {
                    const attId = 'ATT-' + Math.floor(100 + Math.random() * 900);
                    const today = new Date().toISOString().split('T')[0];
                    db.run("INSERT INTO attendance_queue (id, volunteerId, volunteerName, eventId, eventTitle, hours, date) VALUES (?,?,?,?,?,?,?)",
                        [attId, volunteerId, row.name, eventId, eventRow.title, eventRow.hours, today]);
                }
            });

            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Already registered" });
        }
    });
});

// =======================
// ATTENDANCE QUEUE API
// =======================
app.get('/api/attendance', (req, res) => {
    db.all("SELECT * FROM attendance_queue", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/attendance/approve', (req, res) => {
    const { id } = req.body;

    db.get("SELECT * FROM attendance_queue WHERE id = ?", [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Attendance not found" });

        // Add hours to volunteer
        db.run("UPDATE volunteers SET hours = hours + ? WHERE id = ?", [row.hours, row.volunteerId], (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });

            // Remove from queue
            db.run("DELETE FROM attendance_queue WHERE id = ?", [id], (delErr) => {
                if (delErr) return res.status(500).json({ error: delErr.message });
                res.json({ success: true, volunteerId: row.volunteerId, addedHours: row.hours });
            });
        });
    });
});

app.post('/api/attendance/reject', (req, res) => {
    const { id } = req.body;
    db.run("DELETE FROM attendance_queue WHERE id = ?", [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// =======================
// APP STATE (Role & Announcement)
// =======================
app.get('/api/state', (req, res) => {
    db.all("SELECT key, value FROM app_state", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const state = {};
        rows.forEach(r => state[r.key] = r.value);
        res.json(state);
    });
});

app.post('/api/state', (req, res) => {
    const { key, value } = req.body;
    db.run("UPDATE app_state SET value = ? WHERE key = ?", [value, key], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
