const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const appConfig = require('../config/config');

// Function to parse MikroTik uptime format (e.g., "22h58m13s")
const parseUptime = (uptimeStr) => {
    if (!uptimeStr || typeof uptimeStr !== 'string') return 0;

    const match = uptimeStr.match(/(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    if (!match) return 0;

    const days = parseInt(match[1]) || 0;
    const hours = parseInt(match[2]) || 0;
    const minutes = parseInt(match[3]) || 0;
    const seconds = parseInt(match[4]) || 0;

    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
};

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

// Get real-time monitoring data
router.get('/realtime', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const realTimeData = await mikrotik.getRealTimeData();

        // Debug: Log the real-time data
        console.log('Real-time Data:', realTimeData);

        res.json({
            success: true,
            data: realTimeData
        });

    } catch (error) {
        console.error('Error getting real-time data:', error);
        res.status(500).json({
            error: 'Failed to get real-time data',
            message: error.message
        });
    }
});

// Start real-time monitoring for a specific interface
router.post('/start-monitoring/:interfaceName', getConnection, async (req, res) => {
    try {
        const { interfaceName } = req.params;
        const { mikrotik } = req.connection;
        const { io } = require('../server');

        // Validate interface name
        const interfaces = await mikrotik.getInterfaceStats();
        const interfaceExists = interfaces.some(iface => iface.name === interfaceName);

        if (!interfaceExists) {
            return res.status(404).json({ error: 'Interface not found' });
        }

        // Set up monitoring callback
        const monitoringCallback = (data) => {
            io.to(`router-${req.connectionId}`).emit('interface-traffic', {
                interface: interfaceName,
                data: data,
                timestamp: new Date().toISOString()
            });
        };

        // Start monitoring
        await mikrotik.monitorInterfaceTraffic(interfaceName, monitoringCallback);

        res.json({
            success: true,
            message: `Started monitoring interface: ${interfaceName}`,
            data: {
                interface: interfaceName,
                connectionId: req.connectionId
            }
        });

    } catch (error) {
        console.error('Error starting monitoring:', error);
        res.status(500).json({
            error: 'Failed to start monitoring',
            message: error.message
        });
    }
});

// Get system performance metrics
router.get('/performance', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;

        const [systemResource, bandwidthData, routerOSVersion] = await Promise.all([
            mikrotik.getSystemResource(),
            mikrotik.getBandwidthUsage(),
            mikrotik.getRouterOSVersion()
        ]);

        // Debug: Log the system resource data
        console.log('System Resource Data:', systemResource);

        // Calculate performance metrics
        const performanceData = {
            timestamp: new Date().toISOString(),
            // For Performance page compatibility
            cpuLoad: parseInt(systemResource['cpu-load']) || 0,
            cpuCount: parseInt(systemResource['cpu-count']) || 1,
            memoryUsage: parseInt(systemResource['total-memory']) > 0 ?
                Math.round(((parseInt(systemResource['total-memory']) - parseInt(systemResource['free-memory'])) / parseInt(systemResource['total-memory'])) * 100) : 0,
            memoryTotal: parseInt(systemResource['total-memory']) || 0,
            memoryFree: parseInt(systemResource['free-memory']) || 0,
            memoryUsed: (parseInt(systemResource['total-memory']) || 0) - (parseInt(systemResource['free-memory']) || 0),
            uptime: systemResource.uptime || '0s',
            uptimeFormatted: systemResource.uptime || '0s',
            bandwidth: bandwidthData,
            interfaces: bandwidthData.interfaces?.length || 0,
            activeInterfaces: bandwidthData.interfaces?.filter(iface => iface.rxRate > 0 || iface.txRate > 0).length || 0,
            systemStatus: 'Online',
            // For RouterInfo page compatibility
            cpu: {
                load: parseInt(systemResource['cpu-load']) || 0,
                count: parseInt(systemResource['cpu-count']) || 1
            },
            memory: {
                usagePercentage: parseInt(systemResource['total-memory']) > 0 ?
                    Math.round(((parseInt(systemResource['total-memory']) - parseInt(systemResource['free-memory'])) / parseInt(systemResource['total-memory'])) * 100) : 0,
                total: parseInt(systemResource['total-memory']) || 0,
                free: parseInt(systemResource['free-memory']) || 0,
                used: (parseInt(systemResource['total-memory']) || 0) - (parseInt(systemResource['free-memory']) || 0)
            },
            system: {
                version: routerOSVersion,
                uptime: systemResource.uptime || '0s'
            }
        };

        res.json({
            success: true,
            data: performanceData
        });

    } catch (error) {
        console.error('Error getting performance data:', error);
        res.status(500).json({
            error: 'Failed to get performance data',
            message: error.message
        });
    }
});

