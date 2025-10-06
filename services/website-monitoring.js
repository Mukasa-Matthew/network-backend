const RouterOS = require('node-routeros').RouterOSAPI;

class WebsiteMonitoringService {
    constructor(connection) {
        this.connection = connection;
        this.mikrotik = new RouterOSAPI(connection);
    }

    async getWebProxyLogs(limit = 100) {
        try {
            const logs = await this.mikrotik.write('/log/print', [
                '=.proplist=time,topics,message',
                '?topics~web-proxy',
                `?limit=${limit}`
            ]);

            return this.parseWebProxyLogs(logs);
        } catch (error) {
            console.error('Error fetching web proxy logs:', error);
            return [];
        }
    }

    async getDNSQueries(limit = 100) {
        try {
            const queries = await this.mikrotik.write('/log/print', [
                '=.proplist=time,topics,message',
                '?topics~dns',
                `?limit=${limit}`
            ]);

            return this.parseDNSQueries(queries);
        } catch (error) {
            console.error('Error fetching DNS queries:', error);
            return [];
        }
    }

    async getActiveConnections() {
        try {
            const connections = await this.mikrotik.write('/ip/firewall/connection/print', [
                '=.proplist=src-address,dst-address,protocol,reply-src-address,reply-dst-address,timeout,connection-mark'
            ]);

            return this.parseActiveConnections(connections);
        } catch (error) {
            console.error('Error fetching active connections:', error);
            return [];
        }
    }

    async getWebProxyStats() {
        try {
            const stats = await this.mikrotik.write('/ip/proxy/print', [
                '=.proplist=name,enabled,address,port,parent-proxy,parent-proxy-port'
            ]);

            return this.parseWebProxyStats(stats);
        } catch (error) {
            console.error('Error fetching web proxy stats:', error);
            return null;
        }
    }

    parseWebProxyLogs(logs) {
        return logs.map(log => {
            const message = log.message || '';

            // Parse web proxy log format
            const match = message.match(/(\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+) (\S+)/);
            if (match) {
                const [, timestamp, srcIP, dstIP, method, url, status, bytes, userAgent, referer] = match;

                return {
                    timestamp: new Date(timestamp).toISOString(),
                    srcIP,
                    dstIP,
                    method: method.toUpperCase(),
                    url,
                    domain: this.extractDomain(url),
                    status: parseInt(status),
                    bytes: parseInt(bytes),
                    userAgent,
                    referer
                };
            }

            return null;
        }).filter(log => log !== null);
    }

    parseDNSQueries(queries) {
        return queries.map(query => {
            const message = query.message || '';

            // Parse DNS query format
            const match = message.match(/DNS query from (\S+) for (\S+) type (\S+)/);
            if (match) {
                const [, srcIP, domain, queryType] = match;

                return {
                    timestamp: new Date(query.time).toISOString(),
                    srcIP,
                    domain,
                    queryType: queryType.toUpperCase()
                };
            }

            return null;
        }).filter(query => query !== null);
    }

    parseActiveConnections(connections) {
        return connections.map(conn => {
            return {
                srcIP: conn['src-address'],
                dstIP: conn['dst-address'],
                protocol: conn.protocol,
                replySrcIP: conn['reply-src-address'],
                replyDstIP: conn['reply-dst-address'],
                timeout: conn.timeout,
                connectionMark: conn['connection-mark']
            };
        });
    }

    parseWebProxyStats(stats) {
        if (stats.length === 0) return null;

        const proxy = stats[0];
        return {
            name: proxy.name,
            enabled: proxy.enabled === 'true',
            address: proxy.address,
            port: proxy.port,
            parentProxy: proxy['parent-proxy'],
            parentProxyPort: proxy['parent-proxy-port']
        };
    }

    extractDomain(url) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `http://${url}`);
            return urlObj.hostname;
        } catch (error) {
            // If URL parsing fails, try to extract domain manually
            const domainMatch = url.match(/(?:https?:\/\/)?([^\/\s]+)/);
            return domainMatch ? domainMatch[1] : url;
        }
    }

    async getWebsiteMonitoringData() {
        try {
            const [webProxyLogs, dnsQueries, activeConnections, webProxyStats] = await Promise.all([
                this.getWebProxyLogs(50),
                this.getDNSQueries(50),
                this.getActiveConnections(),
                this.getWebProxyStats()
            ]);

            // Process and aggregate data
            const summary = this.generateSummary(webProxyLogs, dnsQueries, activeConnections);
            const recentActivity = this.getRecentActivity(webProxyLogs);
            const userActivity = this.getUserActivity(webProxyLogs, dnsQueries);

            return {
                summary,
                recentActivity,
                userActivity,
                webProxyStats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting website monitoring data:', error);
            throw error;
        }
    }

    generateSummary(webProxyLogs, dnsQueries, activeConnections) {
        const uniqueIPs = new Set();
        const domains = new Set();
        let totalBytes = 0;
        let totalRequests = 0;

        webProxyLogs.forEach(log => {
            uniqueIPs.add(log.srcIP);
            domains.add(log.domain);
            totalBytes += log.bytes;
            totalRequests++;
        });

        // Find most active domain
        const domainCounts = {};
        webProxyLogs.forEach(log => {
            domainCounts[log.domain] = (domainCounts[log.domain] || 0) + 1;
        });

        const topDomain = Object.entries(domainCounts)
            .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A';

        return {
            totalWebVisits: totalRequests,
            uniqueVisitors: uniqueIPs.size,
            uniqueDomains: domains.size,
            totalBytes,
            topDomain,
            dnsQueries: dnsQueries.length
        };
    }

    getRecentActivity(webProxyLogs) {
        return webProxyLogs.slice(0, 20).map((log, index) => ({
            id: index + 1,
            domain: log.domain,
            method: log.method,
            timestamp: log.timestamp,
            user: log.srcIP,
            status: log.status,
            bytes: log.bytes,
            url: log.url
        }));
    }

    getUserActivity(webProxyLogs, dnsQueries) {
        const userMap = new Map();

        // Process web proxy logs
        webProxyLogs.forEach(log => {
            if (!userMap.has(log.srcIP)) {
                userMap.set(log.srcIP, {
                    user: log.srcIP,
                    totalVisits: 0,
                    totalBytes: 0,
                    domains: new Set(),
                    lastActivity: log.timestamp,
                    webVisits: [],
                    dnsQueries: []
                });
            }

            const user = userMap.get(log.srcIP);
            user.totalVisits++;
            user.totalBytes += log.bytes;
            user.domains.add(log.domain);
            user.webVisits.push({
                timestamp: log.timestamp,
                domain: log.domain,
                method: log.method,
                url: log.url
            });

            if (new Date(log.timestamp) > new Date(user.lastActivity)) {
                user.lastActivity = log.timestamp;
            }
        });

        // Process DNS queries
        dnsQueries.forEach(query => {
            if (userMap.has(query.srcIP)) {
                const user = userMap.get(query.srcIP);
                user.dnsQueries.push({
                    timestamp: query.timestamp,
                    domain: query.domain,
                    queryType: query.queryType
                });
            }
        });

        // Convert to array format
        return Array.from(userMap.values()).map(user => ({
            user: user.user,
            totalVisits: user.totalVisits,
            lastActivity: user.lastActivity,
            topDomains: Array.from(user.domains).slice(0, 5),
            totalBytes: user.totalBytes,
            webVisits: user.webVisits.slice(0, 10),
            dnsQueries: user.dnsQueries.slice(0, 10)
        }));
    }
}

module.exports = WebsiteMonitoringService;
