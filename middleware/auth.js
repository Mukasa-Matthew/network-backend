const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Middleware to get active connection
const getActiveConnection = (req, res, next) => {
    try {
        // Check if req.user exists and has routerId
        if (!req.user || !req.user.routerId) {
            return res.status(401).json({
                error: 'Invalid session',
                code: 'SESSION_EXPIRED'
            });
        }

        const connectionId = req.user.routerId;

        // Import activeConnections from auth route
        const authModule = require('../routes/auth');
        const connection = authModule.activeConnections.get(connectionId);

        if (!connection) {
            return res.status(401).json({
                error: 'Session expired',
                code: 'SESSION_EXPIRED'
            });
        }

        // Update last activity
        connection.lastActivity = Date.now();

        req.connection = connection;
        req.connectionId = connectionId;
        next();
    } catch (error) {
        console.error('Error getting active connection:', error);
        res.status(401).json({
            error: 'Invalid session',
            code: 'SESSION_EXPIRED'
        });
    }
};

// Combined middleware for protected routes
const requireAuth = [verifyToken, getActiveConnection];

// Alias for getActiveConnection for backward compatibility
const getConnection = getActiveConnection;

module.exports = {
    verifyToken,
    getActiveConnection,
    getConnection,
    requireAuth
};

