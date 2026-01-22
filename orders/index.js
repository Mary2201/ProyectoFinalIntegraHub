const express = require('express');
const { initDB, pool } = require('./db');
const { connectRabbitMQ, publishEvent, subscribeToEvents } = require('./rabbitmq');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Simple JWT Simulation Middleware
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

// JWT Validation Middleware
const checkAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token format" });
    }

    const token = authHeader.split(" ")[1];
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: "Forbidden: Invalid or expired token" });
    }
};

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    // START DEMO ONLY: Hardcoded user validation
    if (username === 'admin' && password === 'password') {
        const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token });
    }
    // END DEMO ONLY
    return res.status(401).json({ error: "Invalid credentials" });
});

app.post('/orders', checkAuth, async (req, res) => {
    const { customer_id, items, total_amount } = req.body;

    // Quick validation
    if (!customer_id || !items || !total_amount) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const correlation_id = uuidv4();

    try {
        // 1. Save to DB
        const result = await pool.query(
            'INSERT INTO orders (customer_id, items, total_amount, status, correlation_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [customer_id, JSON.stringify(items), total_amount, 'CREATED', correlation_id]
        );
        const order = result.rows[0];

        // 2. Publish Event
        const eventPayload = {
            event_id: uuidv4(),
            event_type: 'OrderCreated',
            timestamp: new Date().toISOString(),
            correlation_id: order.correlation_id,
            data: {
                order_id: order.id,
                customer_id: order.customer_id,
                items: order.items, // Already parsed by pg
                total_amount: order.total_amount
            }
        };

        publishEvent('order.created', eventPayload);

        res.status(201).json({ message: "Order created successfully", order_id: order.id, correlation_id: order.correlation_id });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/orders/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Not found" });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: "Database error" });
    }
});

// Event Handler
const handleEvents = async (routingKey, event) => {
    const { correlation_id } = event;
    let newStatus = '';

    console.log(`Received ${routingKey} for ${correlation_id}`);

    if (routingKey === 'inventory.failed') newStatus = 'REJECTED_STOCK';
    else if (routingKey === 'payment.failed') newStatus = 'REJECTED_PAYMENT';
    else if (routingKey === 'payment.processed') newStatus = 'CONFIRMED';
    else return;

    try {
        await pool.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE correlation_id = $2', [newStatus, correlation_id]);
        console.log(`Order ${correlation_id} updated to ${newStatus}`);
    } catch (e) {
        console.error('Error updating order status', e);
    }
};

// Start
app.listen(PORT, async () => {
    console.log(`Order Service running on port ${PORT}`);
    await initDB();
    await connectRabbitMQ(async (channel) => {
        await subscribeToEvents('orders_choreography_queue', ['inventory.failed', 'payment.processed', 'payment.failed'], handleEvents);
    });
});
