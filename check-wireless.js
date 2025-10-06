const MikroTikAPI = require('./services/mikrotik-api');
require('dotenv').config();

async function checkWirelessStatus() {
    try {
        console.log('📡 Checking Wireless Interface Status...');
        console.log('='.repeat(60));

        // Create MikroTik connection
        const mikrotik = new MikroTikAPI(
            process.env.MIKROTIK_HOST || '192.168.88.1',
            process.env.MIKROTIK_USERNAME || 'admin',
            process.env.MIKROTIK_PASSWORD || 'password',
            process.env.MIKROTIK_PORT || 8728
        );

        console.log('🔗 Connecting to MikroTik router...');
        await mikrotik.connect();
        console.log('✅ Connected to MikroTik router');

        // Get wireless interfaces
        console.log('\n📊 Wireless Interface Details:');
        console.log('-'.repeat(40));
        const wirelessInterfaces = await mikrotik.getWirelessInterfaces();

        if (wirelessInterfaces.length === 0) {
            console.log('❌ No wireless interfaces found');
        } else {
            wirelessInterfaces.forEach((wifi, index) => {
                console.log(`\n📶 Wireless Interface ${index + 1}:`);
                console.log(`   Name: ${wifi.name}`);
                console.log(`   Mode: ${wifi.mode}`);
                console.log(`   Band: ${wifi.band}`);
                console.log(`   Channel: ${wifi.channel}`);
                console.log(`   Frequency: ${wifi.frequency}`);
                console.log(`   SSID: ${wifi.ssid}`);
                console.log(`   Running: ${wifi.running}`);
                console.log(`   Disabled: ${wifi.disabled}`);
                console.log(`   Security: ${wifi.security}`);
                console.log(`   Radio Name: ${wifi['radio-name']}`);
                console.log(`   Country: ${wifi['country']}`);
                console.log(`   TX Power: ${wifi['tx-power']}`);
                console.log(`   TX Power Mode: ${wifi['tx-power-mode']}`);
            });
        }

        // Get wireless registrations
        console.log('\n📋 Wireless Client Registrations:');
        console.log('-'.repeat(40));
        const wirelessRegistrations = await mikrotik.getWirelessRegistrations();

        if (wirelessRegistrations.length === 0) {
            console.log('❌ No wireless clients connected');
        } else {
            console.log(`✅ Found ${wirelessRegistrations.length} connected clients:`);
            wirelessRegistrations.forEach((client, index) => {
                console.log(`\n👤 Client ${index + 1}:`);
                console.log(`   MAC Address: ${client['mac-address']}`);
                console.log(`   Interface: ${client['interface']}`);
                console.log(`   Signal Strength: ${client['signal-strength']}`);
                console.log(`   TX Rate: ${client['tx-rate']}`);
                console.log(`   RX Rate: ${client['rx-rate']}`);
                console.log(`   Uptime: ${client['uptime']}`);
                console.log(`   Last Seen: ${client['last-seen']}`);
                console.log(`   TX CCQ: ${client['tx-ccq']}`);
                console.log(`   RX CCQ: ${client['rx-ccq']}`);
            });
        }

        // Get wireless traffic data
        console.log('\n📈 Wireless Traffic Statistics:');
        console.log('-'.repeat(40));
        const wirelessTraffic = await mikrotik.getWirelessTraffic();

        if (wirelessTraffic.length === 0) {
            console.log('❌ No wireless traffic data available');
        } else {
            wirelessTraffic.forEach((traffic, index) => {
                console.log(`\n📊 Traffic for ${traffic.name}:`);
                console.log(`   RX Bytes: ${formatBytes(traffic.rxBytes)}`);
                console.log(`   TX Bytes: ${formatBytes(traffic.txBytes)}`);
                console.log(`   RX Rate: ${formatBytes(traffic.rxRate)}/s`);
                console.log(`   TX Rate: ${formatBytes(traffic.txRate)}/s`);
                console.log(`   RX Packets: ${traffic.rxPackets}`);
                console.log(`   TX Packets: ${traffic.txPackets}`);
            });
        }

        // Check interface status
        console.log('\n🔍 Interface Status Check:');
        console.log('-'.repeat(40));
        const interfaces = await mikrotik.executeCommand('/interface/print');
        const wlan1Interface = interfaces.find(iface => iface.name === 'wlan1');

        if (wlan1Interface) {
            console.log('✅ wlan1 interface found:');
            console.log(`   Name: ${wlan1Interface.name}`);
            console.log(`   Type: ${wlan1Interface.type}`);
            console.log(`   Running: ${wlan1Interface.running}`);
            console.log(`   Disabled: ${wlan1Interface.disabled}`);
            console.log(`   MTU: ${wlan1Interface.mtu}`);
            console.log(`   MAC Address: ${wlan1Interface['mac-address']}`);
            console.log(`   Last Link Up: ${wlan1Interface['last-link-up-time']}`);
            console.log(`   Link Downs: ${wlan1Interface['link-downs']}`);
        } else {
            console.log('❌ wlan1 interface not found');
        }

        // Check wireless interface configuration
        console.log('\n⚙️ Wireless Interface Configuration:');
        console.log('-'.repeat(40));
        try {
            const wirelessConfig = await mikrotik.executeCommand('/interface/wireless/print', ['?name=wlan1']);
            if (wirelessConfig.length > 0) {
                const config = wirelessConfig[0];
                console.log('✅ wlan1 wireless configuration:');
                console.log(`   Mode: ${config.mode}`);
                console.log(`   Band: ${config.band}`);
                console.log(`   Channel: ${config.channel}`);
                console.log(`   Frequency: ${config.frequency}`);
                console.log(`   SSID: ${config.ssid}`);
                console.log(`   Security: ${config.security}`);
                console.log(`   Running: ${config.running}`);
                console.log(`   Disabled: ${config.disabled}`);
                console.log(`   Radio Name: ${config['radio-name']}`);
                console.log(`   Country: ${config['country']}`);
                console.log(`   TX Power: ${config['tx-power']}`);
                console.log(`   TX Power Mode: ${config['tx-power-mode']}`);
            } else {
                console.log('❌ wlan1 wireless configuration not found');
            }
        } catch (error) {
            console.log(`❌ Error getting wireless config: ${error.message}`);
        }

        await mikrotik.disconnect();
        console.log('\n✅ Disconnected from MikroTik router');

        // Provide troubleshooting tips
        console.log('\n🔧 Troubleshooting Tips for Wireless Issues:');
        console.log('='.repeat(60));
        console.log('1. Check if wireless interface is enabled:');
        console.log('   - Go to WinBox → Interfaces → Wireless');
        console.log('   - Make sure wlan1 is not disabled');
        console.log('');
        console.log('2. Check wireless configuration:');
        console.log('   - Verify SSID is set');
        console.log('   - Check security settings');
        console.log('   - Ensure channel is properly configured');
        console.log('');
        console.log('3. Check physical connection:');
        console.log('   - Verify antenna is connected');
        console.log('   - Check for physical damage');
        console.log('');
        console.log('4. Check wireless registration table:');
        console.log('   - Go to WinBox → Interfaces → Wireless → Registration Table');
        console.log('   - See if any clients are registered');
        console.log('');
        console.log('5. Restart wireless interface:');
        console.log('   - In WinBox: /interface/wireless/disable wlan1');
        console.log('   - Then: /interface/wireless/enable wlan1');

    } catch (error) {
        console.error('❌ Error checking wireless status:', error.message);
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
checkWirelessStatus();







