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

watcher.on('add', async (filePath) => {
    if (path.extname(filePath) !== '.csv') return;

    console.log(`New file detected: ${filePath}`);
    const results = [];

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`Parsed ${results.length} rows`);
            let errorOccurred = false;

            for (const row of results) {
                try {
                    // Map CSV to JSON
                    // Expected CSV: customer_id,item_name,price,quantity
                    const orderPayload = {
                        customer_id: row.customer_id,
                        total_amount: parseFloat(row.price) * parseInt(row.quantity),
                        items: [{ name: row.item_name, price: row.price, quantity: row.quantity }]
                    };

                    // Call Order Service
                    await axios.post('http://orders:3000/orders', orderPayload, {
                        headers: { 'Authorization': 'Bearer valid-token' }
                    });
                    console.log(`Order for ${row.customer_id} submitted`);
                } catch (e) {
                    console.error(`Error submitting order for row:`, row, e.message);
                    errorOccurred = true;
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
