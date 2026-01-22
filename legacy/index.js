const chokidar = require('chokidar');
const csv = require('csv-parser');
const fs = require('fs-extra');
const axios = require('axios');
const path = require('path');

const DROPZONE_PATH = process.env.DROPZONE_PATH || './dropzone';
const PROCESSED_PATH = path.join(DROPZONE_PATH, 'processed');
const ERROR_PATH = path.join(DROPZONE_PATH, 'error');

// Ensure directories
fs.ensureDirSync(PROCESSED_PATH);
fs.ensureDirSync(ERROR_PATH);

console.log(`Legacy Service watching ${DROPZONE_PATH}`);

const watcher = chokidar.watch(DROPZONE_PATH, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    depth: 0,
    awaitWriteFinish: true // Wait for file to be fully written
});

let authToken = null;

const login = async () => {
    try {
        const response = await axios.post('http://orders:3000/auth/login', {
            username: 'admin',
            password: 'password'
        });
        authToken = response.data.token;
        console.log('Legacy Service Authenticated. Token obtained.');
    } catch (e) {
        console.error('Failed to authenticate Legacy Service:', e.message);
    }
};

// Initial login
login();

// Refresh token periodically (every 50 mins)
setInterval(login, 50 * 60 * 1000);

watcher.on('add', async (filePath) => {
    if (path.extname(filePath) !== '.csv') return;

    console.log(`New file detected: ${filePath}`);
    const results = [];

    // Ensure we have a token
    if (!authToken) await login();

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`Parsed ${results.length} rows`);
            let errorOccurred = false;

            for (const row of results) {
                try {
                    // Map CSV to JSON
                    const orderPayload = {
                        customer_id: row.customer_id,
                        total_amount: parseFloat(row.price) * parseInt(row.quantity),
                        items: [{ name: row.item_name, price: row.price, quantity: row.quantity }]
                    };

                    // Call Order Service
                    await axios.post('http://orders:3000/orders', orderPayload, {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });
                    console.log(`Order for ${row.customer_id} submitted`);
                } catch (e) {
                    // Retry login if 401/403
                    if (e.response && (e.response.status === 401 || e.response.status === 403)) {
                        console.log('Token invalid, refreshing...');
                        await login();
                        try {
                            // Retry once
                            await axios.post('http://orders:3000/orders', orderPayload, {
                                headers: { 'Authorization': `Bearer ${authToken}` }
                            });
                            console.log(`Order for ${row.customer_id} submitted (after retry)`);
                        } catch (retryErr) {
                            console.error(`Error submitting order for row (after retry):`, row, retryErr.message);
                            errorOccurred = true;
                        }
                    } else {
                        console.error(`Error submitting order for row:`, row, e.message);
                        errorOccurred = true;
                    }
                }
            }

            // Move file
            const fileName = path.basename(filePath);
            const destination = errorOccurred ? path.join(ERROR_PATH, fileName) : path.join(PROCESSED_PATH, fileName);
            try {
                await fs.move(filePath, destination, { overwrite: true });
                console.log(`File moved to ${destination}`);
            } catch (e) {
                console.error('Error moving file', e);
            }
        });
});
