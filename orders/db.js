const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

const initDB = async () => {
    let retries = 5;
    while (retries > 0) {
        try {
            const client = await pool.connect();
            try {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS orders (
                        id SERIAL PRIMARY KEY,
                        customer_id VARCHAR(50) NOT NULL,
                        items JSONB NOT NULL,
                        total_amount DECIMAL(10, 2) NOT NULL,
                        status VARCHAR(50) NOT NULL,
                        correlation_id UUID NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                `);
                console.log('Orders table ensured');
                client.release();
                return;
            } catch (e) {
                client.release();
                throw e;
            }
        } catch (e) {
            console.error(`Error initializing DB, retries left ${retries}`, e.message);
            retries--;
            await new Promise(res => setTimeout(res, 5000));
        }
    }
    console.error('Could not initialize DB after retries');
    process.exit(1);
};

module.exports = { pool, initDB };
