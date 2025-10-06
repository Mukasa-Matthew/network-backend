const EmailService = require('./email-service');
const EventEmitter = require('events');

class NotificationService extends EventEmitter {
    constructor() {
        super();
        this.emailService = new EmailService();
        this.monitoringInterval = null;
        this.isMonitoring = false;
        this.lastSystemLogs = new Set();
        this.lastActiveUsers = new Map();
        this.lastWirelessRegistrations = new Map();
        this.alertHistory = [];
        this.maxHistorySize = 100;

        // Alert types and their configurations
        this.alertTypes = {
            USER_CONNECTED: {
                name: 'User Connected',
                icon: '🔗',
                color: 'success',
                emailSubject: '🆕 New User Connected',
                priority: 'high'
            },
            USER_DISCONNECTED: {
                name: 'User Disconnected',
                icon: '🔌',
                color: 'warning',
                emailSubject: '🔌 User Disconnected',
                priority: 'medium'
            },
            USER_RECONNECTED: {
                name: 'User Reconnected',
                icon: '🔄',
                color: 'info',
                emailSubject: '🔄 User Reconnected',
                priority: 'medium'
            },
            USER_TIME_EXPIRED: {
                name: 'User Time Expired',
                icon: '⏰',
                color: 'error',
                emailSubject: '⏰ User Time Expired',
                priority: 'high'
            },
            SYSTEM_WARNING: {
                name: 'System Warning',
                icon: '⚠️',
                color: 'warning',
                emailSubject: '⚠️ System Warning',
                priority: 'high'
            },
            SYSTEM_ERROR: {
                name: 'System Error',
                icon: '🚨',
                color: 'error',
                emailSubject: '🚨 System Error',
                priority: 'critical'
            },
            WIRELESS_CLIENT_CONNECTED: {
                name: 'Wireless Client Connected',
                icon: '📶',
                color: 'success',
                emailSubject: '📶 Wireless Client Connected',
                priority: 'medium'
            },
            WIRELESS_CLIENT_DISCONNECTED: {
                name: 'Wireless Client Disconnected',
                icon: '📶',
                color: 'warning',
                emailSubject: '📶 Wireless Client Disconnected',
                priority: 'medium'
            },
            INTERFACE_DOWN: {
                name: 'Interface Down',
                icon: '🔴',
                color: 'error',
                emailSubject: '🔴 Interface Down',
                priority: 'critical'
            },
            INTERFACE_UP: {
                name: 'Interface Up',
                icon: '🟢',
                color: 'success',
                emailSubject: '🟢 Interface Up',
                priority: 'medium'
            }
        };
    }

