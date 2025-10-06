const express = require('express');
const jwt = require('jsonwebtoken');
const MikroTikAPI = require('../services/mikrotik-api');
const router = express.Router();

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
                mikrotik.connect().then(() => {
                    // Recreate the connection
                    activeConnections.set(connectionId, {
                        mikrotik,
                        ipAddress: decoded.ipAddress,
                        username: decoded.username,
                        lastActivity: Date.now()
                    });

                    req.connection = activeConnections.get(connectionId);
                    req.connectionId = connectionId;
                    next();
                }).catch((reconnectError) => {
                    console.error('Failed to reconnect:', reconnectError);
                    return res.status(401).json({ error: 'Session expired - please login again' });
                });
            } catch (reconnectError) {
                console.error('Failed to create new connection:', reconnectError);
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
                activeConnections.delete(connectionId);
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

// Get router information
router.get('/info', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;

        const [systemInfo, systemResource] = await Promise.all([
            mikrotik.getSystemInfo(),
            mikrotik.getSystemResource()
        ]);

        res.json({
            success: true,
            data: {
                identity: systemInfo,
                resources: systemResource,
                connectionInfo: {
                    ipAddress: req.connection.ipAddress,
                    username: req.connection.username,
                    lastActivity: req.connection.lastActivity
                }
            }
        });

    } catch (error) {
        console.error('Error getting router info:', error);
        res.status(500).json({
            error: 'Failed to get router information',
            message: error.message
        });
    }
});

// Get interface information
router.get('/interfaces', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const interfaces = await mikrotik.getInterfaceStats();

        res.json({
            success: true,
            data: interfaces
        });

    } catch (error) {
        console.error('Error getting interfaces:', error);
        res.status(500).json({
            error: 'Failed to get interface information',
            message: error.message
        });
    }
});

// Get wireless information
router.get('/wireless', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;

        const [wirelessInterfaces, wirelessRegistrations] = await Promise.all([
            mikrotik.getWirelessInterfaces(),
            mikrotik.getWirelessRegistrations()
        ]);

        res.json({
            success: true,
            data: {
                interfaces: wirelessInterfaces || [],
                registrations: wirelessRegistrations || []
            }
        });

    } catch (error) {
        console.error('Error getting wireless info:', error);
        res.json({
            success: true,
            data: {
                interfaces: [],
                registrations: []
            }
        });
    }
});

// Get DHCP leases
router.get('/dhcp-leases', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const leases = await mikrotik.getDHCPLeases();

        res.json({
            success: true,
            data: leases
        });

    } catch (error) {
        console.error('Error getting DHCP leases:', error);
        res.status(500).json({
            error: 'Failed to get DHCP leases',
            message: error.message
        });
    }
});

// Get active connections
router.get('/connections', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const connections = await mikrotik.getActiveConnections();

        res.json({
            success: true,
            data: connections
        });

    } catch (error) {
        console.error('Error getting active connections:', error);
        res.json({
            success: true,
            data: []
        });
    }
});

// Get hotspot active connections
router.get('/hotspot-active', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const hotspotActive = await mikrotik.getHotspotActive();

        res.json({
            success: true,
            data: hotspotActive
        });

    } catch (error) {
        console.error('Error getting hotspot active connections:', error);
        res.json({
            success: true,
            data: []
        });
    }
});

// Get firewall rules
router.get('/firewall', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const rules = await mikrotik.getFirewallRules();

        res.json({
            success: true,
            data: rules
        });

    } catch (error) {
        console.error('Error getting firewall rules:', error);
        res.status(500).json({
            error: 'Failed to get firewall rules',
            message: error.message
        });
    }
});

// Get system logs
router.get('/logs', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const limit = parseInt(req.query.limit) || 50;
        const logs = await mikrotik.getSystemLogs(limit);

        res.json({
            success: true,
            data: logs
        });

    } catch (error) {
        console.error('Error getting system logs:', error);
        res.json({
            success: true,
            data: []
        });
    }
});

// Get bandwidth usage
router.get('/bandwidth', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;

        const [ispTraffic, lanTraffic] = await Promise.all([
            mikrotik.getSimpleTrafficRates('ISP-main'),
            mikrotik.getSimpleTrafficRates('main-bridge')
        ]);

        const bandwidthData = [ispTraffic, lanTraffic];

        res.json({
            success: true,
            data: bandwidthData
        });

    } catch (error) {
        console.error('Error getting bandwidth usage:', error);
        res.status(500).json({
            error: 'Failed to get bandwidth usage',
            message: error.message
        });
    }
});

// Get wireless traffic data
router.get('/wireless-traffic', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const wirelessTrafficData = await mikrotik.getWirelessTraffic();

        res.json({
            success: true,
            data: wirelessTrafficData
        });

    } catch (error) {
        console.error('Error getting wireless traffic:', error);
        res.json({
            success: true,
            data: []
        });
    }
});

// Get active users with their data usage
router.get('/active-users', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const activeUsers = await mikrotik.getActiveUsers();

        console.log('Active Users API Response:', activeUsers.length, 'users found');

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

// Get most connected MAC addresses for rewards
router.get('/most-connected-macs', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const mostConnectedMACs = await mikrotik.getMostConnectedMACs();

        console.log('Most Connected MACs API Response:', mostConnectedMACs.length, 'MACs found');

        res.json({
            success: true,
            data: mostConnectedMACs
        });

    } catch (error) {
        console.error('Error getting most connected MACs:', error);
        res.status(500).json({
            error: 'Failed to get most connected MACs',
            message: error.message
        });
    }
});

