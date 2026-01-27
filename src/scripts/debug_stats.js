const db = require('../config/db');

async function checkData() {
    const client = await db.getClient();
    try {
        const result = await client.query(`SELECT id, route_details, status FROM plans LIMIT 5;`);
        console.log("Plans Sample:");
        result.rows.forEach(row => {
            console.log(`ID: ${row.id}, Status: ${row.status}`);
            console.log(`Savings Type: ${typeof row.route_details.totalSavings}`);
            console.log(`Savings Value: ${row.route_details.totalSavings}`);
            console.log('---');
        });

        const statsCheck = await client.query(`
            SELECT 
                COUNT(*) as total_trips,
                COALESCE(SUM((route_details->>'totalSavings')::numeric), 0) as total_savings
            FROM plans
            WHERE status = 'completed'
        `);
        console.log("Stats Query Result:", statsCheck.rows[0]);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        client.release();
        process.exit(0);
    }
}

checkData();
