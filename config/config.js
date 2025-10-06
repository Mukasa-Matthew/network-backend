require('dotenv').config();

const config = {
    // Server configuration
    server: {
        port: process.env.PORT || 5000,
        host: process.env.HOST || 'localhost',
        environment: process.env.NODE_ENV || 'development'
    },

    // Security configuration
    security: {
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
        corsOrigin: process.env.FRONTEND_URL || 'http://localhost:3000'
    },

    // MikroTik configuration
    mikrotik: {
        defaultPort: 8728,
        timeout: 10000,
        keepalive: true,
        maxConnections: 10
    },

    // Monitoring configuration
    monitoring: {
        updateInterval: parseInt(process.env.MONITORING_INTERVAL) || 5000, // 5 seconds
        maxDataPoints: parseInt(process.env.MAX_DATA_POINTS) || 100,
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 3600000, // 1 hour
        cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 300000, // 5 minutes
        expectedSpeedMbps: parseInt(process.env.EXPECTED_SPEED_MBPS) || 100
    },

    // Rate limiting
    rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },

    // Logging
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        enableConsole: process.env.LOG_CONSOLE !== 'false',
        enableFile: process.env.LOG_FILE === 'true'
    },

    // Database (if needed in future)
    database: {
        url: process.env.DATABASE_URL,
        type: process.env.DATABASE_TYPE || 'postgresql'
    }
};

// Validation function
const validateConfig = () => {
    const required = ['security.jwtSecret'];
    const missing = [];

    required.forEach(path => {
        const keys = path.split('.');
        let value = config;
        for (const key of keys) {
            value = value[key];
        }
        if (!value) {
            missing.push(path);
        }
    });

    if (missing.length > 0) {
        throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
};

// Validate configuration on load
validateConfig();

module.exports = config;







