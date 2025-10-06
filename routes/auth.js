const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const MikroTikAPI = require('../services/mikrotik-api');
const router = express.Router();

// Store active connections (in production, use Redis or database)
const activeConnections = new Map();

// Cleanup old connections every 5 minutes
setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [connectionId, connection] of activeConnections.entries()) {
        if (now - connection.lastActivity > maxAge) {
            console.log(`Cleaning up old connection: ${connectionId}`);
            try {
                connection.mikrotik.disconnect();
            } catch (error) {
                console.error('Error disconnecting old connection:', error);
            }
            activeConnections.delete(connectionId);
        }
    }
}, 5 * 60 * 1000); // Run every 5 minutes

// Login validation middleware
const loginValidation = [
    body('ipAddress')
        .isIP()
        .withMessage('Please provide a valid IP address'),
    body('username')
        .isLength({ min: 1 })
        .withMessage('Username is required'),
    body('password')
        .isLength({ min: 1 })
        .withMessage('Password is required')
];

// Router login endpoint
router.post('/login', loginValidation, async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { ipAddress, username, password } = req.body;

        // Test connection to MikroTik router
        const mikrotik = new MikroTikAPI(ipAddress, username, password);

        try {
            await mikrotik.connect();

            // Get basic router info to verify connection
            const routerInfo = await mikrotik.getSystemResource();

            // Generate JWT token
            const token = jwt.sign(
                {
                    ipAddress,
                    username,
                    routerId: `${ipAddress}-${username}`,
                    timestamp: Date.now()
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Store connection for later use
            const connectionId = `${ipAddress}-${username}`;
            activeConnections.set(connectionId, {
                mikrotik,
                ipAddress,
                username,
                lastActivity: Date.now(),
                routerInfo
            });

            res.json({
                success: true,
                token,
                routerInfo: {
                    ipAddress,
                    username,
                    model: routerInfo.model || 'Unknown',
                    version: routerInfo.version || 'Unknown',
                    uptime: routerInfo.uptime || 'Unknown'
                },
                message: 'Successfully connected to MikroTik router'
            });

        } catch (connectionError) {
            console.error('MikroTik connection error:', connectionError);
            res.status(401).json({
                error: 'Authentication failed',
                message: 'Invalid credentials or unable to connect to router'
            });
        }

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process login request'
        });
    }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const connectionId = decoded.routerId;

        // Close MikroTik connection
        const connection = activeConnections.get(connectionId);
        if (connection) {
            try {
                await connection.mikrotik.disconnect();
            } catch (disconnectError) {
                console.error('Error disconnecting from MikroTik:', disconnectError);
            }
            activeConnections.delete(connectionId);
        }

        res.json({ success: true, message: 'Successfully logged out' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to process logout request'
        });
    }
});

// Verify token endpoint
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const connectionId = decoded.routerId;

        // Check if connection is still active
        const connection = activeConnections.get(connectionId);
        if (!connection) {
            return res.status(401).json({ error: 'Session expired' });
        }

        // Update last activity
        connection.lastActivity = Date.now();

        res.json({
            valid: true,
            routerInfo: {
                ipAddress: connection.ipAddress,
                username: connection.username,
                model: connection.routerInfo?.model || 'Unknown',
                version: connection.routerInfo?.version || 'Unknown',
                uptime: connection.routerInfo?.uptime || 'Unknown',
                lastActivity: connection.lastActivity
            }
        });

    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Export router and activeConnections for use in other modules
module.exports = router;
module.exports.activeConnections = activeConnections;
