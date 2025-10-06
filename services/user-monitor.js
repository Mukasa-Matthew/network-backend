const EmailService = require('./email-service');

class UserMonitor {
    constructor() {
        this.emailService = new EmailService();
        this.knownUsers = new Map(); // Track known users by MAC address
        this.userSessions = new Map(); // Track active sessions
        this.disconnectedUsers = new Map(); // Track recently disconnected users
        this.monitoringInterval = null;
        this.isMonitoring = false;
    }

    // Start monitoring user connections
    startMonitoring(mikrotikConnection) {
        if (this.isMonitoring) {
            console.log('User monitoring is already active');
            return;
        }

        this.isMonitoring = true;
        console.log('Starting user connection monitoring...');

        // Monitor every 30 seconds
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.checkUserConnections(mikrotikConnection);
            } catch (error) {
                console.error('Error in user monitoring:', error);
            }
        }, 30000); // Check every 30 seconds
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        console.log('User monitoring stopped');
    }

    // Check user connections and detect changes
    async checkUserConnections(mikrotikConnection) {
        try {
            // Get current active users
            const currentUsers = await mikrotikConnection.getActiveUsers();
            const currentUserMap = new Map();

            // Process current users
            for (const user of currentUsers) {
                const macAddress = user.macAddress;
                if (!macAddress || macAddress === 'N/A') continue;

                currentUserMap.set(macAddress, user);

                // Check if this is a new user
                if (!this.knownUsers.has(macAddress)) {
                    await this.handleNewUser(user);
                } else {
                    // Check if user was previously disconnected and now reconnected
                    if (this.disconnectedUsers.has(macAddress)) {
                        await this.handleUserReconnection(user);
                        this.disconnectedUsers.delete(macAddress);
                    }
                }

                // Update session info
                this.userSessions.set(macAddress, {
                    ...user,
                    lastSeen: new Date(),
                    sessionStart: this.userSessions.get(macAddress)?.sessionStart || new Date()
                });
            }

            // Check for disconnected users
            for (const [macAddress, user] of this.userSessions) {
                if (!currentUserMap.has(macAddress)) {
                    await this.handleUserDisconnection(user);
                }
            }

            // Update known users
            this.knownUsers = currentUserMap;

        } catch (error) {
            console.error('Error checking user connections:', error);
        }
    }

    // Handle new user login
    async handleNewUser(user) {
        console.log(`New user detected: ${user.hostName || user.macAddress}`);

        // Add to known users
        this.knownUsers.set(user.macAddress, user);

        // Initialize session
        this.userSessions.set(user.macAddress, {
            ...user,
            sessionStart: new Date(),
            lastSeen: new Date()
        });

        // Send email notification
        const notificationData = {
            hostName: user.hostName || 'Unknown',
            macAddress: user.macAddress,
            ipAddress: user.address,
            connectionType: user.connectionType || 'Unknown',
            signalStrength: user.signalStrength,
            sessionId: user.sessionId,
            loginBy: user.loginBy,
            idleTimeout: user.idleTimeout,
            loginTime: new Date().toLocaleString()
        };

        await this.emailService.notifyNewUserLogin(notificationData);
    }

    // Handle user disconnection
    async handleUserDisconnection(user) {
        console.log(`User disconnected: ${user.hostName || user.macAddress}`);

        const session = this.userSessions.get(user.macAddress);
        if (!session) return;

        // Calculate session duration
        const sessionStart = session.sessionStart;
        const sessionEnd = new Date();
        const sessionDuration = sessionEnd - sessionStart;

        // Check if disconnection is due to time expiration
        const isTimeExpired = this.checkTimeExpiration(user);

        // Add to disconnected users for potential reconnection detection
        this.disconnectedUsers.set(user.macAddress, {
            ...user,
            disconnectTime: new Date(),
            sessionDuration: sessionDuration
        });

        // Remove from active sessions
        this.userSessions.delete(user.macAddress);

        // Prepare notification data
        const notificationData = {
            hostName: user.hostName || 'Unknown',
            macAddress: user.macAddress,
            ipAddress: user.address,
            connectionType: user.connectionType || 'Unknown',
            totalUptime: this.formatDuration(sessionDuration),
            dataDownloaded: this.formatBytes(user.bytesIn || 0),
            dataUploaded: this.formatBytes(user.bytesOut || 0),
            totalDataUsed: this.formatBytes((user.bytesIn || 0) + (user.bytesOut || 0)),
            sessionStart: sessionStart.toLocaleString(),
            sessionEnd: sessionEnd.toLocaleString()
        };

        // Send appropriate notification
        if (isTimeExpired) {
            await this.emailService.notifyUserTimeExpired(notificationData);
        } else {
            await this.emailService.notifyUserDisconnected(notificationData);
        }
    }

    // Handle user reconnection
    async handleUserReconnection(user) {
        console.log(`User reconnected: ${user.hostName || user.macAddress}`);

        const disconnectedUser = this.disconnectedUsers.get(user.macAddress);
        if (!disconnectedUser) return;

        const disconnectTime = disconnectedUser.disconnectTime;
        const reconnectTime = new Date();
        const timeOffline = reconnectTime - disconnectTime;

        // Calculate remaining time if applicable
        const remainingTime = this.calculateRemainingTime(user);

        const notificationData = {
            hostName: user.hostName || 'Unknown',
            macAddress: user.macAddress,
            ipAddress: user.address,
            connectionType: user.connectionType || 'Unknown',
            signalStrength: user.signalStrength,
            previousDisconnect: disconnectTime.toLocaleString(),
            reconnectionTime: reconnectTime.toLocaleString(),
            timeOffline: this.formatDuration(timeOffline),
            remainingTime: remainingTime
        };

        await this.emailService.notifyUserReconnected(notificationData);
    }

    // Check if user disconnection is due to time expiration
    checkTimeExpiration(user) {
        // This is a simplified check - you might want to implement more sophisticated logic
        // based on your MikroTik hotspot configuration

        // Check if user has time limits and if they've been exceeded
        const limitBytesTotal = user.limitBytesTotal;
        const limitBytesIn = user.limitBytesIn;
        const limitBytesOut = user.limitBytesOut;

        if (limitBytesTotal || limitBytesIn || limitBytesOut) {
            const totalUsed = (user.bytesIn || 0) + (user.bytesOut || 0);
            const totalLimit = limitBytesTotal || ((limitBytesIn || 0) + (limitBytesOut || 0));

            if (totalUsed >= totalLimit) {
                return true;
            }
        }

        // Check for session time limits (if implemented)
        // You can add more sophisticated time expiration logic here

        return false;
    }

    // Calculate remaining time for user
    calculateRemainingTime(user) {
        // This is a simplified calculation - adjust based on your hotspot configuration
        const limitBytesTotal = user.limitBytesTotal;
        const limitBytesIn = user.limitBytesIn;
        const limitBytesOut = user.limitBytesOut;

        if (limitBytesTotal || limitBytesIn || limitBytesOut) {
            const totalUsed = (user.bytesIn || 0) + (user.bytesOut || 0);
            const totalLimit = limitBytesTotal || ((limitBytesIn || 0) + (limitBytesOut || 0));
            const remaining = Math.max(0, totalLimit - totalUsed);

            return this.formatBytes(remaining);
        }

        return 'Unlimited';
    }

    // Format duration in milliseconds to human readable format
    formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Format bytes to human readable format
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get current monitoring status
    getMonitoringStatus() {
        return {
            isActive: this.isMonitoring,
            knownUsers: this.knownUsers.size,
            activeSessions: this.userSessions.size,
            disconnectedUsers: this.disconnectedUsers.size
        };
    }

    // Get user statistics
    getUserStatistics() {
        const stats = {
            totalKnownUsers: this.knownUsers.size,
            activeUsers: this.userSessions.size,
            recentlyDisconnected: this.disconnectedUsers.size,
            userDetails: []
        };

        // Add active user details
        for (const [macAddress, session] of this.userSessions) {
            stats.userDetails.push({
                macAddress,
                hostName: session.hostName || 'Unknown',
                ipAddress: session.address,
                connectionType: session.connectionType,
                sessionStart: session.sessionStart,
                lastSeen: session.lastSeen,
                status: 'Active'
            });
        }

        // Add recently disconnected user details
        for (const [macAddress, user] of this.disconnectedUsers) {
            stats.userDetails.push({
                macAddress,
                hostName: user.hostName || 'Unknown',
                ipAddress: user.address,
                connectionType: user.connectionType,
                disconnectTime: user.disconnectTime,
                sessionDuration: user.sessionDuration,
                status: 'Disconnected'
            });
        }

        return stats;
    }

    // Clear old disconnected users (cleanup)
    cleanupOldDisconnectedUsers() {
        const cutoffTime = new Date(Date.now() - (24 * 60 * 60 * 1000)); // 24 hours ago

        for (const [macAddress, user] of this.disconnectedUsers) {
            if (user.disconnectTime < cutoffTime) {
                this.disconnectedUsers.delete(macAddress);
            }
        }
    }
}

module.exports = UserMonitor;