// Get website monitoring data
router.get('/website-monitoring', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const websiteData = await mikrotik.getWebsiteMonitoring();

        console.log('Website Monitoring API Response:', {
            webVisits: websiteData.webProxyLogs.length,
            connections: websiteData.connectionTracking.length,
            dnsQueries: websiteData.dnsQueries.length,
            uniqueDomains: websiteData.summary.uniqueDomains
        });

        res.json({
            success: true,
            data: websiteData
        });

    } catch (error) {
        console.error('Error getting website monitoring data:', error);
        res.status(500).json({
            error: 'Failed to get website monitoring data',
            message: error.message
        });
    }
});

// Get website activity by user
router.get('/website-activity-by-user', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const userActivity = await mikrotik.getWebsiteActivityByUser();

        console.log('Website Activity by User API Response:', userActivity.length, 'users found');

        res.json({
            success: true,
            data: userActivity
        });

    } catch (error) {
        console.error('Error getting website activity by user:', error);
        res.status(500).json({
            error: 'Failed to get website activity by user',
            message: error.message
        });
    }
});

// Get web proxy logs
router.get('/web-proxy-logs', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const limit = parseInt(req.query.limit) || 100;
        const webProxyLogs = await mikrotik.getWebProxyLogs(limit);

        console.log('Web Proxy Logs API Response:', webProxyLogs.length, 'logs found');

        res.json({
            success: true,
            data: webProxyLogs
        });

    } catch (error) {
        console.error('Error getting web proxy logs:', error);
        res.status(500).json({
            error: 'Failed to get web proxy logs',
            message: error.message
        });
    }
});

// Get connection tracking
router.get('/connection-tracking', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const connectionTracking = await mikrotik.getConnectionTracking();

        console.log('Connection Tracking API Response:', connectionTracking.length, 'connections found');

        res.json({
            success: true,
            data: connectionTracking
        });

    } catch (error) {
        console.error('Error getting connection tracking:', error);
        res.status(500).json({
            error: 'Failed to get connection tracking',
            message: error.message
        });
    }
});

// Get DNS queries
router.get('/dns-queries', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const limit = parseInt(req.query.limit) || 50;
        const dnsQueries = await mikrotik.getDNSQueries(limit);

        console.log('DNS Queries API Response:', dnsQueries.length, 'queries found');

        res.json({
            success: true,
            data: dnsQueries
        });

    } catch (error) {
        console.error('Error getting DNS queries:', error);
        res.status(500).json({
            error: 'Failed to get DNS queries',
            message: error.message
        });
    }
});

// Get web proxy access
router.get('/web-proxy-access', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const webProxyAccess = await mikrotik.getWebProxyAccess();

        console.log('Web Proxy Access API Response:', webProxyAccess.length, 'access records found');

        res.json({
            success: true,
            data: webProxyAccess
        });

    } catch (error) {
        console.error('Error getting web proxy access:', error);
        res.status(500).json({
            error: 'Failed to get web proxy access',
            message: error.message
        });
    }
});

// Monitor specific interface traffic
router.get('/monitor/:interfaceName', getConnection, async (req, res) => {
    try {
        const { interfaceName } = req.params;
        const { mikrotik } = req.connection;

        console.log(`API Request: Monitoring traffic for interface: ${interfaceName}`);

        const trafficData = await mikrotik.monitorInterfaceTraffic(interfaceName);

        res.json({
            success: true,
            data: trafficData
        });

    } catch (error) {
        console.error('Error monitoring interface traffic:', error);
        res.status(500).json({
            error: 'Failed to monitor interface traffic',
            message: error.message
        });
    }
});

// Get simple traffic rates for specific interface
router.get('/simple-traffic-rates/:interfaceName', getConnection, async (req, res) => {
    try {
        const { interfaceName } = req.params;
        const { mikrotik } = req.connection;

        console.log(`API Request: Getting simple traffic rates for interface: ${interfaceName}`);

        const trafficData = await mikrotik.getSimpleTrafficRates(interfaceName);

        res.json({
            success: true,
            data: trafficData
        });

    } catch (error) {
        console.error('Error getting simple traffic rates:', error);
        res.status(500).json({
            error: 'Failed to get simple traffic rates',
            message: error.message
        });
    }
});

// Execute custom command (for advanced users)
router.post('/execute', getConnection, async (req, res) => {
    try {
        const { command, params = [] } = req.body;

        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        // Security: Only allow read-only commands
        const readOnlyCommands = [
            '/system/resource/print',
            '/system/identity/print',
            '/interface/print',
            '/interface/wireless/print',
            '/interface/wireless/registration-table/print',
            '/ip/dhcp-server/lease/print',
            '/ip/firewall/connection/print',
            '/ip/hotspot/active/print',
            '/ip/address/print',
            '/ip/firewall/filter/print',
            '/log/print',
            '/interface/monitor-traffic'
        ];

        if (!readOnlyCommands.some(cmd => command.startsWith(cmd))) {
            return res.status(403).json({
                error: 'Only read-only commands are allowed for security reasons'
            });
        }

        const { mikrotik } = req.connection;
        const result = await mikrotik.executeCommand(command, params);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error executing command:', error);
        res.status(500).json({
            error: 'Failed to execute command',
            message: error.message
        });
    }
});

module.exports = router;
