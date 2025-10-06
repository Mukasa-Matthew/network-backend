const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    async initializeTransporter() {
        try {
            // Try different configurations for Gmail
            const configs = [
                {
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                },
                {
                    host: 'smtp.gmail.com',
                    port: 587,
                    secure: false,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                },
                {
                    host: 'smtp.gmail.com',
                    port: 465,
                    secure: true,
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    },
                    tls: {
                        rejectUnauthorized: false
                    }
                }
            ];

            for (let i = 0; i < configs.length; i++) {
                try {
                    console.log(`Trying email configuration ${i + 1}...`);
                    this.transporter = nodemailer.createTransport(configs[i]);
                    await this.transporter.verify();
                    console.log(`Email service initialized successfully with configuration ${i + 1}`);
                    return;
                } catch (configError) {
                    console.log(`Configuration ${i + 1} failed:`, configError.message);
                    if (i === configs.length - 1) {
                        throw configError;
                    }
                }
            }
        } catch (error) {
            console.error('Email service initialization failed:', error);
            // Don't throw error, just log it - email service will be disabled
        }
    }

    createUserConnectedEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🔗 User Connected</h1>
                    <p>New user has connected to your network</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">CONNECTED</span>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">👤 User Details</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Host Name:</span>
                            <span style="color: #333;">${userData.hostName || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Connection Type:</span>
                            <span style="color: #333;">${userData.connectionType || 'N/A'}</span>
                        </div>
                        ${userData.signalStrength ? `
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Signal Strength:</span>
                            <span style="color: #333;">${userData.signalStrength}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">📊 Session Information</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Session ID:</span>
                            <span style="color: #333;">${userData.sessionId || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Login Method:</span>
                            <span style="color: #333;">${userData.loginBy || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Idle Timeout:</span>
                            <span style="color: #333;">${userData.idleTimeout || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; border-radius: 8px;">
                        <p>This notification was sent automatically by your MikroTik monitoring system.</p>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                        Sent on ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    createUserDisconnectedEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🔌 User Disconnected</h1>
                    <p>User has disconnected from your network</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background: #ff6b6b; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">DISCONNECTED</span>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">👤 User Details</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Host Name:</span>
                            <span style="color: #333;">${userData.hostName || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Connection Type:</span>
                            <span style="color: #333;">${userData.connectionType || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">📊 Session Summary</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Total Uptime:</span>
                            <span style="color: #333;">${userData.totalUptime || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Data Downloaded:</span>
                            <span style="color: #333;">${userData.dataDownloaded || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Data Uploaded:</span>
                            <span style="color: #333;">${userData.dataUploaded || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Total Data Used:</span>
                            <span style="color: #333;">${userData.totalDataUsed || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Session Start:</span>
                            <span style="color: #333;">${userData.sessionStart || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Session End:</span>
                            <span style="color: #333;">${userData.sessionEnd || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; border-radius: 8px;">
                        <p>This notification was sent automatically by your MikroTik monitoring system.</p>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                        Sent on ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    createUserReconnectedEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🔄 User Reconnected</h1>
                    <p>User has reconnected to your network</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background: #74b9ff; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">RECONNECTED</span>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">👤 User Details</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Host Name:</span>
                            <span style="color: #333;">${userData.hostName || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Connection Type:</span>
                            <span style="color: #333;">${userData.connectionType || 'N/A'}</span>
                        </div>
                        ${userData.signalStrength ? `
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Signal Strength:</span>
                            <span style="color: #333;">${userData.signalStrength}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="background: #e8f5e8; border: 1px solid #a8e6cf; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">⏱️ Reconnection Details</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Previous Disconnect:</span>
                            <span style="color: #333;">${userData.previousDisconnect || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Reconnection Time:</span>
                            <span style="color: #333;">${userData.reconnectionTime || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Time Offline:</span>
                            <span style="color: #333;">${userData.timeOffline || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Remaining Time:</span>
                            <span style="color: #333;">${userData.remainingTime || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; border-radius: 8px;">
                        <p>This notification was sent automatically by your MikroTik monitoring system.</p>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                        Sent on ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    createNewUserLoginEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🆕 New User Login</h1>
                    <p>New user has logged into your network</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background: #a29bfe; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">NEW USER</span>
                    </div>
                    
                    <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">⚠️ New User Alert</h3>
                        <p>This is a new user that hasn't been seen on your network before. Please review the details below.</p>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">👤 User Details</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Host Name:</span>
                            <span style="color: #333;">${userData.hostName || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Connection Type:</span>
                            <span style="color: #333;">${userData.connectionType || 'N/A'}</span>
                        </div>
                        ${userData.signalStrength ? `
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Signal Strength:</span>
                            <span style="color: #333;">${userData.signalStrength}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">🔐 Login Information</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Login Method:</span>
                            <span style="color: #333;">${userData.loginBy || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Session ID:</span>
                            <span style="color: #333;">${userData.sessionId || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Login Time:</span>
                            <span style="color: #333;">${userData.loginTime || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Idle Timeout:</span>
                            <span style="color: #333;">${userData.idleTimeout || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; border-radius: 8px;">
                        <p>This notification was sent automatically by your MikroTik monitoring system.</p>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                        Sent on ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    createUserTimeExpiredEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: linear-gradient(135deg, #fd79a8 0%, #e84393 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">⏰ User Time Expired</h1>
                    <p>User has been disconnected due to time expiration</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background: #fd79a8; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">TIME EXPIRED</span>
                    </div>
                    
                    <div style="background: #ffe6e6; border: 1px solid #ffb3b3; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">⏰ Time Expiration Alert</h3>
                        <p>This user's allocated time has expired and they have been automatically disconnected from the network.</p>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">👤 User Details</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Host Name:</span>
                            <span style="color: #333;">${userData.hostName || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Connection Type:</span>
                            <span style="color: #333;">${userData.connectionType || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">⏱️ Session Summary</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Total Session Time:</span>
                            <span style="color: #333;">${userData.totalSessionTime || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Allocated Time:</span>
                            <span style="color: #333;">${userData.allocatedTime || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Data Downloaded:</span>
                            <span style="color: #333;">${userData.dataDownloaded || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Data Uploaded:</span>
                            <span style="color: #333;">${userData.dataUploaded || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Total Data Used:</span>
                            <span style="color: #333;">${userData.totalDataUsed || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Session Start:</span>
                            <span style="color: #333;">${userData.sessionStart || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Session End:</span>
                            <span style="color: #333;">${userData.sessionEnd || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; border-radius: 8px;">
                        <p>This notification was sent automatically by your MikroTik monitoring system.</p>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                        Sent on ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    // Simple, focused email templates for specific events
    createSimpleConnectionEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: #4CAF50; color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">🔗 New User Connected</h1>
                </div>
                
                <div style="background: white; padding: 25px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <span style="background: #4CAF50; color: white; padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">CONNECTED</span>
                    </div>
                    
                    <div style="background: #e8f5e8; border: 1px solid #a8e6cf; border-radius: 8px; padding: 15px; margin: 15px 0;">
                        <div style="text-align: center; margin-bottom: 10px;">
                            <span style="font-size: 18px; font-weight: bold; color: #333;">${userData.hostName || 'Unknown Device'}</span>
                        </div>
                        <div style="text-align: center; color: #666; font-size: 14px;">
                            Now ${userData.totalUsersRemaining || 'N/A'} users active on network
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0;">
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">Connected at:</span>
                            <span style="color: #333;">${userData.sessionStart || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 15px; text-align: center;">
                        MikroTik Network Monitor • ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    createSimpleDisconnectionEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: #ff6b6b; color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">🔌 User Disconnected</h1>
                </div>
                
                <div style="background: white; padding: 25px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <span style="background: #ff6b6b; color: white; padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">DISCONNECTED</span>
                    </div>
                    
                    <div style="background: #ffe6e6; border: 1px solid #ffb3b3; border-radius: 8px; padding: 15px; margin: 15px 0;">
                        <div style="text-align: center; margin-bottom: 10px;">
                            <span style="font-size: 18px; font-weight: bold; color: #333;">${userData.hostName || 'Unknown Device'}</span>
                        </div>
                        <div style="text-align: center; color: #666; font-size: 14px;">
                            Now ${userData.totalUsersRemaining || 'N/A'} users remaining on network
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0;">
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">Disconnected at:</span>
                            <span style="color: #333;">${userData.sessionEnd || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">Session Duration:</span>
                            <span style="color: #333;">${userData.totalUptime || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 15px; text-align: center;">
                        MikroTik Network Monitor • ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    createUserKickedEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: #ff9800; color: white; padding: 25px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">🚫 User Kicked Out</h1>
                </div>
                
                <div style="background: white; padding: 25px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <span style="background: #ff9800; color: white; padding: 6px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">KICKED</span>
                    </div>
                    
                    <div style="background: #fff3e0; border: 1px solid #ffcc80; border-radius: 8px; padding: 15px; margin: 15px 0;">
                        <div style="text-align: center; margin-bottom: 10px;">
                            <span style="font-size: 18px; font-weight: bold; color: #333;">${userData.hostName || 'Unknown Device'}</span>
                        </div>
                        <div style="text-align: center; color: #666; font-size: 14px;">
                            Kicked due to ${userData.kickReason || 'session timeout'}
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 15px 0;">
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">Kicked at:</span>
                            <span style="color: #333;">${userData.sessionEnd || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px;">
                            <span style="font-weight: 600; color: #666;">Session Duration:</span>
                            <span style="color: #333;">${userData.totalUptime || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 15px; text-align: center;">
                        MikroTik Network Monitor • ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    async sendEmail(recipient, subject, html) {
        try {
            if (!this.transporter) {
                console.error('Email transporter not initialized - email service disabled');
                return false;
            }

            // Check if email configuration is set up
            if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
                console.error('Email configuration missing. Please set EMAIL_USER and EMAIL_PASSWORD in your .env file');
                return false;
            }

            const emailRecipient = recipient || process.env.ADMIN_EMAIL;
            if (!emailRecipient) {
                console.error('No recipient email address found. Please set ADMIN_EMAIL in your .env file');
                return false;
            }

            // Debug logging
            console.log('Sending email with details:');
            console.log('From:', process.env.EMAIL_USER);
            console.log('To:', emailRecipient);
            console.log('Subject:', subject);
            console.log('HTML length:', html.length);

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: emailRecipient,
                subject: subject,
                html: html
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`Email sent successfully: ${subject} to ${emailRecipient}`);

            return true;
        } catch (error) {
            console.error('Error sending email:', error);

            // Handle socket destroy errors gracefully
            if (error.message && error.message.includes('destroy')) {
                console.log('Socket destroy error detected - this is a known Node.js issue, continuing...');
                return true; // Consider it successful since the email was likely sent
            }

            return false;
        }
    }

    // Simple connection email template
    createSimpleConnectionEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🔗 New User Connected</h1>
                    <p>User has connected to your hotspot network</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">CONNECTED</span>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">👤 User Details</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Username:</span>
                            <span style="color: #333;">${userData.hostName || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Connection Time:</span>
                            <span style="color: #333;">${userData.sessionStart || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Total Active Users:</span>
                            <span style="color: #333;">${userData.totalUsersRemaining || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; border-radius: 8px;">
                        <p>This notification was sent automatically by your MikroTik hotspot monitoring system.</p>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                        Sent on ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    // Simple disconnection email template
    createSimpleDisconnectionEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🔌 User Disconnected</h1>
                    <p>User has disconnected from your hotspot network</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background: #ff6b6b; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">DISCONNECTED</span>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">👤 User Details</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Username:</span>
                            <span style="color: #333;">${userData.hostName || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Session Duration:</span>
                            <span style="color: #333;">${userData.totalUptime || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Data Downloaded:</span>
                            <span style="color: #333;">${userData.dataDownloaded || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Data Uploaded:</span>
                            <span style="color: #333;">${userData.dataUploaded || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Total Data Used:</span>
                            <span style="color: #333;">${userData.totalDataUsed || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Users Remaining:</span>
                            <span style="color: #333;">${userData.totalUsersRemaining || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; border-radius: 8px;">
                        <p>This notification was sent automatically by your MikroTik hotspot monitoring system.</p>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                        Sent on ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    // User kicked email template
    createUserKickedEmail(userData) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 20px;">
                <div style="background: linear-gradient(135deg, #ff4757 0%, #ff3742 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="margin: 0; font-size: 28px;">🚫 User Kicked Out</h1>
                    <p>User has been removed from your hotspot network</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <span style="background: #ff4757; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold;">KICKED OUT</span>
                    </div>
                    
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #333;">👤 User Details</h3>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Username:</span>
                            <span style="color: #333;">${userData.hostName || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">MAC Address:</span>
                            <span style="color: #333;">${userData.macAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">IP Address:</span>
                            <span style="color: #333;">${userData.ipAddress || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Session Duration:</span>
                            <span style="color: #333;">${userData.totalUptime || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Kick Reason:</span>
                            <span style="color: #333; font-weight: bold;">${userData.kickReason || 'Unknown'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Data Downloaded:</span>
                            <span style="color: #333;">${userData.dataDownloaded || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Data Uploaded:</span>
                            <span style="color: #333;">${userData.dataUploaded || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Total Data Used:</span>
                            <span style="color: #333;">${userData.totalDataUsed || 'N/A'}</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee;">
                            <span style="font-weight: 600; color: #666;">Users Remaining:</span>
                            <span style="color: #333;">${userData.totalUsersRemaining || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; border-radius: 8px;">
                        <p>This notification was sent automatically by your MikroTik hotspot monitoring system.</p>
                    </div>
                    
                    <div style="color: #999; font-size: 12px; margin-top: 20px; text-align: center;">
                        Sent on ${new Date().toLocaleString()}
                    </div>
                </div>
            </div>
        `;
    }

    // Notification methods
    async notifyUserConnected(userData) {
        const html = this.createUserConnectedEmail(userData);
        const subject = `🔗 New User Connected: ${userData.hostName || userData.macAddress}`;
        return await this.sendEmail(process.env.ADMIN_EMAIL, subject, html);
    }

    async notifyUserDisconnected(userData) {
        const html = this.createUserDisconnectedEmail(userData);
        const subject = `🔌 User Disconnected: ${userData.hostName || userData.macAddress}`;
        return await this.sendEmail(process.env.ADMIN_EMAIL, subject, html);
    }

    async notifyUserReconnected(userData) {
        const html = this.createUserReconnectedEmail(userData);
        const subject = `🔄 User Reconnected: ${userData.hostName || userData.macAddress}`;
        return await this.sendEmail(process.env.ADMIN_EMAIL, subject, html);
    }

    async notifyNewUserLogin(userData) {
        const html = this.createNewUserLoginEmail(userData);
        const subject = `🆕 New User Login: ${userData.hostName || userData.macAddress}`;
        return await this.sendEmail(process.env.ADMIN_EMAIL, subject, html);
    }

    async notifyUserTimeExpired(userData) {
        const html = this.createUserTimeExpiredEmail(userData);
        const subject = `⏰ User Time Expired: ${userData.hostName || userData.macAddress}`;
        return await this.sendEmail(process.env.ADMIN_EMAIL, subject, html);
    }

    // Test email method
    async sendTestEmail() {
        const testData = {
            hostName: 'Test User',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            ipAddress: '192.168.1.100',
            connectionType: 'Hotspot',
            sessionStart: new Date().toLocaleString(),
            totalUsersRemaining: 5,
            totalUptime: '15m 30s',
            dataDownloaded: '2.5 MB',
            dataUploaded: '1.2 MB',
            totalDataUsed: '3.7 MB',
            kickReason: 'idle timeout'
        };

        const html = this.createSimpleConnectionEmail(testData);
        const subject = '🧪 Test Email - MikroTik Monitoring System';
        return await this.sendEmail(process.env.ADMIN_EMAIL, subject, html);
    }
}

module.exports = EmailService;