// Get network statistics
router.get('/network-stats', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;

        const [interfaces, connections, dhcpLeases] = await Promise.all([
            mikrotik.getInterfaceStats(),
            mikrotik.getActiveConnections(),
            mikrotik.getDHCPLeases()
        ]);

        const networkStats = {
            timestamp: new Date().toISOString(),
            interfaces: {
                total: interfaces.length,
                active: interfaces.filter(iface => iface.running).length,
                data: interfaces
            },
            connections: {
                total: connections.length,
                data: connections
            },
            dhcp: {
                total: dhcpLeases.length,
                active: dhcpLeases.filter(lease => lease.status === 'bound').length,
                data: dhcpLeases
            }
        };

        res.json({
            success: true,
            data: networkStats
        });

    } catch (error) {
        console.error('Error getting network stats:', error);
        res.status(500).json({
            error: 'Failed to get network statistics',
            message: error.message
        });
    }
});

// Get wireless statistics
router.get('/wireless-stats', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;

        const [wirelessInterfaces, wirelessRegistrations] = await Promise.all([
            mikrotik.getWirelessInterfaces(),
            mikrotik.getWirelessRegistrations()
        ]);

        const wirelessStats = {
            timestamp: new Date().toISOString(),
            interfaces: {
                total: wirelessInterfaces.length,
                data: wirelessInterfaces
            },
            clients: {
                total: wirelessRegistrations.length,
                data: wirelessRegistrations
            }
        };

        res.json({
            success: true,
            data: wirelessStats
        });

    } catch (error) {
        console.error('Error getting wireless stats:', error);
        res.status(500).json({
            error: 'Failed to get wireless statistics',
            message: error.message
        });
    }
});

// Get wireless clients count
router.get('/wireless-clients', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;
        const wirelessTraffic = await mikrotik.getWirelessTraffic();

        const totalClients = wirelessTraffic.reduce((total, iface) => total + (iface.connectedClients || 0), 0);

        res.json({
            success: true,
            data: {
                totalClients,
                interfaces: wirelessTraffic
            }
        });

    } catch (error) {
        console.error('Error getting wireless clients count:', error);
        res.status(500).json({
            error: 'Failed to get wireless clients count',
            message: error.message
        });
    }
});

// Get system health status
router.get('/health', getConnection, async (req, res) => {
    try {
        const { mikrotik } = req.connection;

        const systemResource = await mikrotik.getSystemResource();

        // Debug: Log the system resource data
        console.log('Health System Resource Data:', systemResource);

        // Calculate health metrics
        const cpuLoad = parseInt(systemResource['cpu-load']) || 0;
        const totalMemory = parseInt(systemResource['total-memory']) || 0;
        const freeMemory = parseInt(systemResource['free-memory']) || 0;
        const usedMemory = totalMemory - freeMemory;
        const memoryUsage = totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0;

        const healthStatus = {
            timestamp: new Date().toISOString(),
            overall: 'healthy',
            overallStatus: 'healthy', // For frontend compatibility
            metrics: {
                cpu: {
                    load: cpuLoad,
                    status: cpuLoad < 80 ? 'healthy' : cpuLoad < 95 ? 'warning' : 'critical',
                    message: `CPU load is ${cpuLoad}%`
                },
                memory: {
                    usage: Math.round(memoryUsage),
                    status: memoryUsage < 80 ? 'healthy' : memoryUsage < 95 ? 'warning' : 'critical',
                    message: `Memory usage is ${Math.round(memoryUsage)}%`
                },
                uptime: {
                    value: parseUptime(systemResource.uptime),
                    status: 'healthy',
                    message: `System uptime: ${systemResource.uptime || '0s'}`
                }
            }
        };

        // Determine overall status
        const criticalMetrics = Object.values(healthStatus.metrics).filter(m => m.status === 'critical');
        const warningMetrics = Object.values(healthStatus.metrics).filter(m => m.status === 'warning');

        if (criticalMetrics.length > 0) {
            healthStatus.overall = 'critical';
            healthStatus.overallStatus = 'critical';
        } else if (warningMetrics.length > 0) {
            healthStatus.overall = 'warning';
            healthStatus.overallStatus = 'warning';
        }

        res.json({
            success: true,
            data: healthStatus
        });

    } catch (error) {
        console.error('Error getting health status:', error);
        res.status(500).json({
            error: 'Failed to get health status',
            message: error.message
        });
    }
});

// Get monitoring configuration
router.get('/config', getConnection, async (req, res) => {
    try {
        const config = {
            updateInterval: 5000, // 5 seconds
            maxDataPoints: 100,
            enabledMetrics: [
                'cpu',
                'memory',
                'bandwidth',
                'interfaces',
                'wireless',
                'connections'
            ],
            expectedSpeedMbps: appConfig.monitoring.expectedSpeedMbps,
            alerts: {
                cpuThreshold: 80,
                memoryThreshold: 80,
                bandwidthThreshold: 90
            }
        };

        res.json({
            success: true,
            data: config
        });

    } catch (error) {
        console.error('Error getting monitoring config:', error);
        res.status(500).json({
            error: 'Failed to get monitoring configuration',
            message: error.message
        });
    }
});

module.exports = router;
