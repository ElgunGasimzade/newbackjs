const db = require('../config/db');

class PlanController {

    // POST /api/v1/plans
    // Body: { userId, routeDetails, status = 'active' }
    async savePlan(req, res) {
        const { userId, routeDetails, status } = req.body;

        if (!userId || !routeDetails) {
            return res.status(400).json({ error: "UserId and RouteDetails required" });
        }

        try {
            const client = await db.getClient();

            // If new plan is active, maybe archive old active ones?
            // "it always says in progress but when i enter and complete it should be complated"
            // Let's just insert validation: Only one active plan? 
            // Or just mark previous 'active' as 'abandoned'?
            // For now, simple insert.

            const insertRes = await client.query(`
                INSERT INTO plans (user_id, route_details, status)
                VALUES ($1, $2, $3)
                RETURNING id, created_at, status
            `, [userId, routeDetails, status || 'active']);

            client.release();
            res.json(insertRes.rows[0]);

        } catch (e) {
            console.error("Save Plan Error:", e);
            res.status(500).json({ error: "Failed to save plan" });
        }
    }

    // GET /api/v1/plans/:userId
    async getPlans(req, res) {
        const { userId } = req.params;

        try {
            const client = await db.getClient();
            const result = await client.query(`
                SELECT * FROM plans 
                WHERE user_id = $1 
                ORDER BY created_at DESC
            `, [userId]);

            client.release();
            // Map to frontend structure if needed
            // Frontend: RouteHistoryItem(id, route, date, status)

            const history = result.rows.map(row => ({
                id: row.id, // Plan ID
                route: row.route_details,
                date: row.created_at,
                status: row.status,
                completedAt: row.completed_at
            }));

            res.json(history);

        } catch (e) {
            console.error("Get Plans Error:", e);
            res.status(500).json({ error: "Failed to fetch plans" });
        }
    }

    // PUT /api/v1/plans/:planId/complete
    async completePlan(req, res) {
        const { planId } = req.params;

        try {
            const client = await db.getClient();
            const result = await client.query(`
                UPDATE plans 
                SET status = 'completed', completed_at = NOW(),
                    route_details = COALESCE($2, route_details)
                WHERE id = $1 
                RETURNING *
            `, [planId, req.body.routeDetails || null]);

            client.release();
            if (result.rows.length === 0) {
                return res.status(404).json({ error: "Plan not found" });
            }
            res.json({ success: true, plan: result.rows[0] });

        } catch (e) {
            console.error("Complete Plan Error:", e);
            res.status(500).json({ error: "Failed to complete plan" });
        }
    }

    // DELETE /api/v1/plans/:planId (Soft Delete)
    async deletePlan(req, res) {
        const { planId } = req.params;

        try {
            const client = await db.getClient();
            // Soft Delete: Just hide it
            const result = await client.query(`
                UPDATE plans
                SET is_hidden = TRUE
                WHERE id = $1 
                RETURNING id
            `, [planId]);

            client.release();
            if (result.rowCount === 0) {
                return res.status(404).json({ error: "Plan not found" });
            }
            res.json({ success: true, id: planId });

        } catch (e) {
            console.error("Delete Plan Error:", e);
            res.status(500).json({ error: "Failed to delete plan" });
        }
    }

    // GET /api/v1/plans/:userId/stats
    async getStats(req, res) {
        const { userId } = req.params;
        try {
            const client = await db.getClient();
            // Aggregate stats from ALL completed plans (even hidden ones)
            // Check JSONB structure for savings? 
            // "totalSavings" is inside route_details -> totalSavings
            // Postgres JSONB query: SUM((route_details->>'totalSavings')::numeric)

            const result = await client.query(`
                SELECT 
                    COUNT(*) as total_trips,
                    COALESCE(SUM((route_details->>'totalSavings')::numeric), 0) as total_savings
                FROM plans
                WHERE user_id = $1 
                  AND status = 'completed'
             `, [userId]);

            client.release();
            const stats = result.rows[0];

            res.json({
                totalTrips: parseInt(stats.total_trips),
                totalSavings: parseFloat(stats.total_savings)
            });

        } catch (e) {
            console.error("Get Stats Error:", e);
            res.status(500).json({ error: "Failed to fetch stats" });
        }
    }
}

module.exports = new PlanController();
