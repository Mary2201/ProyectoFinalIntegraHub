const express = require('express');
const amqp = require('amqplib');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// DB Setup
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const initDB = async () => {
    let retries = 5;
    while (retries > 0) {
        try {
            const client = await pool.connect();
            try {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS inventory_processed (
                        message_id VARCHAR(255) PRIMARY KEY,
                        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                client.release();
                console.log('Inventory DB initialized');
                return;
            } catch (e) {
                client.release();
                throw e;
            }
        } catch (e) {
            console.error(`Error initializing Inventory DB, retries left ${retries}`, e.message);
            retries--;
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    console.error('Could not initialize Inventory DB');
    process.exit(1);
};

// RabbitMQ Setup
let channel;
const EXCHANGE_NAME = 'integrahub_events';
const QUEUE_NAME = 'inventory_queue';

const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

        // Assert Queue and Bind to OrderCreated
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'order.created'); // Routing key

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg) {
                await processOrder(msg);
            }
        });
        console.log('Inventory Service connected and listening');
    } catch (e) {
        console.error('RabbitMQ Error', e);
        setTimeout(connectRabbitMQ, 5000);
    }
};

const publishEvent = (routingKey, message) => {
    if (!channel) return;
    channel.publish(EXCHANGE_NAME, routingKey, Buffer.from(JSON.stringify(message)));
    console.log(`Published ${routingKey}`);
};

const processOrder = async (msg) => {
    const content = JSON.parse(msg.content.toString());
    const { event_id, correlation_id, data } = content;

    // Idempotency Check
    try {
        const result = await pool.query('SELECT 1 FROM inventory_processed WHERE message_id = $1', [event_id]);
        if (result.rowCount > 0) {
            console.log(`Duplicate message ${event_id} detected. Skipping.`);
            channel.ack(msg);
            return;
        }
    } catch (e) {
        console.error('DB Error checking idempotency', e);
        // If DB fails, nack? For now, log.
        channel.nack(msg, false, true); // Requeue
        return;
    }

    console.log(`Processing Order ${data.order_id} for Inventory...`);

    // Simulate Processing Logic
    const isStockAvailable = Math.random() > 0.2; // 80% success

    const responseEvent = {
        event_id: uuidv4(),
        timestamp: new Date().toISOString(),
        correlation_id: correlation_id,
        data: {
            order_id: data.order_id
        }
    };

    if (isStockAvailable) {
        responseEvent.event_type = 'StockReserved';
        publishEvent('inventory.reserved', responseEvent);
    } else {
        responseEvent.event_type = 'StockFailed';
        responseEvent.data.reason = "Out of Stock";
        publishEvent('inventory.failed', responseEvent);
    }

    // Mark Processed
    try {
        await pool.query('INSERT INTO inventory_processed (message_id) VALUES ($1)', [event_id]);
        channel.ack(msg);
    } catch (e) {
        console.error('Error saving idempotency', e);
        // If we processed but failed to save idempotency, we might duplicate.
        // For strict transactionality, we need 'outbox' or transaction around both DB and Ack.
        // For this demo, simple ack is okay.
        channel.ack(msg);
    }
};

app.get('/health', (req, res) => res.json({ status: 'UP' }));

app.listen(PORT, async () => {
    console.log(`Inventory Service running`);
    await initDB();
    await connectRabbitMQ();
});
