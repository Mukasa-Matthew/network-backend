const RouterOSAPI = require('node-routeros').RouterOSAPI;

console.log('🔍 Router Discovery Test');
console.log('=======================');

// Common MikroTik router IPs
const commonIPs = ['192.168.1.1', '192.168.88.1', '10.0.0.1', '11.0.0.1'];

// Common usernames
const usernames = ['admin', 'root'];

// Test connection with different IPs
const testIPs = async () => {
    for (const ip of commonIPs) {
        console.log(`\n🔍 Testing IP: ${ip}`);

        const connection = new RouterOSAPI({
            host: ip,
            user: 'admin',
            password: 'admin', // Try common default password
            port: 8728,
            timeout: 5
        });

        try {
            await connection.connect();
            console.log(`✅ SUCCESS! Router found at ${ip}`);
            console.log('💡 Try these credentials in the web app:');
            console.log(`   Network Gateway: ${ip}`);
            console.log('   Username: admin');
            console.log('   Password: admin (or your actual password)');

            // Test if we can get basic info
            const resources = await connection.write('/system/resource/print');
            console.log(`   Model: ${resources[0].model || 'Unknown'}`);
            console.log(`   Version: ${resources[0].version || 'Unknown'}`);

            await connection.close();
            return ip;
        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
        }
    }

    console.log('\n❌ No router found with default credentials');
    console.log('💡 Try these steps:');
    console.log('1. Check your router\'s IP address (usually on the router label)');
    console.log('2. Try different passwords (check router documentation)');
    console.log('3. Make sure API access is enabled on your router');
    return null;
};

// Run the test
testIPs().then((foundIP) => {
    if (foundIP) {
        console.log(`\n🎉 Router found at ${foundIP}!`);
        console.log('Now you can use these credentials in the web app login.');
    }
});




