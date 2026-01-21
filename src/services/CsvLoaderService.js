const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

class CsvLoaderService {
    constructor(filePath) {
        this.filePath = filePath;
    }

    /**
     * Reads the CSV file and returns a Promise that resolves to a list of raw product objects.
     */
    async loadProducts() {
        return new Promise((resolve, reject) => {
            const results = [];
            const absolutePath = path.isAbsolute(this.filePath)
                ? this.filePath
                : path.join(__dirname, '../../uploads/finalcsvmarketf.csv');

            console.log("Loading CSV from:", absolutePath);
            if (!fs.existsSync(absolutePath)) {
                console.error(`CSV file not found at: ${absolutePath}`);
                return resolve([]);
            }

            fs.createReadStream(absolutePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    resolve(results);
                })
                .on('error', (err) => {
                    reject(err);
                });
        });
    }
}

module.exports = CsvLoaderService;
