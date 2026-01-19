const amqp = require('amqplib');

let channel;
const EXCHANGE_NAME = 'integrahub_events';

const connectRabbitMQ = async (onConnected) => {
    try {
        const connection = await amqp.connect(process.env.RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        console.log('Connected to RabbitMQ');
        if (onConnected) onConnected(channel);
    } catch (error) {
        console.error('Error connecting to RabbitMQ', error);
        setTimeout(() => connectRabbitMQ(onConnected), 5000);
    }
};

const publishEvent = (routingKey, message) => {
    if (!channel) {
        console.error('RabbitMQ channel not ready');
        return;
    }
    const msgBuffer = Buffer.from(JSON.stringify(message));
    channel.publish(EXCHANGE_NAME, routingKey, msgBuffer);
    console.log(`Published event: ${routingKey}`);
};

const subscribeToEvents = async (queueName, routingKeys, handler) => {
    if (!channel) return;
    await channel.assertQueue(queueName, { durable: true });
    for (const key of routingKeys) {
        await channel.bindQueue(queueName, EXCHANGE_NAME, key);
    }
    channel.consume(queueName, async (msg) => {
        if (msg) {
            const content = JSON.parse(msg.content.toString());
            await handler(msg.fields.routingKey, content);
            channel.ack(msg);
        }
    });
};

module.exports = { connectRabbitMQ, publishEvent, subscribeToEvents };
