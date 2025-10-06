const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const { activeConnections } = require('./routes/auth');
const routerRoutes = require('./routes/router');
const monitoringRoutes = require('./routes/monitoring');
const userMonitoringRoutes = require('./routes/user-monitoring');
const hotspotMonitoringRoutes = require('./routes/hotspot-monitoring');
const notificationRoutes = require('./routes/notifications');
const websiteMonitoringRoutes = require('./routes/website-monitoring');
const UserMonitor = require('./services/user-monitor');
const NotificationService = require('./services/notification-service');
const HotspotMonitor = require('./services/hotspot-monitor');

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // limit each IP to 1000 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize services
const userMonitor = new UserMonitor();
const notificationService = new NotificationService();
const hotspotMonitor = new HotspotMonitor();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/router', routerRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/user-monitoring', userMonitoringRoutes);
app.use('/api/hotspot-monitoring', hotspotMonitoringRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/website-monitoring', websiteMonitoringRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-monitoring', (routerId) => {
        try {
            socket.join(`router-${routerId}`);
            console.log(`Client ${socket.id} joined monitoring for router ${routerId}`);
        } catch (error) {
            console.error('Error joining monitoring room:', error);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, 'Reason:', reason);
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        // Don't let socket errors crash the server
    });

    // Handle socket close events
    socket.on('close', (hadError) => {
        console.log('Socket closed:', socket.id, 'Had error:', hadError);
    });
});

// Handle Socket.IO server errors
io.engine.on('connection_error', (err) => {
    console.error('Socket.IO connection error:', err);
});

// Handle server errors gracefully
server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error('Port is already in use. Please try a different port.');
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Log the error but don't crash the server
    if (error.message && error.message.includes('this.socket.destroy is not a function')) {
        console.error('Socket destroy error detected - this is a known Node.js issue, continuing...');
        return; // Don't log the full stack trace for this known issue
    }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Log the error but don't crash the server
    if (reason && reason.message && reason.message.includes('destroy')) {
        console.error('Socket destroy error detected in promise rejection - this is a known Node.js issue, continuing...');
        return; // Don't log the full stack trace for this known issue
    }
});

// Handle SIGTERM and SIGINT gracefully
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await gracefulShutdown();
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await gracefulShutdown();
});

async function gracefulShutdown() {
    try {
        console.log('Stopping hotspot monitoring...');
        hotspotMonitor.stopMonitoring();

        console.log('Stopping user monitoring...');
        userMonitor.stopMonitoring();

        console.log('Closing Socket.IO server...');
        io.close();

        console.log('Closing HTTP server...');
        server.close(() => {
            console.log('HTTP server closed');
            process.exit(0);
        });

        // Force exit after 10 seconds if graceful shutdown fails
        setTimeout(() => {
            console.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);

    } catch (error) {
        console.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Make io and services available to other modules
module.exports = { app, io, userMonitor, notificationService, hotspotMonitor };
