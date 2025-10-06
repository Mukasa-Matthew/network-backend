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

// Get all alerts
router.get('/alerts', getConnection, async (req, res) => {
    try {
        const { notificationService } = require('../server');
        const alerts = notificationService.getAlerts();

        res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        console.error('Error getting alerts:', error);
        res.status(500).json({
            error: 'Failed to get alerts',
            message: error.message
        });
    }
});

// Get unread alerts
router.get('/alerts/unread', getConnection, async (req, res) => {
    try {
        const { notificationService } = require('../server');
        const unreadAlerts = notificationService.getUnreadAlerts();

        res.json({
            success: true,
            data: unreadAlerts
        });
    } catch (error) {
        console.error('Error getting unread alerts:', error);
        res.status(500).json({
            error: 'Failed to get unread alerts',
            message: error.message
        });
    }
});

// Mark alert as read
router.post('/alerts/:alertId/read', getConnection, async (req, res) => {
    try {
        const { alertId } = req.params;
        const { notificationService } = require('../server');

        notificationService.markAsRead(alertId);

        res.json({
            success: true,
            message: 'Alert marked as read'
        });
    } catch (error) {
        console.error('Error marking alert as read:', error);
        res.status(500).json({
            error: 'Failed to mark alert as read',
            message: error.message
        });
    }
});

// Mark all alerts as read
router.post('/alerts/read-all', getConnection, async (req, res) => {
    try {
        const { notificationService } = require('../server');

        notificationService.markAllAsRead();

        res.json({
            success: true,
            message: 'All alerts marked as read'
        });
    } catch (error) {
        console.error('Error marking all alerts as read:', error);
        res.status(500).json({
            error: 'Failed to mark all alerts as read',
            message: error.message
        });
    }
});

// Get notification status
router.get('/status', getConnection, async (req, res) => {
    try {
        const { notificationService } = require('../server');
        const status = notificationService.getMonitoringStatus();

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting notification status:', error);
        res.status(500).json({
            error: 'Failed to get notification status',
            message: error.message
        });
    }
});

// Start notification monitoring
router.post('/start', getConnection, async (req, res) => {
    try {
        const { notificationService } = require('../server');
        const { mikrotik } = req.connection;

        notificationService.startMonitoring(mikrotik);

        res.json({
            success: true,
            message: 'Notification monitoring started successfully',
            data: {
                isActive: true,
                monitoringInterval: '15 seconds'
            }
        });
    } catch (error) {
        console.error('Error starting notification monitoring:', error);
        res.status(500).json({
            error: 'Failed to start notification monitoring',
            message: error.message
        });
    }
});

// Stop notification monitoring
router.post('/stop', getConnection, async (req, res) => {
    try {
        const { notificationService } = require('../server');

        notificationService.stopMonitoring();

        res.json({
            success: true,
            message: 'Notification monitoring stopped successfully',
            data: {
                isActive: false
            }
        });
    } catch (error) {
        console.error('Error stopping notification monitoring:', error);
        res.status(500).json({
            error: 'Failed to stop notification monitoring',
            message: error.message
        });
    }
});

// Clear old alerts
router.post('/clear-old', getConnection, async (req, res) => {
    try {
        const { daysOld = 7 } = req.body;
        const { notificationService } = require('../server');

        notificationService.clearOldAlerts(daysOld);

        res.json({
            success: true,
            message: `Cleared alerts older than ${daysOld} days`
        });
    } catch (error) {
        console.error('Error clearing old alerts:', error);
        res.status(500).json({
            error: 'Failed to clear old alerts',
            message: error.message
        });
    }
});

// Test notification (create a test alert)
router.post('/test', getConnection, async (req, res) => {
    try {
        const { notificationService } = require('../server');

        await notificationService.createAlert('SYSTEM_WARNING', {
            title: 'Test Alert',
            message: 'This is a test notification from your MikroTik monitoring system',
            details: {
                testField: 'Test Value',
                timestamp: new Date().toISOString(),
                source: 'Manual Test'
            },
            timestamp: new Date()
        });

        res.json({
            success: true,
            message: 'Test notification sent successfully'
        });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({
            error: 'Failed to send test notification',
            message: error.message
        });
    }
});

module.exports = router;