    // Start monitoring MikroTik events
    startMonitoring(mikrotikConnection) {
        if (this.isMonitoring) {
            console.log('Notification monitoring is already active');
            return;
        }

        this.isMonitoring = true;
        console.log('🚨 Starting real-time notification monitoring...');

        // Monitor every 15 seconds for faster response
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.checkForEvents(mikrotikConnection);
            } catch (error) {
                console.error('Error in notification monitoring:', error);
            }
        }, 15000); // Check every 15 seconds
    }

    // Stop monitoring
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        console.log('🚨 Notification monitoring stopped');
    }

    // Check for various events
    async checkForEvents(mikrotikConnection) {
        try {
            // Check multiple event sources in parallel
            await Promise.all([
                this.checkUserConnections(mikrotikConnection),
                this.checkSystemLogs(mikrotikConnection),
                this.checkWirelessEvents(mikrotikConnection),
                this.checkInterfaceStatus(mikrotikConnection)
            ]);
        } catch (error) {
            console.error('Error checking for events:', error);
        }
    }

    // Check user connection events
    async checkUserConnections(mikrotikConnection) {
        try {
            const currentUsers = await mikrotikConnection.getActiveUsers();
            const currentUserMap = new Map();

            // Process current users
            for (const user of currentUsers) {
                const macAddress = user.macAddress;
                if (!macAddress || macAddress === 'N/A') continue;

                currentUserMap.set(macAddress, user);

                // Check if this is a new user
                if (!this.lastActiveUsers.has(macAddress)) {
                    await this.createAlert('USER_CONNECTED', {
                        title: 'New User Connected',
                        message: `${user.hostName || 'Unknown'} (${macAddress}) has connected`,
                        details: {
                            hostName: user.hostName || 'Unknown',
                            macAddress: macAddress,
                            ipAddress: user.address || 'N/A',
                            connectionType: user.connectionType || 'Unknown',
                            signalStrength: user.signalStrength || 'N/A',
                            sessionId: user.sessionId || 'N/A'
                        },
                        timestamp: new Date()
                    });
                }
            }

            // Check for disconnected users
            for (const [macAddress, user] of this.lastActiveUsers) {
                if (!currentUserMap.has(macAddress)) {
                    await this.createAlert('USER_DISCONNECTED', {
                        title: 'User Disconnected',
                        message: `${user.hostName || 'Unknown'} (${macAddress}) has disconnected`,
                        details: {
                            hostName: user.hostName || 'Unknown',
                            macAddress: macAddress,
                            ipAddress: user.address || 'N/A',
                            connectionType: user.connectionType || 'Unknown',
                            uptime: user.uptime || 'N/A',
                            bytesIn: user.bytesIn || 0,
                            bytesOut: user.bytesOut || 0
                        },
                        timestamp: new Date()
                    });
                }
            }

            // Update last known users
            this.lastActiveUsers = currentUserMap;

        } catch (error) {
            console.error('Error checking user connections:', error);
        }
    }

    // Check system logs for warnings and errors
    async checkSystemLogs(mikrotikConnection) {
        try {
            const logs = await mikrotikConnection.getSystemLogs(20); // Get last 20 logs

            for (const log of logs) {
                const logId = `${log.time}-${log.message}`;

                if (!this.lastSystemLogs.has(logId)) {
                    this.lastSystemLogs.add(logId);

                    // Check for important log messages
                    const message = log.message || '';
                    const topics = log.topics || '';

                    if (topics.includes('warning') || message.toLowerCase().includes('warning')) {
                        await this.createAlert('SYSTEM_WARNING', {
                            title: 'System Warning',
                            message: message,
                            details: {
                                time: log.time || 'N/A',
                                topics: topics,
                                message: message
                            },
                            timestamp: new Date()
                        });
                    }

                    if (topics.includes('error') || topics.includes('critical') ||
                        message.toLowerCase().includes('error') || message.toLowerCase().includes('critical')) {
                        await this.createAlert('SYSTEM_ERROR', {
                            title: 'System Error',
                            message: message,
                            details: {
                                time: log.time || 'N/A',
                                topics: topics,
                                message: message
                            },
                            timestamp: new Date()
                        });
                    }
                }
            }

            // Clean up old log IDs (keep only last 100)
            const logIds = Array.from(this.lastSystemLogs);
            if (logIds.length > 100) {
                this.lastSystemLogs = new Set(logIds.slice(-100));
            }

        } catch (error) {
            console.error('Error checking system logs:', error);
        }
    }

    // Check wireless events
    async checkWirelessEvents(mikrotikConnection) {
        try {
            const registrations = await mikrotikConnection.getWirelessRegistrations();
            const currentRegistrations = new Map();

            // Process current registrations
            for (const reg of registrations) {
                const macAddress = reg['mac-address'];
                if (!macAddress || macAddress === 'N/A') continue;

                currentRegistrations.set(macAddress, reg);

                // Check if this is a new wireless client
                if (!this.lastWirelessRegistrations.has(macAddress)) {
                    await this.createAlert('WIRELESS_CLIENT_CONNECTED', {
                        title: 'Wireless Client Connected',
                        message: `New wireless client ${macAddress} connected`,
                        details: {
                            macAddress: macAddress,
                            interface: reg['interface'] || 'N/A',
                            signalStrength: reg['signal-strength'] || 'N/A',
                            txRate: reg['tx-rate'] || 'N/A',
                            rxRate: reg['rx-rate'] || 'N/A',
                            uptime: reg['uptime'] || 'N/A'
                        },
                        timestamp: new Date()
                    });
                }
            }

            // Check for disconnected wireless clients
            for (const [macAddress, reg] of this.lastWirelessRegistrations) {
                if (!currentRegistrations.has(macAddress)) {
                    await this.createAlert('WIRELESS_CLIENT_DISCONNECTED', {
                        title: 'Wireless Client Disconnected',
                        message: `Wireless client ${macAddress} disconnected`,
                        details: {
                            macAddress: macAddress,
                            interface: reg['interface'] || 'N/A',
                            lastSeen: reg['last-seen'] || 'N/A',
                            uptime: reg['uptime'] || 'N/A'
                        },
                        timestamp: new Date()
                    });
                }
            }

            // Update last known registrations
            this.lastWirelessRegistrations = currentRegistrations;

        } catch (error) {
            console.error('Error checking wireless events:', error);
        }
    }

    // Check interface status
    async checkInterfaceStatus(mikrotikConnection) {
        try {
            const interfaces = await mikrotikConnection.executeCommand('/interface/print');

            for (const iface of interfaces) {
                const interfaceName = iface.name;
                const isRunning = iface.running === 'true';
                const isDisabled = iface.disabled === 'true';

                // Check for interface going down
                if (!isRunning && !isDisabled && interfaceName !== 'ether1') {
                    await this.createAlert('INTERFACE_DOWN', {
                        title: 'Interface Down',
                        message: `Interface ${interfaceName} is down`,
                        details: {
                            interfaceName: interfaceName,
                            type: iface.type || 'N/A',
                            mtu: iface.mtu || 'N/A',
                            macAddress: iface['mac-address'] || 'N/A',
                            lastLinkUp: iface['last-link-up-time'] || 'N/A'
                        },
                        timestamp: new Date()
                    });
                }

                // Check for interface coming up
                if (isRunning && !isDisabled && interfaceName !== 'ether1') {
                    await this.createAlert('INTERFACE_UP', {
                        title: 'Interface Up',
                        message: `Interface ${interfaceName} is up`,
                        details: {
                            interfaceName: interfaceName,
                            type: iface.type || 'N/A',
                            mtu: iface.mtu || 'N/A',
                            macAddress: iface['mac-address'] || 'N/A'
                        },
                        timestamp: new Date()
                    });
                }
            }

        } catch (error) {
            console.error('Error checking interface status:', error);
        }
    }

    // Create and send alert
    async createAlert(alertType, data) {
        const alertConfig = this.alertTypes[alertType];
        if (!alertConfig) {
            console.error(`Unknown alert type: ${alertType}`);
            return;
        }

        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: alertType,
            title: data.title,
            message: data.message,
            details: data.details,
            timestamp: data.timestamp,
            icon: alertConfig.icon,
            color: alertConfig.color,
            priority: alertConfig.priority,
            read: false
        };

        // Add to alert history
        this.alertHistory.unshift(alert);
        if (this.alertHistory.length > this.maxHistorySize) {
            this.alertHistory = this.alertHistory.slice(0, this.maxHistorySize);
        }

        // Emit event for real-time frontend updates
        this.emit('newAlert', alert);

        // Send email notification
        await this.sendEmailAlert(alert, alertConfig);

        console.log(`🚨 Alert created: ${alert.title} - ${alert.message}`);
    }

    // Send email alert
    async sendEmailAlert(alert, alertConfig) {
        try {
            const emailHtml = this.createAlertEmail(alert);
            await this.emailService.sendEmail(
                emailHtml,
                alertConfig.emailSubject,
                process.env.ADMIN_EMAIL
            );
            console.log(`📧 Email alert sent: ${alertConfig.emailSubject}`);
        } catch (error) {
            console.error('Error sending email alert:', error);
        }
    }

    // Create email HTML for alert
    createAlertEmail(alert) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">${alert.icon} ${alert.title}</h1>
                    <p>Real-time alert from your MikroTik monitoring system</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">${alert.priority.toUpperCase()} PRIORITY</span>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">📋 Alert Details</h3>
                        <p style="margin: 0; color: #666; font-size: 16px;">${alert.message}</p>
                    </div>
                    
                    ${this.createDetailsTable(alert.details)}
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; border-radius: 8px;">
                        <p>This notification was sent automatically by your MikroTik monitoring system.</p>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                        Sent on ${alert.timestamp.toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    // Create details table for email
    createDetailsTable(details) {
        if (!details || Object.keys(details).length === 0) {
            return '';
        }

        const rows = Object.entries(details).map(([key, value]) => `
            <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                <span style="font-weight: 600; color: #666;">${this.formatKey(key)}:</span>
                <span style="color: #333;">${value}</span>
            </div>
        `).join('');

        return `
            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #333;">📊 Technical Details</h3>
                ${rows}
            </div>
        `;
    }

    // Format key names for display
    formatKey(key) {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/([A-Z])/g, ' $1')
            .trim();
    }

    // Get all alerts
    getAlerts() {
        return this.alertHistory;
    }

    // Get unread alerts
    getUnreadAlerts() {
        return this.alertHistory.filter(alert => !alert.read);
    }

    // Mark alert as read
    markAsRead(alertId) {
        const alert = this.alertHistory.find(a => a.id === alertId);
        if (alert) {
            alert.read = true;
            this.emit('alertRead', alertId);
        }
    }

    // Mark all alerts as read
    markAllAsRead() {
        this.alertHistory.forEach(alert => alert.read = true);
        this.emit('allAlertsRead');
    }

    // Get monitoring status
    getMonitoringStatus() {
        return {
            isActive: this.isMonitoring,
            totalAlerts: this.alertHistory.length,
            unreadAlerts: this.getUnreadAlerts().length,
            lastAlert: this.alertHistory[0] || null
        };
    }

    // Clear old alerts
    clearOldAlerts(daysOld = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        this.alertHistory = this.alertHistory.filter(alert =>
            alert.timestamp > cutoffDate
        );

        this.emit('alertsCleared');
    }
}

module.exports = NotificationService;







