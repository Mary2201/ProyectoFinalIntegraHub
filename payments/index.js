const express = require('express');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const CircuitBreaker = require('opossum');

const app = express();
const PORT = process.env.PORT || 3000;

// Circuit Breaker Setup
const mockPaymentGateway = async (amount) => {
    // Simulate latency
    await new Promise(r => setTimeout(r, 100));

    // Simulate Failure
    if (Math.random() > 0.7) { // 30% failure rate
        throw new Error("Payment Gateway Timeout");
    }
    return { status: "CAPTURED", transaction_id: uuidv4() };
};

const breakerOptions = {
    timeout: 3000, // If function takes longer than 3 seconds, fail
    errorThresholdPercentage: 50, // If 50% of requests fail, open circuit
    resetTimeout: 10000 // Wait 10 seconds before trying again
};

const breaker = new CircuitBreaker(mockPaymentGateway, breakerOptions);
breaker.fallback(() => ({ status: "FAILED", reason: "Circuit Open or Gateway Error" }));

breaker.on('open', () => console.warn('BREAKER OPEN: Skipping requests'));
breaker.on('close', () => console.log('BREAKER CLOSED: Resuming normal operation'));

// RabbitMQ Setup
let channel;
const EXCHANGE_NAME = 'integrahub_events';
const DLX_NAME = 'integrahub_dlx';
const QUEUE_NAME = 'payments_queue';
const DLQ_NAME = 'payments_dlq';

const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();

        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        // Dead Letter Exchange
        await channel.assertExchange(DLX_NAME, 'topic', { durable: true });

        // DLQ
        await channel.assertQueue(DLQ_NAME, { durable: true });
        await channel.bindQueue(DLQ_NAME, DLX_NAME, '#'); // Catch all

        // Main Queue with DLX
        await channel.assertQueue(QUEUE_NAME, {
            durable: true,
            arguments: {
                'x-dead-letter-exchange': DLX_NAME,
                // 'x-dead-letter-routing-key': 'dlq.payment' // Optional, keeps original if excluded
            }
        });
        await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'inventory.reserved');

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg) {
                await processPayment(msg);
            }
        });
        console.log('Payment Service connected and listening');
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

const processPayment = async (msg) => {
    const content = JSON.parse(msg.content.toString());
    const { correlation_id, data } = content;

    console.log(`Processing Payment for Order ${data.order_id}`);

    try {
        // Use Circuit Breaker
        const result = await breaker.fire(data.total_amount || 100);

        const responseEvent = {
            event_id: uuidv4(),
            timestamp: new Date().toISOString(),
            correlation_id: correlation_id,
            data: { order_id: data.order_id, payment: result }
        };

        if (result.status === "CAPTURED") {
            responseEvent.event_type = 'PaymentProcessed';
            publishEvent('payment.processed', responseEvent);
            channel.ack(msg);
        } else {
            console.error("Payment Failed:", result.reason);
            // Decide: if it's a hard fail, publish failed event.
            // If it's a transient error, maybe nack to DLQ?
            // Here we treat Logic Failure as 'PaymentFailed' event
            responseEvent.event_type = 'PaymentFailed';
            publishEvent('payment.failed', responseEvent);
            channel.ack(msg);
        }

    } catch (e) {
        console.error("System Error processing payment:", e.message);
        // This will send to DLQ due to x-dead-letter-exchange
        channel.nack(msg, false, false);
    }
};

app.get('/health', (req, res) => res.json({ status: 'UP', breaker: breaker.opened ? 'OPEN' : 'CLOSED' }));

app.listen(PORT, async () => {
    console.log(`Payment Service running`);
    await connectRabbitMQ();
});
