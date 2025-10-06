const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to get connection from token
const getConnection = (req, res, next) => {
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
        const authModule = require('./auth');
        const connection = authModule.activeConnections.get(connectionId);

        if (!connection) {
            return res.status(401).json({ error: 'Session expired' });
        }

        req.connection = connection;
        req.connectionId = connectionId;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Start user monitoring
router.post('/start', getConnection, async (req, res) => {
    try {
        const { userMonitor } = require('../server');
        const { mikrotik } = req.connection;

        userMonitor.startMonitoring(mikrotik);

        res.json({
            success: true,
            message: 'User monitoring started successfully',
            data: {
                isActive: true,
                monitoringInterval: '30 seconds'
            }
        });

    } catch (error) {
        console.error('Error starting user monitoring:', error);
        res.status(500).json({
            error: 'Failed to start user monitoring',
            message: error.message
        });
    }
});

// Stop user monitoring
router.post('/stop', getConnection, async (req, res) => {
    try {
        const { userMonitor } = require('../server');

        userMonitor.stopMonitoring();

        res.json({
            success: true,
            message: 'User monitoring stopped successfully',
            data: {
                isActive: false
            }
        });

    } catch (error) {
        console.error('Error stopping user monitoring:', error);
        res.status(500).json({
            error: 'Failed to stop user monitoring',
            message: error.message
        });
    }
});

// Get monitoring status
router.get('/status', getConnection, async (req, res) => {
    try {
        const { userMonitor } = require('../server');

        const status = userMonitor.getMonitoringStatus();

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('Error getting monitoring status:', error);
        res.status(500).json({
            error: 'Failed to get monitoring status',
            message: error.message
        });
    }
});

// Get user statistics
router.get('/statistics', getConnection, async (req, res) => {
    try {
        const { userMonitor } = require('../server');

        const statistics = userMonitor.getUserStatistics();

        res.json({
            success: true,
            data: statistics
        });

    } catch (error) {
        console.error('Error getting user statistics:', error);
        res.status(500).json({
            error: 'Failed to get user statistics',
            message: error.message
        });
    }
});

// Test email notification
router.post('/test-email', getConnection, async (req, res) => {
    try {
        const { userMonitor } = require('../server');
        const { emailService } = userMonitor;

        const testUserData = {
            hostName: 'Test User',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            ipAddress: '192.168.1.100',
            connectionType: 'WiFi',
            signalStrength: '-65 dBm',
            sessionId: 'test-session-123',
            loginBy: 'MAC',
            idleTimeout: '30m',
            loginTime: new Date().toLocaleString()
        };

        const result = await emailService.notifyNewUserLogin(testUserData);

        res.json({
            success: true,
            message: 'Test email sent successfully',
            data: {
                sent: result,
                recipient: process.env.ADMIN_EMAIL
            }
        });

    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({
            error: 'Failed to send test email',
            message: error.message
        });
    }
});

// Cleanup old disconnected users
router.post('/cleanup', getConnection, async (req, res) => {
    try {
        const { userMonitor } = require('../server');

        userMonitor.cleanupOldDisconnectedUsers();

        res.json({
            success: true,
            message: 'Cleanup completed successfully'
        });

    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({
            error: 'Failed to perform cleanup',
            message: error.message
        });
    }
});

module.exports = router;

