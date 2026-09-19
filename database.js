const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'nss.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            // Create App State Table
            db.run(`CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);

            // Initialize default state if not exists
            db.get(`SELECT key FROM app_state WHERE key = 'announcement'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO app_state (key, value) VALUES ('announcement', '')`);
                }
            });
            db.get(`SELECT key FROM app_state WHERE key = 'role'`, (err, row) => {
                if (!row) {
                    db.run(`INSERT INTO app_state (key, value) VALUES ('role', 'volunteer')`);
                }
            });

            // Create Volunteers Table
            db.run(`CREATE TABLE IF NOT EXISTS volunteers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                roll TEXT NOT NULL,
                dept TEXT NOT NULL,
                year TEXT NOT NULL,
                blood TEXT NOT NULL,
                phone TEXT NOT NULL,
                email TEXT NOT NULL,
                hours INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Active',
                registeredEvents TEXT DEFAULT '[]'
            )`);

            // Insert Demo Volunteer if empty
            db.get("SELECT COUNT(*) as count FROM volunteers", (err, row) => {
                if (row && row.count === 0) {
                    db.run(`INSERT INTO volunteers (id, name, roll, dept, year, blood, phone, email, hours, registeredEvents) VALUES 
                        ('22A91A04K3', 'Jaswanth', '22A91A04K3', 'ECE', '3', 'O+', '+91-9876543210', 'jaswanth@example.com', 120, '[]')`);
                }
            });

            // Create Events Table
            db.run(`CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                date TEXT NOT NULL,
                venue TEXT NOT NULL,
                hours INTEGER NOT NULL,
                target INTEGER NOT NULL,
                registered INTEGER DEFAULT 0,
                status TEXT NOT NULL,
                inCharge TEXT NOT NULL
            )`);

            // Create Attendance Queue Table
            db.run(`CREATE TABLE IF NOT EXISTS attendance_queue (
                id TEXT PRIMARY KEY,
                volunteerId TEXT NOT NULL,
                volunteerName TEXT NOT NULL,
                eventId TEXT NOT NULL,
                eventTitle TEXT NOT NULL,
                hours INTEGER NOT NULL,
                date TEXT NOT NULL
            )`);
        });
    }
});

module.exports = db;
