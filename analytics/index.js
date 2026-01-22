const express = require('express');
const amqp = require('amqplib');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// In-memory metrics storage
const metrics = {
    total_events: 0,
    events_by_type: {},
    last_event: null
};

// RabbitMQ Setup
const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq:5672');
        const channel = await connection.createChannel();
        const EXCHANGE_NAME = 'integrahub_events';

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

        // Exclusive queue for analytics (so we get a copy of everything via fanout or broad topic)
        const q = await channel.assertQueue('', { exclusive: true });

        // Bind to all events
        await channel.bindQueue(q.queue, EXCHANGE_NAME, '#');

        console.log('Analytics Service connected to RabbitMQ. Waiting for events...');

        channel.consume(q.queue, (msg) => {
            if (msg.content) {
                const content = JSON.parse(msg.content.toString());
                const routingKey = msg.fields.routingKey;

                // Update Metrics
                metrics.total_events++;
                metrics.events_by_type[routingKey] = (metrics.events_by_type[routingKey] || 0) + 1;
                metrics.last_event = {
                    routingKey,
                    timestamp: new Date(),
                    ...content
                };

                console.log(`Analytics recorded: ${routingKey}`);
            }
        }, { noAck: true });

    } catch (e) {
        console.error('RabbitMQ Error', e);
        setTimeout(connectRabbitMQ, 5000);
    }
};

app.get('/analytics', (req, res) => {
    res.json(metrics);
});

app.listen(PORT, async () => {
    console.log(`Analytics Service running on port ${PORT}`);
    await connectRabbitMQ();
});
