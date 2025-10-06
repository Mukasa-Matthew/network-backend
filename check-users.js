const MikroTikAPI = require('./services/mikrotik-api');
require('dotenv').config();

async function checkActiveUsers() {
    try {
        console.log('🔍 Checking current active users...');

        // Create MikroTik connection
        const mikrotik = new MikroTikAPI(
            process.env.MIKROTIK_HOST || '192.168.88.1',
            process.env.MIKROTIK_USERNAME || 'admin',
            process.env.MIKROTIK_PASSWORD || 'password',
            process.env.MIKROTIK_PORT || 8728
        );

        console.log('📡 Connecting to MikroTik router...');
        await mikrotik.connect();
        console.log('✅ Connected to MikroTik router');

        // Get active users
        console.log('📊 Fetching active users...');
        const activeUsers = await mikrotik.getActiveUsers();

        console.log(`\n📋 Found ${activeUsers.length} active users:`);
        console.log('='.repeat(80));

        if (activeUsers.length === 0) {
            console.log('❌ No active users found');
        } else {
            activeUsers.forEach((user, index) => {
                console.log(`\n👤 User ${index + 1}:`);
                console.log(`   Host Name: ${user.hostName || 'Unknown'}`);
                console.log(`   MAC Address: ${user.macAddress || 'N/A'}`);
                console.log(`   IP Address: ${user.address || 'N/A'}`);
                console.log(`   Uptime: ${user.uptime || 'N/A'}`);
                console.log(`   Data Used: ↓${formatBytes(user.bytesIn)} ↑${formatBytes(user.bytesOut)}`);
                console.log(`   Signal Strength: ${user.signalStrength || 'N/A'}`);
                console.log(`   Connection Type: ${user.connectionType || 'N/A'}`);
                console.log(`   Session ID: ${user.sessionId || 'N/A'}`);
                console.log(`   Login By: ${user.loginBy || 'N/A'}`);
            });
        }

        // Check if user with code 8qri5p is connected
        const user8qri5p = activeUsers.find(user =>
            user.hostName && user.hostName.toLowerCase().includes('8qri5p') ||
            user.sessionId && user.sessionId.includes('8qri5p') ||
            user.loginBy && user.loginBy.includes('8qri5p')
        );

        if (user8qri5p) {
            console.log('\n🎯 Found user with code 8qri5p:');
            console.log(`   Host Name: ${user8qri5p.hostName}`);
            console.log(`   MAC Address: ${user8qri5p.macAddress}`);
            console.log(`   IP Address: ${user8qri5p.address}`);
            console.log(`   Uptime: ${user8qri5p.uptime}`);
        } else {
            console.log('\n❌ User with code 8qri5p not found in active users');
            console.log('💡 This user may have disconnected or the code is different');
        }

        await mikrotik.disconnect();
        console.log('\n✅ Disconnected from MikroTik router');

    } catch (error) {
        console.error('❌ Error checking active users:', error.message);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the check
checkActiveUsers();







