const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const WebsiteMonitoringService = require('../services/website-monitoring');
const MikroTikAPI = require('../services/mikrotik-api');

// Middleware to get connection from token
const getConnection = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        } catch (jwtError) {
            console.error('JWT verification failed:', jwtError.message);
            if (jwtError.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
            } else if (jwtError.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
            }
            return res.status(401).json({ error: 'Token verification failed' });
        }
        const connectionId = decoded.routerId;

        // Import activeConnections from auth route
        const authModule = require('../routes/auth');
        const connection = authModule.activeConnections.get(connectionId);

        if (!connection) {
            // Try to reconnect using the token data
            try {
                const mikrotik = new MikroTikAPI(decoded.ipAddress, decoded.username, decoded.password);
                await mikrotik.connect();

                // Recreate the connection
                authModule.activeConnections.set(connectionId, {
                    mikrotik,
                    ipAddress: decoded.ipAddress,
                    username: decoded.username,
                    lastActivity: Date.now()
                });

                req.connection = authModule.activeConnections.get(connectionId);
                req.connectionId = connectionId;
                next();
            } catch (reconnectError) {
                console.error('Failed to reconnect:', reconnectError);
                return res.status(401).json({ error: 'Session expired - please login again' });
            }
            return;
        }

        // Check if the connection is still healthy
        if (connection.mikrotik && !connection.mikrotik.connected) {
            console.log('Connection lost, attempting to reconnect...');
            try {
                await connection.mikrotik.connect();
                connection.lastActivity = Date.now();
            } catch (reconnectError) {
                console.error('Failed to reconnect existing connection:', reconnectError);
                authModule.activeConnections.delete(connectionId);
                return res.status(401).json({ error: 'Connection lost - please login again' });
            }
        }

        req.connection = connection;
        req.connectionId = connectionId;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Get comprehensive website monitoring data
router.get('/website-monitoring', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const websiteMonitoringService = new WebsiteMonitoringService(mikrotik.connection);

        const data = await websiteMonitoringService.getWebsiteMonitoringData();

        console.log('Website monitoring data fetched successfully');
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching website monitoring data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch website monitoring data',
            message: error.message
        });
    }
});

// Get website activity by user
router.get('/website-activity-by-user', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const websiteMonitoringService = new WebsiteMonitoringService(mikrotik.connection);

        const data = await websiteMonitoringService.getWebsiteMonitoringData();

        console.log('User activity data fetched successfully');
        res.json({ success: true, data: data.userActivity });
    } catch (error) {
        console.error('Error fetching user activity data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user activity data',
            message: error.message
        });
    }
});

// Get web proxy logs
router.get('/web-proxy-logs', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const websiteMonitoringService = new WebsiteMonitoringService(mikrotik.connection);
        const limit = parseInt(req.query.limit) || 100;

        const logs = await websiteMonitoringService.getWebProxyLogs(limit);

        console.log(`Web proxy logs fetched successfully (${logs.length} entries)`);
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Error fetching web proxy logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch web proxy logs',
            message: error.message
        });
    }
});

// Get DNS queries
router.get('/dns-queries', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const websiteMonitoringService = new WebsiteMonitoringService(mikrotik.connection);
        const limit = parseInt(req.query.limit) || 100;

        const queries = await websiteMonitoringService.getDNSQueries(limit);

        console.log(`DNS queries fetched successfully (${queries.length} entries)`);
        res.json({ success: true, data: queries });
    } catch (error) {
        console.error('Error fetching DNS queries:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch DNS queries',
            message: error.message
        });
    }
});

// Get active connections
router.get('/active-connections', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const websiteMonitoringService = new WebsiteMonitoringService(mikrotik.connection);

        const connections = await websiteMonitoringService.getActiveConnections();

        console.log(`Active connections fetched successfully (${connections.length} connections)`);
        res.json({ success: true, data: connections });
    } catch (error) {
        console.error('Error fetching active connections:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch active connections',
            message: error.message
        });
    }
});

// Get web proxy statistics
router.get('/web-proxy-stats', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const websiteMonitoringService = new WebsiteMonitoringService(mikrotik.connection);

        const stats = await websiteMonitoringService.getWebProxyStats();

        console.log('Web proxy statistics fetched successfully');
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching web proxy statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch web proxy statistics',
            message: error.message
        });
    }
});

// Get real-time monitoring summary
router.get('/monitoring-summary', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const websiteMonitoringService = new WebsiteMonitoringService(mikrotik.connection);

        const data = await websiteMonitoringService.getWebsiteMonitoringData();

        console.log('Monitoring summary fetched successfully');
        res.json({ success: true, data: data.summary });
    } catch (error) {
        console.error('Error fetching monitoring summary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monitoring summary',
            message: error.message
        });
    }
});

module.exports = router;
