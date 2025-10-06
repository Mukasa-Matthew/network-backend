const RouterOSAPI = require('node-routeros').RouterOSAPI;

// Test MikroTik connection
async function testConnection(host, username, password, port = 8728) {
    console.log(`Testing connection to ${host}:${port} with username: ${username}`);

    const connection = new RouterOSAPI({
        host: host,
        user: username,
        password: password,
        port: port,
        keepalive: true,
        timeout: 15
    });

    try {
        await connection.connect();
        console.log('✅ Connection successful!');

        // Test a simple command
        const resources = await connection.write('/system/resource/print');
        console.log('✅ Router info retrieved:', resources[0]);

        await connection.close();
        console.log('✅ Connection closed successfully');
        return true;
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.error('Error details:', error);
        return false;
    }
}

// Usage example
const host = process.argv[2] || '192.168.1.1';
const username = process.argv[3] || 'admin';
const password = process.argv[4] || 'password';
const port = process.argv[5] || 8728;

console.log('MikroTik Connection Test');
console.log('========================');
console.log(`Host: ${host}`);
console.log(`Port: ${port}`);
console.log(`Username: ${username}`);
console.log('');

testConnection(host, username, password, port)
    .then(success => {
        if (success) {
            console.log('\n🎉 Connection test passed! Your credentials are correct.');
        } else {
            console.log('\n💥 Connection test failed! Check your credentials and network.');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Test error:', error);
        process.exit(1);
    });

