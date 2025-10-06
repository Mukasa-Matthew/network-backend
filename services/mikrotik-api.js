const RouterOSAPI = require('node-routeros').RouterOSAPI;

class MikroTikAPI {
    constructor(host, username, password, port = 8728) {
        this.host = host;
        this.username = username;
        this.password = password;
        this.port = port;
        this.connection = null;
        this.connected = false;
        this.previousStats = new Map(); // Store previous stats for rate calculation
        this.lastUpdateTime = Date.now();

        // Initialize previousStats with default values for common interfaces
        const defaultInterfaces = ['ISP-main', 'main-bridge', 'wlan1', 'ap-bridge'];
        defaultInterfaces.forEach(iface => {
            this.previousStats.set(iface, {
                rxBytes: 0,
                txBytes: 0,
                timestamp: Date.now() - 5000 // Start with 5 seconds ago
            });
        });
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                // Close existing connection if any
                if (this.connection) {
                    try {
                        this.connection.close();
                    } catch (closeError) {
                        console.log('Error closing existing connection:', closeError.message);
                    }
                }

                this.connection = new RouterOSAPI({
                    host: this.host,
                    user: this.username,
                    password: this.password,
                    port: this.port,
                    keepalive: true,
                    timeout: 15
                });

                // Add error handlers to prevent crashes
                this.connection.on('error', (error) => {
                    console.error('MikroTik connection error:', error);
                    this.connected = false;
                });

                this.connection.on('close', (hadError) => {
                    console.log('MikroTik connection closed:', hadError ? 'with error' : 'normally');
                    this.connected = false;
                });

                this.connection.connect()
                    .then(() => {
                        this.connected = true;
                        console.log(`Connected to MikroTik router at ${this.host}`);
                        resolve();
                    })
                    .catch((error) => {
                        console.error('Connection error:', error);
                        this.connected = false;
                        reject(error);
                    });

            } catch (error) {
                this.connected = false;
                reject(error);
            }
        });
    }

    async disconnect() {
        if (this.connection && this.connected) {
            try {
                await this.connection.close();
                this.connected = false;
                console.log(`Disconnected from MikroTik router at ${this.host}`);
            } catch (error) {
                console.error('Disconnect error:', error);
                // Don't let disconnect errors crash the application
                this.connected = false;
            }
        }
        this.connected = false;
    }

    async executeCommand(command, params = []) {
        if (!this.connected) {
            console.warn('Not connected to router, attempting to reconnect...');
            try {
                await this.connect();
            } catch (error) {
                console.error('Failed to reconnect:', error);
                return [];
            }
        }

        return new Promise((resolve, reject) => {
            try {
                this.connection.write(command, params)
                    .then((response) => {
                        resolve(response || []);
                    })
                    .catch((error) => {
                        console.error(`Command execution error for ${command}:`, error);
                        // Return empty array instead of rejecting
                        resolve([]);
                    });
            } catch (error) {
                console.error(`Command execution error for ${command}:`, error);
                resolve([]);
            }
        });
    }

    // Get system resources (CPU, memory, etc.)
    async getSystemResource() {
        try {
            const response = await this.executeCommand('/system/resource/print');
            return response[0] || {};
        } catch (error) {
            console.error('Error getting system resource:', error);
            throw error;
        }
    }

    // Get system information
    async getSystemInfo() {
        try {
            const response = await this.executeCommand('/system/identity/print');
            return response[0] || {};
        } catch (error) {
            console.error('Error getting system info:', error);
            throw error;
        }
    }

    // Get RouterOS version
    async getRouterOSVersion() {
        try {
            const response = await this.executeCommand('/system/resource/print');
            const resource = response[0] || {};
            return resource['version'] || 'Unknown';
        } catch (error) {
            console.error('Error getting RouterOS version:', error);
            return 'Unknown';
        }
    }

    // Get real-time data for monitoring
    async getRealTimeData() {
        try {
            const [systemResource, interfaces, wirelessTraffic] = await Promise.all([
                this.getSystemResource(),
                this.getInterfaceStats(),
                this.getWirelessTraffic()
            ]);

            return {
                timestamp: new Date().toISOString(),
                system: {
                    cpuLoad: parseInt(systemResource['cpu-load']) || 0,
                    memoryUsage: parseInt(systemResource['total-memory']) > 0 ?
                        Math.round(((parseInt(systemResource['total-memory']) - parseInt(systemResource['free-memory'])) / parseInt(systemResource['total-memory'])) * 100) : 0,
                    uptime: systemResource['uptime'] || '0s',
                    version: systemResource['version'] || 'Unknown'
                },
                interfaces: interfaces.map(iface => ({
                    name: iface.name,
                    type: iface.type,
                    status: iface.running ? 'Running' : 'Down',
                    running: iface.running,
                    'mac-address': iface['mac-address'],
                    ipAddress: iface.ipAddress,
                    rxRate: iface.rxRate || 0,
                    txRate: iface.txRate || 0,
                    rxBytes: iface.rxBytes || 0,
                    txBytes: iface.txBytes || 0
                })),
                wireless: wirelessTraffic
            };
        } catch (error) {
            console.error('Error getting real-time data:', error);
            return {
                timestamp: new Date().toISOString(),
                system: {
                    cpuLoad: 0,
                    memoryUsage: 0,
                    uptime: '0s',
                    version: 'Unknown'
                },
                interfaces: [],
                wireless: []
            };
        }
    }

    // Get bandwidth usage for performance monitoring
    async getBandwidthUsage() {
        try {
            const [ispTraffic, lanTraffic] = await Promise.all([
                this.getSimpleTrafficRates('ISP-main'),
                this.getSimpleTrafficRates('main-bridge')
            ]);

            return {
                timestamp: new Date().toISOString(),
                interfaces: [ispTraffic, lanTraffic].filter(Boolean),
                total: {
                    rxRate: [ispTraffic, lanTraffic].reduce((sum, iface) => sum + (iface?.rxRate || 0), 0),
                    txRate: [ispTraffic, lanTraffic].reduce((sum, iface) => sum + (iface?.txRate || 0), 0)
                }
            };
        } catch (error) {
            console.error('Error getting bandwidth usage:', error);
            return {
                timestamp: new Date().toISOString(),
                interfaces: [],
                total: {
                    rxRate: 0,
                    txRate: 0
                }
            };
        }
    }

    // Monitor interface traffic with callback
    async monitorInterfaceTraffic(interfaceName, callback) {
        try {
            const stats = await this.executeCommand('/interface/monitor-traffic', [
                '=interface=' + interfaceName,
                '=once='
            ]);

            const traffic = stats[0] || {};
            const rxBitsPerSecond = parseInt(traffic['rx-bits-per-second'] || 0);
            const txBitsPerSecond = parseInt(traffic['tx-bits-per-second'] || 0);

            const data = {
                interface: interfaceName,
                rxRate: Math.max(0, rxBitsPerSecond / 8),
                txRate: Math.max(0, txBitsPerSecond / 8),
                rxBytes: parseInt(traffic['rx-byte'] || 0),
                txBytes: parseInt(traffic['tx-byte'] || 0),
                timestamp: Date.now()
            };

            if (callback && typeof callback === 'function') {
                callback(data);
            }

            return data;
        } catch (error) {
            console.error(`Error monitoring interface traffic for ${interfaceName}:`, error);
            return {
                interface: interfaceName,
                rxRate: 0,
                txRate: 0,
                rxBytes: 0,
                txBytes: 0,
                timestamp: Date.now()
            };
        }
    }

    // Get wireless traffic data
    async getWirelessTraffic() {
        try {
            const [wirelessInterfaces, wirelessRegistrations] = await Promise.all([
                this.getWirelessInterfaces(),
                this.getWirelessRegistrations()
            ]);

            const wirelessTrafficData = [];

            for (const wifiIface of wirelessInterfaces) {
                try {
                    const stats = await this.executeCommand('/interface/monitor-traffic', [
                        '=interface=' + wifiIface.name,
                        '=once='
                    ]);

                    const traffic = stats[0] || {};
                    const rxBitsPerSecond = parseInt(traffic['rx-bits-per-second'] || 0);
                    const txBitsPerSecond = parseInt(traffic['tx-bits-per-second'] || 0);

                    wirelessTrafficData.push({
                        name: wifiIface.name,
                        mode: wifiIface.mode,
                        band: wifiIface.band,
                        channel: wifiIface.channel,
                        frequency: wifiIface.frequency,
                        running: wifiIface.running,
                        disabled: wifiIface.disabled,
                        ssid: wifiIface.ssid,
                        security: wifiIface.security,
                        rxRate: Math.max(0, rxBitsPerSecond / 8),
                        txRate: Math.max(0, txBitsPerSecond / 8),
                        rxBytes: parseInt(traffic['rx-byte'] || 0),
                        txBytes: parseInt(traffic['tx-byte'] || 0),
                        rxPackets: parseInt(traffic['rx-packet'] || 0),
                        txPackets: parseInt(traffic['tx-packet'] || 0),
                        connectedClients: wirelessRegistrations.filter(reg => reg['interface'] === wifiIface.name).length,
                        timestamp: Date.now()
                    });
                } catch (error) {
                    console.error(`Error getting traffic for ${wifiIface.name}:`, error);
                    wirelessTrafficData.push({
                        name: wifiIface.name,
                        mode: wifiIface.mode,
                        band: wifiIface.band,
                        channel: wifiIface.channel,
                        frequency: wifiIface.frequency,
                        running: wifiIface.running,
                        disabled: wifiIface.disabled,
                        ssid: wifiIface.ssid,
                        security: wifiIface.security,
                        rxRate: 0,
                        txRate: 0,
                        rxBytes: 0,
                        txBytes: 0,
                        rxPackets: 0,
                        txPackets: 0,
                        connectedClients: 0,
                        timestamp: Date.now()
                    });
                }
            }

            return wirelessTrafficData;
        } catch (error) {
            console.error('Error getting wireless traffic:', error);
            return [];
        }
    }

    // Get interface statistics
    async getInterfaceStats() {
        try {
            const [interfaces, allAddresses] = await Promise.all([
                this.executeCommand('/interface/print'),
                this.executeCommand('/ip/address/print')
            ]);

            const interfaceList = interfaces || [];
            const addressList = allAddresses || [];

            // Filter to only include ISP-main and main-bridge interfaces
            const filteredInterfaces = interfaceList.filter(iface =>
                ['ISP-main', 'main-bridge'].includes(iface.name)
            );

            // Create a map of interface names to their IP addresses
            const interfaceIPMap = {};
            addressList.forEach(addr => {
                if (addr.interface && addr.address) {
                    if (!interfaceIPMap[addr.interface]) {
                        interfaceIPMap[addr.interface] = [];
                    }
                    interfaceIPMap[addr.interface].push(addr.address);
                }
            });

            // Process only the filtered interfaces
            const detailedStats = await Promise.all(
                filteredInterfaces.map(async (iface) => {
                    try {
                        const stats = await this.executeCommand('/interface/monitor-traffic', [
                            '=interface=' + iface.name,
                            '=once='
                        ]);

                        let ipAddress = null;
                        if (interfaceIPMap[iface.name]) {
                            ipAddress = interfaceIPMap[iface.name].join(', ');
                        } else {
                            const matchingKey = Object.keys(interfaceIPMap).find(key =>
                                key.toLowerCase() === iface.name.toLowerCase()
                            );
                            if (matchingKey) {
                                ipAddress = interfaceIPMap[matchingKey].join(', ');
                            }
                        }

                        // Process interface status properly
                        const isRunning = iface.running === 'true' || iface.running === true;
                        const isDisabled = iface.disabled === 'true' || iface.disabled === true;
                        const status = isDisabled ? 'Disabled' : (isRunning ? 'Running' : 'Down');

                        return {
                            name: iface.name || 'Unknown',
                            type: iface.type || 'Unknown',
                            status: status,
                            'mac-address': iface['mac-address'] || 'N/A',
                            ipAddress: ipAddress || 'N/A',
                            running: isRunning,
                            disabled: isDisabled,
                            stats: stats[0] || {},
                            // Add traffic data
                            rxBytes: parseInt(stats[0]?.['rx-byte'] || 0),
                            txBytes: parseInt(stats[0]?.['tx-byte'] || 0),
                            rxRate: parseInt(stats[0]?.['rx-bits-per-second'] || 0) / 8,
                            txRate: parseInt(stats[0]?.['tx-bits-per-second'] || 0) / 8
                        };
                    } catch (error) {
                        console.error(`Error processing interface ${iface.name}:`, error);

                        // Process interface status properly even on error
                        const isRunning = iface.running === 'true' || iface.running === true;
                        const isDisabled = iface.disabled === 'true' || iface.disabled === true;
                        const status = isDisabled ? 'Disabled' : (isRunning ? 'Running' : 'Down');

                        let ipAddress = null;
                        if (interfaceIPMap[iface.name]) {
                            ipAddress = interfaceIPMap[iface.name].join(', ');
                        } else {
                            const matchingKey = Object.keys(interfaceIPMap).find(key =>
                                key.toLowerCase() === iface.name.toLowerCase()
                            );
                            if (matchingKey) {
                                ipAddress = interfaceIPMap[matchingKey].join(', ');
                            }
                        }

                        return {
                            name: iface.name || 'Unknown',
                            type: iface.type || 'Unknown',
                            status: status,
                            'mac-address': iface['mac-address'] || 'N/A',
                            ipAddress: ipAddress || 'N/A',
                            running: isRunning,
                            disabled: isDisabled,
                            stats: {},
                            rxBytes: 0,
                            txBytes: 0,
                            rxRate: 0,
                            txRate: 0
                        };
                    }
                })
            );

            return detailedStats;
        } catch (error) {
            console.error('Error getting interface stats:', error);
            throw error;
        }
    }

    // Get wireless interfaces
    async getWirelessInterfaces() {
        try {
            const response = await this.executeCommand('/interface/wireless/print');

            const enhancedInterfaces = response.map(wifiIface => {
                return {
                    ...wifiIface,
                    name: wifiIface.name || 'Unknown',
                    mode: wifiIface.mode || 'N/A',
                    band: wifiIface.band || 'N/A',
                    channel: wifiIface.channel || 'N/A',
                    frequency: wifiIface.frequency || 'N/A',
                    running: wifiIface.running === 'true' || wifiIface.running === true,
                    disabled: wifiIface.disabled === 'true' || wifiIface.disabled === true,
                    ssid: wifiIface.ssid || 'N/A',
                    security: wifiIface.security || 'N/A',
                    'radio-name': wifiIface['radio-name'] || 'N/A',
                    'country': wifiIface['country'] || 'N/A',
                    'antenna-gain': wifiIface['antenna-gain'] || 'N/A',
                    'tx-power': wifiIface['tx-power'] || 'N/A',
                    'tx-power-mode': wifiIface['tx-power-mode'] || 'N/A'
                };
            });

            console.log(`Wireless Interfaces: Found ${enhancedInterfaces.length} interfaces`);
            return enhancedInterfaces;
        } catch (error) {
            console.error('Error getting wireless interfaces:', error);
            return [];
        }
    }

    // Get wireless registration table
    async getWirelessRegistrations() {
        try {
            const response = await this.executeCommand('/interface/wireless/registration-table/print');

            console.log('Raw wireless registration data:', response.length > 0 ? Object.keys(response[0]) : 'No data');

            const enhancedRegistrations = response.map(registration => {
                const signalStrength = registration['signal-strength'] || registration['signal-strength-chain0'] || 'N/A';
                const txRate = registration['tx-rate'] || 'N/A';
                const rxRate = registration['rx-rate'] || 'N/A';
                const uptime = registration['uptime'] || '0s';

                let signalValue = 'N/A';
                if (signalStrength !== 'N/A') {
                    const match = signalStrength.toString().match(/(-?\d+)/);
                    if (match) {
                        signalValue = match[1] + ' dBm';
                    }
                }

                return {
                    ...registration,
                    'mac-address': registration['mac-address'] || 'N/A',
                    'interface': registration['interface'] || 'N/A',
                    'signal-strength': signalValue,
                    'tx-rate': txRate,
                    'rx-rate': rxRate,
                    'uptime': uptime,
                    'last-seen': registration['last-seen'] || 'N/A',
                    'tx-signal-strength': registration['tx-signal-strength'] || 'N/A',
                    'tx-ccq': registration['tx-ccq'] || 'N/A',
                    'rx-ccq': registration['rx-ccq'] || 'N/A',
                    'packets': registration['packets'] || '0',
                    'bytes': registration['bytes'] || '0',
                    'last-ip': registration['last-ip'] || registration['address'] || 'N/A'
                };
            });

            console.log(`Wireless Registrations: Found ${enhancedRegistrations.length} connected clients`);
            if (enhancedRegistrations.length > 0) {
                console.log('Sample wireless registration:', {
                    mac: enhancedRegistrations[0]['mac-address'],
                    interface: enhancedRegistrations[0]['interface'],
                    signal: enhancedRegistrations[0]['signal-strength'],
                    lastIp: enhancedRegistrations[0]['last-ip']
                });
            }
            return enhancedRegistrations;
        } catch (error) {
            console.error('Error getting wireless registrations:', error);
            return [];
        }
    }

    // Get DHCP leases
    async getDHCPLeases() {
        try {
            const response = await this.executeCommand('/ip/dhcp-server/lease/print');
            return response || [];
        } catch (error) {
            console.error('Error getting DHCP leases:', error);
            throw error;
        }
    }

    // Get active connections
    async getActiveConnections() {
        try {
            const response = await this.executeCommand('/ip/firewall/connection/print');
            return response || [];
        } catch (error) {
            console.error('Error getting active connections:', error);
            // Fallback: try alternative command or return empty array
            try {
                const response = await this.executeCommand('/ip/firewall/connection/print', ['=limit=100']);
                return response || [];
            } catch (fallbackError) {
                console.error('Fallback command also failed:', fallbackError);
                return [];
            }
        }
    }

    // Get hotspot active connections
    async getHotspotActive() {
        try {
            const response = await this.executeCommand('/ip/hotspot/active/print');
            return response || [];
        } catch (error) {
            console.error('Error getting hotspot active connections:', error);
            return [];
        }
    }

    // Get firewall rules
    async getFirewallRules() {
        try {
            const response = await this.executeCommand('/ip/firewall/filter/print');
            return response || [];
        } catch (error) {
            console.error('Error getting firewall rules:', error);
            throw error;
        }
    }

    // Get system logs
    async getSystemLogs(limit = 50) {
        try {
            let response;
            try {
                response = await this.executeCommand('/log/print', [
                    `=limit=${limit}`
                ]);
            } catch (limitError) {
                console.log('Limit parameter not supported, fetching all logs');
                try {
                    response = await this.executeCommand('/log/print');
                } catch (noParamError) {
                    console.log('Log command not supported, returning empty array');
                    return [];
                }
            }
            return response || [];
        } catch (error) {
            console.error('Error getting system logs:', error);
            return [];
        }
    }

    // Get web proxy logs to see websites users are visiting
    async getWebProxyLogs(limit = 100) {
        try {
            let response;
            try {
                response = await this.executeCommand('/log/print', [
                    '?topics=web-proxy',
                    `?limit=${limit}`
                ]);
            } catch (topicsError) {
                console.log('Topics parameter not supported, trying without topics');
                try {
                    response = await this.executeCommand('/log/print', [`?limit=${limit}`]);
                } catch (limitError) {
                    console.log('Limit parameter not supported, trying basic log command');
                    try {
                        response = await this.executeCommand('/log/print');
                    } catch (basicError) {
                        console.log('Log command not supported, returning empty array');
                        return [];
                    }
                }
            }

            const webLogs = response || [];
            const websiteVisits = [];

            for (const log of webLogs) {
                try {
                    const message = log.message || '';

                    // Parse web proxy log messages
                    // Example: "web-proxy: 11.0.0.5:12345 GET http://example.com/page"
                    const proxyMatch = message.match(/web-proxy:\s+(\d+\.\d+\.\d+\.\d+):(\d+)\s+(GET|POST|PUT|DELETE)\s+(https?:\/\/[^\s]+)/);

                    if (proxyMatch) {
                        const [, ipAddress, port, method, url] = proxyMatch;
                        let domain = 'unknown';
                        try {
                            domain = new URL(url).hostname;
                        } catch (urlError) {
                            console.log('Error parsing URL:', url);
                        }

                        websiteVisits.push({
                            timestamp: log.time || new Date().toISOString(),
                            ipAddress,
                            port: parseInt(port),
                            method,
                            url,
                            domain,
                            userAgent: log['user-agent'] || 'N/A',
                            status: log.status || 'N/A',
                            bytes: parseInt(log.bytes) || 0
                        });
                    }
                } catch (parseError) {
                    console.error('Error parsing web proxy log:', parseError);
                }
            }

            return websiteVisits;
        } catch (error) {
            console.error('Error getting web proxy logs (web proxy may not be enabled):', error.message);
            return [];
        }
    }

    // Get connection tracking to see active connections and destinations
    async getConnectionTracking() {
        try {
            const response = await this.executeCommand('/ip/firewall/connection/print');

            const connections = response || [];
            const websiteConnections = [];

            for (const conn of connections) {
                try {
                    const protocol = conn.protocol || 'unknown';
                    const dstAddress = conn['dst-address'] || '';
                    const dstPort = conn['dst-port'] || '';
                    const srcAddress = conn['src-address'] || '';
                    const srcPort = conn['src-port'] || '';
                    const tcpState = conn['tcp-state'] || '';
                    const replyDstAddress = conn['reply-dst-address'] || '';
                    const replyDstPort = conn['reply-dst-port'] || '';

                    // Filter for HTTP/HTTPS connections
                    if (protocol === 'tcp' && (dstPort === '80' || dstPort === '443' || dstPort === '8080')) {
                        websiteConnections.push({
                            id: conn['.id'],
                            protocol,
                            srcAddress,
                            srcPort: parseInt(srcPort),
                            dstAddress,
                            dstPort: parseInt(dstPort),
                            replyDstAddress,
                            replyDstPort: parseInt(replyDstPort),
                            tcpState,
                            timeout: conn.timeout || 'N/A',
                            connectionMark: conn['connection-mark'] || 'N/A',
                            timestamp: new Date().toISOString()
                        });
                    }
                } catch (parseError) {
                    console.error('Error parsing connection:', parseError);
                }
            }

            return websiteConnections;
        } catch (error) {
            console.error('Error getting connection tracking (firewall may not be enabled):', error.message);
            return [];
        }
    }

    // Get DNS queries to see domain lookups
    async getDNSQueries(limit = 50) {
        try {
            let response;
            try {
                response = await this.executeCommand('/log/print', [
                    '?topics=dns',
                    `?limit=${limit}`
                ]);
            } catch (topicsError) {
                console.log('Topics parameter not supported, trying without topics');
                try {
                    response = await this.executeCommand('/log/print', [`?limit=${limit}`]);
                } catch (limitError) {
                    console.log('Limit parameter not supported, trying basic log command');
                    try {
                        response = await this.executeCommand('/log/print');
                    } catch (basicError) {
                        console.log('Log command not supported, returning empty array');
                        return [];
                    }
                }
            }

            const dnsLogs = response || [];
            const dnsQueries = [];

            for (const log of dnsLogs) {
                try {
                    const message = log.message || '';

                    // Parse DNS query messages
                    // Example: "dns: query[A] example.com from 11.0.0.5"
                    const dnsMatch = message.match(/dns:\s+query\[([A-Z]+)\]\s+([^\s]+)\s+from\s+(\d+\.\d+\.\d+\.\d+)/);

                    if (dnsMatch) {
                        const [, queryType, domain, ipAddress] = dnsMatch;

                        dnsQueries.push({
                            timestamp: log.time || new Date().toISOString(),
                            queryType,
                            domain,
                            ipAddress,
                            status: log.status || 'N/A'
                        });
                    }
                } catch (parseError) {
                    console.error('Error parsing DNS log:', parseError);
                }
            }

            return dnsQueries;
        } catch (error) {
            console.error('Error getting DNS queries (DNS logging may not be enabled):', error.message);
            return [];
        }
    }

    // Get web proxy access logs (if web proxy is enabled)
    async getWebProxyAccess() {
        try {
            const response = await this.executeCommand('/ip/proxy/access/print');

            const accessLogs = response || [];
            const websiteAccess = [];

            for (const access of accessLogs) {
                try {
                    websiteAccess.push({
                        id: access['.id'],
                        srcAddress: access['src-address'] || 'N/A',
                        dstAddress: access['dst-address'] || 'N/A',
                        dstPort: parseInt(access['dst-port']) || 0,
                        protocol: access.protocol || 'N/A',
                        method: access.method || 'N/A',
                        url: access.url || 'N/A',
                        domain: access.domain || 'N/A',
                        userAgent: access['user-agent'] || 'N/A',
                        status: access.status || 'N/A',
                        bytes: parseInt(access.bytes) || 0,
                        timestamp: access.time || new Date().toISOString()
                    });
                } catch (parseError) {
                    console.error('Error parsing web proxy access:', parseError);
                }
            }

            return websiteAccess;
        } catch (error) {
            console.error('Error getting web proxy access (web proxy may not be enabled):', error.message);
            return [];
        }
    }

    // Get real-time website monitoring data
    async getWebsiteMonitoring() {
        try {
            // Use Promise.allSettled to prevent one failing method from breaking everything
            const results = await Promise.allSettled([
                this.getWebProxyLogs(50),
                this.getConnectionTracking(),
                this.getDNSQueries(30),
                this.getWebProxyAccess()
            ]);

            // Extract results, handling both fulfilled and rejected promises
            const [webProxyLogsResult, connectionTrackingResult, dnsQueriesResult, webProxyAccessResult] = results;

            const webProxyLogs = webProxyLogsResult.status === 'fulfilled' ? webProxyLogsResult.value : [];
            const connectionTracking = connectionTrackingResult.status === 'fulfilled' ? connectionTrackingResult.value : [];
            const dnsQueries = dnsQueriesResult.status === 'fulfilled' ? dnsQueriesResult.value : [];
            const webProxyAccess = webProxyAccessResult.status === 'fulfilled' ? webProxyAccessResult.value : [];

            // Log any failures for debugging
            if (webProxyLogsResult.status === 'rejected') {
                console.log('Web proxy logs failed:', webProxyLogsResult.reason.message);
            }
            if (connectionTrackingResult.status === 'rejected') {
                console.log('Connection tracking failed:', connectionTrackingResult.reason.message);
            }
            if (dnsQueriesResult.status === 'rejected') {
                console.log('DNS queries failed:', dnsQueriesResult.reason.message);
            }
            if (webProxyAccessResult.status === 'rejected') {
                console.log('Web proxy access failed:', webProxyAccessResult.reason.message);
            }

            // Combine and process all website monitoring data
            const websiteData = {
                webProxyLogs,
                connectionTracking,
                dnsQueries,
                webProxyAccess,
                summary: {
                    totalWebVisits: webProxyLogs.length,
                    activeConnections: connectionTracking.length,
                    dnsQueries: dnsQueries.length,
                    uniqueDomains: [...new Set([
                        ...webProxyLogs.map(log => log.domain),
                        ...dnsQueries.map(query => query.domain)
                    ])].filter(Boolean).length
                }
            };

            return websiteData;
        } catch (error) {
            console.error('Error getting website monitoring data:', error);
            return {
                webProxyLogs: [],
                connectionTracking: [],
                dnsQueries: [],
                webProxyAccess: [],
                summary: {
                    totalWebVisits: 0,
                    activeConnections: 0,
                    dnsQueries: 0,
                    uniqueDomains: 0
                }
            };
        }
    }

    // Get website activity by user (IP address)
    async getWebsiteActivityByUser() {
        try {
            // Use Promise.allSettled to prevent one failing method from breaking everything
            const results = await Promise.allSettled([
                this.getWebProxyLogs(100),
                this.getDNSQueries(50)
            ]);

            const [webProxyLogsResult, dnsQueriesResult] = results;

            const webProxyLogs = webProxyLogsResult.status === 'fulfilled' ? webProxyLogsResult.value : [];
            const dnsQueries = dnsQueriesResult.status === 'fulfilled' ? dnsQueriesResult.value : [];

            // Log any failures for debugging
            if (webProxyLogsResult.status === 'rejected') {
                console.log('Web proxy logs failed in getWebsiteActivityByUser:', webProxyLogsResult.reason.message);
            }
            if (dnsQueriesResult.status === 'rejected') {
                console.log('DNS queries failed in getWebsiteActivityByUser:', dnsQueriesResult.reason.message);
            }

            const userActivity = {};

            // Process web proxy logs
            for (const log of webProxyLogs) {
                const ipAddress = log.ipAddress;
                if (!userActivity[ipAddress]) {
                    userActivity[ipAddress] = {
                        ipAddress,
                        webVisits: [],
                        dnsQueries: [],
                        totalVisits: 0,
                        uniqueDomains: new Set(),
                        lastActivity: log.timestamp
                    };
                }

                userActivity[ipAddress].webVisits.push({
                    url: log.url,
                    domain: log.domain,
                    method: log.method,
                    timestamp: log.timestamp
                });
                userActivity[ipAddress].totalVisits++;
                userActivity[ipAddress].uniqueDomains.add(log.domain);
                userActivity[ipAddress].lastActivity = log.timestamp;
            }

            // Process DNS queries
            for (const query of dnsQueries) {
                const ipAddress = query.ipAddress;
                if (!userActivity[ipAddress]) {
                    userActivity[ipAddress] = {
                        ipAddress,
                        webVisits: [],
                        dnsQueries: [],
                        totalVisits: 0,
                        uniqueDomains: new Set(),
                        lastActivity: query.timestamp
                    };
                }

                userActivity[ipAddress].dnsQueries.push({
                    domain: query.domain,
                    queryType: query.queryType,
                    timestamp: query.timestamp
                });
                userActivity[ipAddress].uniqueDomains.add(query.domain);
                userActivity[ipAddress].lastActivity = query.timestamp;
            }

            // Convert to array and format
            const formattedActivity = Object.values(userActivity).map(user => ({
                ...user,
                uniqueDomains: Array.from(user.uniqueDomains).length,
                uniqueDomainsList: Array.from(user.uniqueDomains)
            }));

            return formattedActivity;
        } catch (error) {
            console.error('Error getting website activity by user:', error);
            return [];
        }
    }

    // Get active users with their data usage
    async getActiveUsers() {
        try {
            const hotspotActive = await this.executeCommand('/ip/hotspot/active/print');
            const dhcpLeases = await this.executeCommand('/ip/dhcp-server/lease/print');
            const wirelessRegistrations = await this.executeCommand('/interface/wireless/registration-table/print');

            console.log(`Active Users Debug: Found ${hotspotActive.length} hotspot users, ${dhcpLeases.length} DHCP leases, ${wirelessRegistrations.length} wireless registrations`);

            const activeUsers = [];

            for (const hotspot of hotspotActive) {
                try {
                    const user = {
                        id: hotspot['.id'],
                        macAddress: hotspot['mac-address'] || 'N/A',
                        address: hotspot['address'] || 'N/A',
                        uptime: hotspot['uptime'] || '0s',
                        bytesIn: parseInt(hotspot['bytes-in'] || 0),
                        bytesOut: parseInt(hotspot['bytes-out'] || 0),
                        packetsIn: parseInt(hotspot['packets-in'] || 0),
                        packetsOut: parseInt(hotspot['packets-out'] || 0),
                        dynamic: hotspot['dynamic'] || false,
                        idleTimeout: hotspot['idle-timeout'] || 'N/A',
                        keepaliveTimeout: hotspot['keepalive-timeout'] || 'N/A',
                        loginBy: hotspot['login-by'] || 'N/A',
                        radius: hotspot['radius'] || false,
                        server: hotspot['server'] || 'N/A',
                        sessionId: hotspot['session-id'] || 'N/A',
                        limitBytesIn: parseInt(hotspot['limit-bytes-in'] || 0),
                        limitBytesOut: parseInt(hotspot['limit-bytes-out'] || 0),
                        limitBytesTotal: parseInt(hotspot['limit-bytes-total'] || 0),
                        radiusSessionId: hotspot['radius-session-id'] || 'N/A',
                        timestamp: Date.now()
                    };

                    // Find corresponding DHCP lease info
                    const dhcpInfo = dhcpLeases.find(lease =>
                        lease['mac-address'] &&
                        lease['mac-address'].toLowerCase() === user.macAddress.toLowerCase()
                    );

                    if (dhcpInfo) {
                        user.hostName = dhcpInfo['host-name'] || 'Unknown';
                        user.clientId = dhcpInfo['client-id'] || 'N/A';
                        user.activeAddress = dhcpInfo['active-address'] || 'N/A';
                        user.activeMacAddress = dhcpInfo['active-mac-address'] || 'N/A';
                        user.expiresAfter = dhcpInfo['expires-after'] || 'N/A';
                        user.blocked = dhcpInfo['blocked'] || false;
                        user.radius = dhcpInfo['radius'] || false;
                        user.dynamic = dhcpInfo['dynamic'] || false;
                        user.lastSeen = dhcpInfo['last-seen'] || 'N/A';
                    }

                    // Find wireless registration info for signal strength
                    // Try multiple matching strategies
                    let wirelessInfo = null;

                    // First try exact MAC match
                    wirelessInfo = wirelessRegistrations.find(reg =>
                        reg['mac-address'] &&
                        reg['mac-address'].toLowerCase() === user.macAddress.toLowerCase()
                    );

                    // If not found, try matching by IP address
                    if (!wirelessInfo && user.address !== 'N/A') {
                        wirelessInfo = wirelessRegistrations.find(reg =>
                            reg['last-ip'] && reg['last-ip'] === user.address
                        );
                    }

                    // If still not found, try matching by interface and IP
                    if (!wirelessInfo && user.address !== 'N/A') {
                        wirelessInfo = wirelessRegistrations.find(reg =>
                            reg['last-ip'] && reg['last-ip'] === user.address &&
                            reg['interface'] && reg['interface'] !== 'N/A'
                        );
                    }

                    if (wirelessInfo) {
                        console.log(`Found wireless info for user ${user.macAddress}:`, {
                            signalStrength: wirelessInfo['signal-strength'],
                            txRate: wirelessInfo['tx-rate'],
                            rxRate: wirelessInfo['rx-rate']
                        });

                        let signalStrength = wirelessInfo['signal-strength'];
                        if (signalStrength && signalStrength !== 'undefined' && signalStrength !== 'N/A') {
                            const signalMatch = signalStrength.toString().match(/(-?\d+)/);
                            if (signalMatch) {
                                user.signalStrength = signalMatch[1] + ' dBm';
                            } else {
                                user.signalStrength = signalStrength;
                            }
                        } else {
                            user.signalStrength = 'N/A';
                        }

                        user.txRate = wirelessInfo['tx-rate'] && wirelessInfo['tx-rate'] !== 'undefined' && wirelessInfo['tx-rate'] !== 'N/A' ? wirelessInfo['tx-rate'] : 'N/A';
                        user.rxRate = wirelessInfo['rx-rate'] && wirelessInfo['rx-rate'] !== 'undefined' && wirelessInfo['rx-rate'] !== 'N/A' ? wirelessInfo['rx-rate'] : 'N/A';
                        user.interface = wirelessInfo['interface'] && wirelessInfo['interface'] !== 'undefined' && wirelessInfo['interface'] !== 'N/A' ? wirelessInfo['interface'] : 'N/A';
                        user.radioName = wirelessInfo['radio-name'] && wirelessInfo['radio-name'] !== 'undefined' && wirelessInfo['radio-name'] !== 'N/A' ? wirelessInfo['radio-name'] : 'N/A';
                        user.registrationTime = wirelessInfo['registration-time'] && wirelessInfo['registration-time'] !== 'undefined' && wirelessInfo['registration-time'] !== 'N/A' ? wirelessInfo['registration-time'] : 'N/A';
                        user.connectionType = 'WiFi';
                    } else {
                        console.log(`No wireless info found for user ${user.macAddress} (IP: ${user.address})`);
                        user.signalStrength = 'N/A';
                        user.txRate = 'N/A';
                        user.rxRate = 'N/A';
                        user.interface = 'N/A';
                        user.radioName = 'N/A';
                        user.registrationTime = 'N/A';
                        user.connectionType = 'Unknown';
                    }

                    activeUsers.push(user);
                } catch (error) {
                    console.error(`Error processing hotspot user:`, error);
                }
            }

            console.log(`Active Users: Processed ${activeUsers.length} users`);
            return activeUsers;
        } catch (error) {
            console.error('Error getting active users:', error);
            return [];
        }
    }

    // Get most connected MAC addresses (for rewards)
    async getMostConnectedMACs() {
        try {
            const dhcpLeases = await this.executeCommand('/ip/dhcp-server/lease/print');
            let logs = [];
            try {
                logs = await this.executeCommand('/log/print');
            } catch (logError) {
                console.log('Could not fetch logs, continuing without log analysis');
                logs = [];
            }
            const hotspotActive = await this.executeCommand('/ip/hotspot/active/print');

            const macStats = {};

            dhcpLeases.forEach(lease => {
                const mac = lease['mac-address'];
                if (mac) {
                    if (!macStats[mac]) {
                        macStats[mac] = {
                            macAddress: mac,
                            hostName: lease['host-name'] || 'Unknown',
                            totalConnections: 0,
                            currentSession: false,
                            lastSeen: lease['last-seen'] || 'N/A',
                            totalUptime: 0,
                            totalDataUsed: 0,
                            connectionFrequency: 0,
                            isActive: false,
                            activeAddress: lease['active-address'] || 'N/A',
                            expiresAfter: lease['expires-after'] || 'N/A'
                        };
                    }

                    macStats[mac].totalConnections++;

                    if (lease['active-address']) {
                        macStats[mac].isActive = true;
                    }
                }
            });

            hotspotActive.forEach(session => {
                const mac = session['mac-address'];
                if (mac && macStats[mac]) {
                    macStats[mac].currentSession = true;
                    macStats[mac].totalDataUsed += parseInt(session['bytes-in'] || 0) + parseInt(session['bytes-out'] || 0);

                    const uptime = session['uptime'] || '0s';
                    const uptimeSeconds = this.parseUptimeToSeconds(uptime);
                    macStats[mac].totalUptime += uptimeSeconds;
                }
            });

            if (logs.length > 0) {
                logs.forEach(log => {
                    const message = log.message || '';
                    if (message.includes('DHCP lease') && message.includes('added')) {
                        const macMatch = message.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
                        if (macMatch) {
                            const mac = macMatch[0];
                            if (macStats[mac]) {
                                macStats[mac].connectionFrequency++;
                            }
                        }
                    }
                });
            }

            const sortedMACs = Object.values(macStats)
                .sort((a, b) => b.totalConnections - a.totalConnections)
                .slice(0, 20);

            return sortedMACs;
        } catch (error) {
            console.error('Error getting most connected MACs:', error);
            return [];
        }
    }

    // Helper function to parse uptime string to seconds
    parseUptimeToSeconds(uptime) {
        if (!uptime || typeof uptime !== 'string') return 0;

        const match = uptime.match(/(\d+)d(\d+)h(\d+)m(\d+)s/);
        if (match) {
            const days = parseInt(match[1]) || 0;
            const hours = parseInt(match[2]) || 0;
            const minutes = parseInt(match[3]) || 0;
            const seconds = parseInt(match[4]) || 0;
            return days * 86400 + hours * 3600 + minutes * 60 + seconds;
        }

        const simpleMatch = uptime.match(/(\d+)h(\d+)m(\d+)s/);
        if (simpleMatch) {
            const hours = parseInt(simpleMatch[1]) || 0;
            const minutes = parseInt(simpleMatch[2]) || 0;
            const seconds = parseInt(simpleMatch[3]) || 0;
            return hours * 3600 + minutes * 60 + seconds;
        }

        return 0;
    }

    // Get simple traffic rates for specific interface
    async getSimpleTrafficRates(interfaceName) {
        try {
            const stats = await this.executeCommand('/interface/monitor-traffic', [
                '=interface=' + interfaceName,
                '=once='
            ]);

            const traffic = stats[0] || {};

            const rxBitsPerSecond = parseInt(traffic['rx-bits-per-second'] || 0);
            const txBitsPerSecond = parseInt(traffic['tx-bits-per-second'] || 0);
            const rxPackets = parseInt(traffic['rx-packet'] || 0);
            const txPackets = parseInt(traffic['tx-packet'] || 0);

            const rxRate = rxBitsPerSecond / 8;
            const txRate = txBitsPerSecond / 8;

            const rxBytes = Math.floor(rxRate * 1000);
            const txBytes = Math.floor(txRate * 1000);

            return {
                name: interfaceName,
                rxBytes,
                txBytes,
                rxRate: Math.max(0, rxRate),
                txRate: Math.max(0, txRate),
                rxPackets,
                txPackets,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error(`Error getting simple traffic rates for ${interfaceName}:`, error);
            return {
                name: interfaceName,
                rxBytes: 0,
                txBytes: 0,
                rxRate: 0,
                txRate: 0,
                rxPackets: 0,
                txPackets: 0,
                timestamp: Date.now()
            };
        }
    }

    // Get RouterOS version
    async getRouterOSVersion() {
        try {
            const systemInfo = await this.getSystemInfo();
            return systemInfo['routeros-version'] || 'Unknown';
        } catch (error) {
            console.error('Error getting RouterOS version:', error);
            return 'Unknown';
        }
    }
}

module.exports = MikroTikAPI;
