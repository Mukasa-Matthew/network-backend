const EmailService = require('./email-service');

class HotspotMonitor {
    constructor() {
        this.activeUsers = new Map(); // Track active users by MAC address
        this.emailService = new EmailService();
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.lastCheckTime = null;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 10; // Increased from 5 to 10 for more resilience
    }

    async startMonitoring(mikrotik) {
        console.log('HotspotMonitor.startMonitoring called');
        console.log('isMonitoring:', this.isMonitoring);
        console.log('mikrotik:', !!mikrotik);

        if (this.isMonitoring) {
            console.log('Hotspot monitoring is already running');
            return;
        }

        this.isMonitoring = true;
        console.log('Starting hotspot monitoring...');
        this.consecutiveErrors = 0; // Reset error counter

        try {
            // Initial scan to populate current users
            await this.scanActiveUsers(mikrotik);

            // Start periodic monitoring
            this.monitoringInterval = setInterval(async () => {
                if (this.isMonitoring) {
                    await this.scanActiveUsers(mikrotik);
                }
            }, 10000); // Check every 10 seconds

            console.log('Hotspot monitoring started successfully');
        } catch (error) {
            console.error('Error in startMonitoring:', error);
            this.isMonitoring = false;
            throw error;
        }
    }

    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        console.log('Hotspot monitoring stopped');
    }

    async scanActiveUsers(mikrotik) {
        try {
            console.log('Scanning active users...');

            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Scan timeout')), 30000); // 30 second timeout
            });

            const scanPromise = mikrotik.getHotspotActive();
            const currentUsers = await Promise.race([scanPromise, timeoutPromise]);

            console.log('Current users found:', currentUsers.length);
            const currentTime = new Date();

            // Create a map of current users by MAC address
            const currentUserMap = new Map();

            for (const user of currentUsers) {
                const macAddress = user['mac-address'] || user.macAddress;
                if (macAddress) {
                    currentUserMap.set(macAddress, {
                        ...user,
                        lastSeen: currentTime
                    });
                }
            }

            console.log('Current user map size:', currentUserMap.size);
            console.log('Previous active users size:', this.activeUsers.size);

            // Check for new connections
            for (const [macAddress, userData] of currentUserMap) {
                if (!this.activeUsers.has(macAddress)) {
                    // New user connected
                    console.log('New user detected:', userData.user || 'Unknown');
                    try {
                        await this.handleUserConnected(userData, macAddress, currentUserMap.size);
                    } catch (error) {
                        console.error('Error handling user connection:', error);
                    }
                } else {
                    // User still active, update last seen
                    const existingUser = this.activeUsers.get(macAddress);
                    existingUser.lastSeen = currentTime;
                }
            }

            // Check for disconnections
            for (const [macAddress, userData] of this.activeUsers) {
                if (!currentUserMap.has(macAddress)) {
                    // User disconnected
                    console.log('User disconnected:', userData.user || 'Unknown');
                    try {
                        await this.handleUserDisconnected(userData, macAddress, currentUserMap.size);
                    } catch (error) {
                        console.error('Error handling user disconnection:', error);
                    }
                }
            }

            // Update active users map
            this.activeUsers = currentUserMap;
            this.lastCheckTime = currentTime;

        } catch (error) {
            console.error('Error scanning active users:', error);

            // Track consecutive errors but be more lenient
            this.consecutiveErrors++;

            if (error.message === 'Scan timeout') {
                console.error('Scan timed out - router may be unresponsive, will retry...');
            }

            // Only stop monitoring after many more consecutive errors
            if (this.consecutiveErrors >= this.maxConsecutiveErrors * 2) {
                console.error(`Too many consecutive errors (${this.consecutiveErrors}), stopping monitoring`);
                this.stopMonitoring();
                return;
            }

            // Continue monitoring even with errors - just log them
            console.log(`Monitoring continues despite error (${this.consecutiveErrors}/${this.maxConsecutiveErrors * 2})`);
        }

        // Reset error counter on successful scan
        this.consecutiveErrors = 0;
    }

    async handleUserConnected(userData, macAddress, totalActiveUsers) {
        console.log(`New user connected: ${userData.user || 'Unknown'} (${macAddress})`);

        const notificationData = {
            hostName: userData.user || 'Unknown',
            macAddress: macAddress,
            ipAddress: userData.address || 'N/A',
            connectionType: 'Hotspot',
            signalStrength: userData['signal-strength'] || 'N/A',
            sessionId: userData['.id'] || 'N/A',
            loginBy: userData['login-by'] || 'N/A',
            idleTimeout: userData['idle-timeout'] || 'N/A',
            sessionStart: new Date().toLocaleString(),
            uptime: userData.uptime || 'N/A',
            bytesIn: userData['bytes-in'] || '0',
            bytesOut: userData['bytes-out'] || '0',
            totalUsersRemaining: totalActiveUsers // Use the actual current total
        };

        try {
            const emailSent = await this.emailService.sendEmail(
                process.env.ADMIN_EMAIL,
                `🔗 New User Connected (${notificationData.totalUsersRemaining} users active)`,
                this.emailService.createSimpleConnectionEmail(notificationData)
            );

            if (emailSent) {
                console.log(`Email notification sent for new user: ${userData.user} (${notificationData.totalUsersRemaining} users active)`);
            } else {
                console.log(`Email notification failed for new user: ${userData.user} - check email configuration`);
            }

            return emailSent;
        } catch (error) {
            console.error('Error sending connection notification email:', error);
            return false;
        }
    }

    async handleUserDisconnected(userData, macAddress, totalActiveUsers) {
        console.log(`User disconnected: ${userData.user || 'Unknown'} (${macAddress})`);

        // Determine if user was kicked out or disconnected normally
        const wasKicked = this.detectIfUserWasKicked(userData);

        const notificationData = {
            hostName: userData.user || 'Unknown',
            macAddress: macAddress,
            ipAddress: userData.address || 'N/A',
            connectionType: 'Hotspot',
            sessionId: userData['.id'] || 'N/A',
            sessionStart: userData.sessionStart || 'N/A',
            sessionEnd: new Date().toLocaleString(),
            totalUptime: userData.uptime || 'N/A',
            dataDownloaded: this.formatBytes(userData['bytes-in'] || 0),
            dataUploaded: this.formatBytes(userData['bytes-out'] || 0),
            totalDataUsed: this.formatBytes((parseInt(userData['bytes-in'] || 0) + parseInt(userData['bytes-out'] || 0))),
            totalUsersRemaining: totalActiveUsers, // Use the actual current total
            kickReason: wasKicked ? this.getKickReason(userData) : null
        };

        try {
            let emailSent;
            if (wasKicked) {
                // Send kicked out email
                emailSent = await this.emailService.sendEmail(
                    process.env.ADMIN_EMAIL,
                    `🚫 User Kicked Out (${notificationData.totalUsersRemaining} users remaining)`,
                    this.emailService.createUserKickedEmail(notificationData)
                );
                console.log(`Kick notification sent for user: ${userData.user} - ${notificationData.kickReason}`);
            } else {
                // Send normal disconnection email
                emailSent = await this.emailService.sendEmail(
                    process.env.ADMIN_EMAIL,
                    `🔌 User Disconnected (${notificationData.totalUsersRemaining} users remaining)`,
                    this.emailService.createSimpleDisconnectionEmail(notificationData)
                );
                console.log(`Disconnection notification sent for user: ${userData.user}`);
            }

            if (emailSent) {
                console.log(`Email notification sent for ${wasKicked ? 'kicked' : 'disconnected'} user: ${userData.user} (${notificationData.totalUsersRemaining} users remaining)`);
            } else {
                console.log(`Email notification failed for ${wasKicked ? 'kicked' : 'disconnected'} user: ${userData.user} - check email configuration`);
            }
        } catch (error) {
            console.error('Error sending disconnection notification email:', error);
        }
    }

    detectIfUserWasKicked(userData) {
        // Check for common kick indicators
        const kickIndicators = [
            'timeout',
            'expired',
            'kicked',
            'removed',
            'forced',
            'idle'
        ];

        const uptime = userData.uptime || '';
        const sessionInfo = JSON.stringify(userData).toLowerCase();

        // Check if uptime suggests a timeout (e.g., "5m 30s" when idle timeout is set)
        const hasTimeoutIndicator = kickIndicators.some(indicator =>
            sessionInfo.includes(indicator)
        );

        // Check if session was relatively short (potential timeout)
        const uptimeMinutes = this.parseUptimeToMinutes(uptime);
        const shortSession = uptimeMinutes > 0 && uptimeMinutes < 30; // Less than 30 minutes

        return hasTimeoutIndicator || shortSession;
    }

    getKickReason(userData) {
        const sessionInfo = JSON.stringify(userData).toLowerCase();

        if (sessionInfo.includes('timeout') || sessionInfo.includes('idle')) {
            return 'idle timeout';
        } else if (sessionInfo.includes('expired')) {
            return 'session expired';
        } else if (sessionInfo.includes('kicked') || sessionInfo.includes('removed')) {
            return 'manual removal';
        } else if (sessionInfo.includes('forced')) {
            return 'forced disconnect';
        } else {
            return 'session timeout';
        }
    }

    parseUptimeToMinutes(uptime) {
        if (!uptime || uptime === 'N/A') return 0;

        const timeRegex = /(\d+)w\s*(\d+)d\s*(\d+)h\s*(\d+)m\s*(\d+)s/;
        const match = uptime.match(timeRegex);

        if (match) {
            const weeks = parseInt(match[1]) || 0;
            const days = parseInt(match[2]) || 0;
            const hours = parseInt(match[3]) || 0;
            const minutes = parseInt(match[4]) || 0;
            const seconds = parseInt(match[5]) || 0;

            return (weeks * 7 * 24 * 60) + (days * 24 * 60) + (hours * 60) + minutes + (seconds / 60);
        }

        // Try simpler format like "5m 30s"
        const simpleMatch = uptime.match(/(\d+)m\s*(\d+)s/);
        if (simpleMatch) {
            const minutes = parseInt(simpleMatch[1]) || 0;
            const seconds = parseInt(simpleMatch[2]) || 0;
            return minutes + (seconds / 60);
        }

        return 0;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getMonitoringStatus() {
        return {
            isActive: this.isMonitoring,
            activeUsers: this.activeUsers.size,
            lastCheckTime: this.lastCheckTime,
            monitoringInterval: '10 seconds'
        };
    }

    getActiveUsers() {
        return Array.from(this.activeUsers.values());
    }

    // Method to manually trigger a scan
    async manualScan(mikrotik) {
        await this.scanActiveUsers(mikrotik);
    }

    // Method to restart monitoring if it was stopped unexpectedly
    async restartMonitoring(mikrotik) {
        if (!this.isMonitoring) {
            console.log('Restarting hotspot monitoring...');
            await this.startMonitoring(mikrotik);
        }
    }
}

module.exports = HotspotMonitor;
