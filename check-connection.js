const MikroTikAPI = require('./services/mikrotik-api');
require('dotenv').config();

async function testMikroTikConnection() {
    console.log('🔧 Testing MikroTik Connection...');
    console.log('='.repeat(50));

    // Display current settings
    console.log('📋 Current Connection Settings:');
    console.log(`   Host: ${process.env.MIKROTIK_HOST || '192.168.88.1 (default)'}`);
    console.log(`   Username: ${process.env.MIKROTIK_USERNAME || 'admin (default)'}`);
    console.log(`   Port: ${process.env.MIKROTIK_PORT || '8728 (default)'}`);
    console.log(`   Password: ${process.env.MIKROTIK_PASSWORD ? '***SET***' : '***NOT SET***'}`);
    console.log('');

    if (!process.env.MIKROTIK_PASSWORD) {
        console.log('❌ MIKROTIK_PASSWORD is not set in your .env file!');
        console.log('💡 Please add your MikroTik password to the .env file');
        return;
    }

    // Test different connection options
    const connectionTests = [
        {
            name: 'API Port (8728)',
            port: 8728,
            description: 'Standard API port'
        },
        {
            name: 'API Port (8729)',
            port: 8729,
            description: 'Alternative API port'
        },
        {
            name: 'HTTP Port (80)',
            port: 80,
            description: 'HTTP port (if API enabled)'
        }
    ];

    for (const test of connectionTests) {
        console.log(`\n🔍 Testing ${test.name} (${test.description})...`);

        try {
            const mikrotik = new MikroTikAPI(
                process.env.MIKROTIK_HOST || '192.168.88.1',
                process.env.MIKROTIK_USERNAME || 'admin',
                process.env.MIKROTIK_PASSWORD,
                test.port
            );

            console.log(`   Connecting to ${process.env.MIKROTIK_HOST || '192.168.88.1'}:${test.port}...`);

            // Set a shorter timeout for testing
            mikrotik.connection = null;
            mikrotik.connected = false;

            await mikrotik.connect();

            console.log(`   ✅ SUCCESS! Connected via ${test.name}`);

            // Test a simple command
            try {
                const systemInfo = await mikrotik.getSystemInfo();
                console.log(`   📊 Router Name: ${systemInfo.name || 'Unknown'}`);
                console.log(`   🔧 RouterOS Version: ${systemInfo.version || 'Unknown'}`);
            } catch (cmdError) {
                console.log(`   ⚠️  Connected but command failed: ${cmdError.message}`);
            }

            await mikrotik.disconnect();
            console.log(`   🔌 Disconnected from ${test.name}`);

            // If we get here, this port works
            console.log(`\n🎉 RECOMMENDATION: Use port ${test.port} for your connection`);
            console.log(`   Add to your .env file: MIKROTIK_PORT=${test.port}`);
            break;

        } catch (error) {
            console.log(`   ❌ FAILED: ${error.message}`);

            if (error.message.includes('Timed out')) {
                console.log(`   💡 Port ${test.port} is not accessible or blocked`);
            } else if (error.message.includes('ECONNREFUSED')) {
                console.log(`   💡 Port ${test.port} is not open on the router`);
            } else if (error.message.includes('Invalid credentials')) {
                console.log(`   💡 Username/password incorrect`);
            }
        }
    }

    console.log('\n🔧 Troubleshooting Tips:');
    console.log('1. Check if your MikroTik router is accessible from this machine');
    console.log('2. Verify the IP address is correct');
    console.log('3. Make sure API access is enabled on your MikroTik');
    console.log('4. Check if any firewall is blocking the connection');
    console.log('5. Try connecting via WinBox to verify credentials');
    console.log('');
    console.log('📝 Example .env file:');
    console.log('MIKROTIK_HOST=192.168.88.1');
    console.log('MIKROTIK_USERNAME=admin');
    console.log('MIKROTIK_PASSWORD=your-password');
    console.log('MIKROTIK_PORT=8728');
}

// Run the test
testMikroTikConnection();







