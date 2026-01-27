const db = require('../config/db');

class AuthController {

    // POST /api/v1/auth/device-login
    // Body: { deviceId }
    // Returns: { user: { id, deviceId, email, phone }, isNewUser }
    async loginDevice(req, res) {
        const { deviceId } = req.body;

        if (!deviceId) {
            return res.status(400).json({ error: "Device ID is required" });
        }

        try {
            const client = await db.getClient();

            // Check if user exists
            const checkRes = await client.query('SELECT * FROM users WHERE device_id = $1', [deviceId]);

            let user;
            let isNewUser = false;

            if (checkRes.rows.length > 0) {
                user = checkRes.rows[0];
            } else {
                // Create new user
                const insertRes = await client.query(
                    'INSERT INTO users (device_id) VALUES ($1) RETURNING *',
                    [deviceId]
                );
                user = insertRes.rows[0];
                isNewUser = true;
                console.log(`[Auth] Created new user for device: ${deviceId}`);
            }

            client.release();
            res.json({
                user: {
                    id: user.id,
                    deviceId: user.device_id,
                    email: user.email,
                    phone: user.phone
                },
                isNewUser
            });

        } catch (e) {
            console.error("Auth Error:", e);
            res.status(500).json({ error: "Authentication failed" });
        }
    }

    // PUT /api/v1/auth/profile
    // Body: { userId, email, phone }
    async updateProfile(req, res) {
        const { userId, email, phone } = req.body;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        try {
            const client = await db.getClient();

            // Update fields
            // We use COALESCE to keep existing values if not provided (or handle in frontend)
            // But here let's assume partial updates are allowed via separate queries or dynamic query builder.
            // For simplicity: Update both if provided, or keep old.

            // First get current user
            const currentRes = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
            if (currentRes.rows.length === 0) {
                client.release();
                return res.status(404).json({ error: "User not found" });
            }
            const currentUser = currentRes.rows[0];

            const newEmail = email !== undefined ? email : currentUser.email;
            const newPhone = phone !== undefined ? phone : currentUser.phone;

            const updateRes = await client.query(
                'UPDATE users SET email = $1, phone = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
                [newEmail, newPhone, userId]
            );

            client.release();
            res.json({
                success: true,
                user: {
                    id: updateRes.rows[0].id,
                    email: updateRes.rows[0].email,
                    phone: updateRes.rows[0].phone
                }
            });

        } catch (e) {
            console.error("Profile Update Error:", e);
            res.status(500).json({ error: "Update failed" });
        }
    }
}

module.exports = new AuthController();
