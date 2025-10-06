const MikroTikAPI = require('./services/mikrotik-api');
require('dotenv').config();

async function enableWirelessInterface() {
    try {
        console.log('🔧 Enabling Wireless Interface...');
        console.log('='.repeat(50));

        // Create MikroTik connection
        const mikrotik = new MikroTikAPI(
            process.env.MIKROTIK_HOST || '11.0.0.1', // Use the IP from your logs
            process.env.MIKROTIK_USERNAME || 'admin',
            process.env.MIKROTIK_PASSWORD || 'password',
            process.env.MIKROTIK_PORT || 8728
        );

        console.log('🔗 Connecting to MikroTik router...');
        await mikrotik.connect();
        console.log('✅ Connected to MikroTik router');

        // Check current wireless status
        console.log('\n📊 Current Wireless Status:');
        console.log('-'.repeat(30));
        try {
            const wirelessInterfaces = await mikrotik.executeCommand('/interface/wireless/print');
            console.log(`Found ${wirelessInterfaces.length} wireless interfaces`);

            wirelessInterfaces.forEach((wifi, index) => {
                console.log(`\n📶 Interface ${index + 1}: ${wifi.name}`);
                console.log(`   Mode: ${wifi.mode}`);
                console.log(`   Running: ${wifi.running}`);
                console.log(`   Disabled: ${wifi.disabled}`);
                console.log(`   SSID: ${wifi.ssid}`);
                console.log(`   Channel: ${wifi.channel}`);
            });
        } catch (error) {
            console.log(`❌ Error getting wireless interfaces: ${error.message}`);
        }

        // Enable wireless interface
        console.log('\n🔧 Enabling wlan1 interface...');
        try {
            // First, check if it's disabled
            const wlan1Status = await mikrotik.executeCommand('/interface/wireless/print', ['?name=wlan1']);

            if (wlan1Status.length > 0) {
                const wlan1 = wlan1Status[0];
                console.log(`Current status: Running=${wlan1.running}, Disabled=${wlan1.disabled}`);

                if (wlan1.disabled === 'true') {
                    console.log('🔄 Enabling wlan1 interface...');
                    await mikrotik.executeCommand('/interface/wireless/enable', ['=.id=' + wlan1['.id']]);
                    console.log('✅ wlan1 interface enabled');
                } else if (wlan1.running !== 'true') {
                    console.log('🔄 Restarting wlan1 interface...');
                    await mikrotik.executeCommand('/interface/wireless/disable', ['=.id=' + wlan1['.id']]);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                    await mikrotik.executeCommand('/interface/wireless/enable', ['=.id=' + wlan1['.id']]);
                    console.log('✅ wlan1 interface restarted');
                } else {
                    console.log('✅ wlan1 interface is already running');
                }
            } else {
                console.log('❌ wlan1 interface not found');
            }
        } catch (error) {
            console.log(`❌ Error enabling wlan1: ${error.message}`);
        }

        // Check wireless registrations
        console.log('\n📋 Checking Wireless Registrations...');
        console.log('-'.repeat(30));
        try {
            const registrations = await mikrotik.executeCommand('/interface/wireless/registration-table/print');
            console.log(`Found ${registrations.length} wireless registrations`);

            if (registrations.length > 0) {
                registrations.forEach((reg, index) => {
                    console.log(`\n👤 Registration ${index + 1}:`);
                    console.log(`   MAC: ${reg['mac-address']}`);
                    console.log(`   Interface: ${reg['interface']}`);
                    console.log(`   Signal: ${reg['signal-strength']}`);
                    console.log(`   Uptime: ${reg['uptime']}`);
                });
            }
        } catch (error) {
            console.log(`❌ Error getting registrations: ${error.message}`);
        }

        // Check interface status
        console.log('\n🔍 Final Interface Status:');
        console.log('-'.repeat(30));
        try {
            const interfaces = await mikrotik.executeCommand('/interface/print', ['?name=wlan1']);
            if (interfaces.length > 0) {
                const wlan1 = interfaces[0];
                console.log(`✅ wlan1 Status: Running=${wlan1.running}, Disabled=${wlan1.disabled}`);
                console.log(`   Type: ${wlan1.type}`);
                console.log(`   MTU: ${wlan1.mtu}`);
                console.log(`   MAC: ${wlan1['mac-address']}`);
            }
        } catch (error) {
            console.log(`❌ Error checking interface status: ${error.message}`);
        }

        await mikrotik.disconnect();
        console.log('\n✅ Disconnected from MikroTik router');

        console.log('\n🎉 Wireless interface check completed!');
        console.log('📱 Refresh your dashboard to see updated status');

    } catch (error) {
        console.error('❌ Error enabling wireless interface:', error.message);
        console.log('\n💡 Manual Steps to Enable Wireless:');
        console.log('1. Open WinBox and connect to your router');
        console.log('2. Go to Interfaces → Wireless');
        console.log('3. Find wlan1 interface');
        console.log('4. Right-click and select "Enable"');
        console.log('5. Check if SSID is configured');
        console.log('6. Verify security settings');
    }
}

// Run the script
enableWirelessInterface();







