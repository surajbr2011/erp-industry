const db = require('../config/database');

const auditLog = (action, entityType) => async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (data) {
        if (res.statusCode < 400 && req.user) {
            db.query(
                'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address) VALUES ($1, $2, $3, $4, $5, $6)',
                [
                    req.user.id,
                    action,
                    entityType,
                    data?.data?.id || null,
                    JSON.stringify(req.body),
                    req.ip
                ]
            ).catch(err => console.error('Audit log error:', err));
        }
        return originalJson(data);
    };

    next();
};

module.exports = { auditLog };
