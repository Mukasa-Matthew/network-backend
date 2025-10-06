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
        const authModule = require('../routes/auth');
        const connection = authModule.activeConnections.get(connectionId);

        if (!connection) {
            return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
        }

        // Update last activity
        connection.lastActivity = Date.now();

        req.connection = connection;
        req.connectionId = connectionId;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Start hotspot monitoring
router.post('/start', getConnection, async (req, res) => {
    try {
        console.log('Starting hotspot monitoring...');
        const { hotspotMonitor } = require('../server');
        console.log('HotspotMonitor imported:', !!hotspotMonitor);
        const { mikrotik } = req.connection;
        console.log('Mikrotik connection:', !!mikrotik);

        await hotspotMonitor.startMonitoring(mikrotik);

        res.json({
            success: true,
            message: 'Hotspot monitoring started successfully',
            data: {
                isActive: true,
                monitoringInterval: '10 seconds'
            }
        });

    } catch (error) {
        console.error('Error starting hotspot monitoring:', error);
        res.status(500).json({
            error: 'Failed to start hotspot monitoring',
            message: error.message
        });
    }
});

// Stop hotspot monitoring
router.post('/stop', getConnection, async (req, res) => {
    try {
        const { hotspotMonitor } = require('../server');

        hotspotMonitor.stopMonitoring();

        res.json({
            success: true,
            message: 'Hotspot monitoring stopped successfully',
            data: {
                isActive: false
            }
        });

    } catch (error) {
        console.error('Error stopping hotspot monitoring:', error);
        res.status(500).json({
            error: 'Failed to stop hotspot monitoring',
            message: error.message
        });
    }
});

// Restart hotspot monitoring
router.post('/restart', getConnection, async (req, res) => {
    try {
        const { hotspotMonitor } = require('../server');
        const { mikrotik } = req.connection;

        await hotspotMonitor.restartMonitoring(mikrotik);

        res.json({
            success: true,
            message: 'Hotspot monitoring restarted successfully',
            data: {
                isActive: true,
                monitoringInterval: '10 seconds'
            }
        });

    } catch (error) {
        console.error('Error restarting hotspot monitoring:', error);
        res.status(500).json({
            error: 'Failed to restart hotspot monitoring',
            message: error.message
        });
    }
});

// Get monitoring status
router.get('/status', getConnection, async (req, res) => {
    try {
        const { hotspotMonitor } = require('../server');

        const status = hotspotMonitor.getMonitoringStatus();

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('Error getting hotspot monitoring status:', error);
        res.status(500).json({
            error: 'Failed to get monitoring status',
            message: error.message
        });
    }
});

// Get active users being monitored
router.get('/active-users', getConnection, async (req, res) => {
    try {
        const { hotspotMonitor } = require('../server');

        const activeUsers = hotspotMonitor.getActiveUsers();

        res.json({
            success: true,
            data: activeUsers
        });

    } catch (error) {
        console.error('Error getting active users:', error);
        res.status(500).json({
            error: 'Failed to get active users',
            message: error.message
        });
    }
});

// Manual scan trigger
router.post('/scan', getConnection, async (req, res) => {
    try {
        const { hotspotMonitor } = require('../server');
        const { mikrotik } = req.connection;

        await hotspotMonitor.manualScan(mikrotik);

        res.json({
            success: true,
            message: 'Manual scan completed successfully'
        });

    } catch (error) {
        console.error('Error during manual scan:', error);
        res.status(500).json({
            error: 'Failed to perform manual scan',
            message: error.message
        });
    }
});

// Test email notification
router.post('/test-email', getConnection, async (req, res) => {
    try {
        // Check if email configuration is set up
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            return res.status(400).json({
                error: 'Email configuration missing',
                message: 'Please set EMAIL_USER and EMAIL_PASSWORD in your .env file. See EMAIL_SETUP.md for instructions.',
                setupRequired: true
            });
        }

        if (!process.env.ADMIN_EMAIL) {
            return res.status(400).json({
                error: 'Admin email missing',
                message: 'Please set ADMIN_EMAIL in your .env file to receive notifications.',
                setupRequired: true
            });
        }

        const { hotspotMonitor } = require('../server');

        const testUserData = {
            hostName: 'Test User',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            ipAddress: '11.0.0.100',
            connectionType: 'Hotspot',
            signalStrength: '-65 dBm',
            sessionId: 'test-session-123',
            loginBy: 'MAC',
            idleTimeout: '30m',
            sessionStart: new Date().toLocaleString(),
            uptime: '5m 30s',
            bytesIn: '1024000',
            bytesOut: '512000',
            totalUsersRemaining: 12 // Test with 12 users total
        };

        const emailSent = await hotspotMonitor.handleUserConnected(testUserData, 'AA:BB:CC:DD:EE:FF', 12);

        if (emailSent) {
            res.json({
                success: true,
                message: 'Test email sent successfully',
                data: {
                    recipient: process.env.ADMIN_EMAIL
                }
            });
        } else {
            res.status(500).json({
                error: 'Failed to send test email',
                message: 'Check your email configuration and try again.',
                data: {
                    recipient: process.env.ADMIN_EMAIL
                }
            });
        }

    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({
            error: 'Failed to send test email',
            message: error.message
        });
    }
});

module.exports = router;
