const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_hKYtMkup74yi@ep-purple-shadow-agja69ll-pooler.c-2.eu-central-1.aws.neon.tech/neondb',
    ssl: { rejectUnauthorized: false } // Required for Neon/AWS usually
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(),
    pool: pool
};
