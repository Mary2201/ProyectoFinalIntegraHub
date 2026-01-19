const express = require('express');
const amqp = require('amqplib');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

let clients = [];

// SSE Endpoint
app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = {
        id: clientId,
        res
    };
    clients.push(newClient);

    req.on('close', () => {
        console.log(`${clientId} Connection closed`);
        clients = clients.filter(c => c.id !== clientId);
    });
});

const sendToClients = (data) => {
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
};

// RabbitMQ
const EXCHANGE_NAME = 'integrahub_events';

const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

        const q = await channel.assertQueue('', { exclusive: true });
        await channel.bindQueue(q.queue, EXCHANGE_NAME, '#'); // Listen to EVERYTHING

        channel.consume(q.queue, (msg) => {
            if (msg) {
                const content = JSON.parse(msg.content.toString());
                const routingKey = msg.fields.routingKey;
                console.log(`[Event] ${routingKey}`);

                sendToClients({
                    type: 'EVENT',
                    routingKey,
                    timestamp: new Date().toISOString(),
                    payload: content
                });
            }
        }, { noAck: true });

        console.log('Notification Service Listening');
    } catch (e) {
        console.error('RabbitMQ Error', e);
        setTimeout(connectRabbitMQ, 5000);
    }
};

app.get('/health', (req, res) => res.json({ status: 'UP' }));

app.listen(PORT, async () => {
    console.log(`Notification Service running`);
    await connectRabbitMQ();
});
