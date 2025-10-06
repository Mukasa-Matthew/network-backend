# MikroTik Router Monitoring Backend

A Node.js backend application for monitoring and managing MikroTik routers in real-time.

## Features

- **Router Authentication**: Secure login with MikroTik router credentials
- **Real-time Monitoring**: Live performance metrics and network statistics
- **RESTful API**: Comprehensive API endpoints for router management
- **WebSocket Support**: Real-time data streaming via Socket.IO
- **Security**: JWT authentication, rate limiting, and input validation
- **Comprehensive Data**: CPU, memory, bandwidth, interfaces, wireless, DHCP, and more

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Access to a MikroTik router with API enabled
- RouterOS API access (port 8728 by default)

## Installation

1. Clone the repository and navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```env
# Server Configuration
PORT=5000
HOST=localhost
NODE_ENV=development

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Monitoring Configuration
MONITORING_INTERVAL=5000
MAX_DATA_POINTS=100
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000` (or the port specified in your .env file).

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login to MikroTik router
- `POST /api/auth/logout` - Logout from router
- `GET /api/auth/verify` - Verify authentication token

### Router Information
- `GET /api/router/info` - Get router system information
- `GET /api/router/interfaces` - Get interface statistics
- `GET /api/router/wireless` - Get wireless information
- `GET /api/router/dhcp-leases` - Get DHCP leases
- `GET /api/router/connections` - Get active connections
- `GET /api/router/firewall` - Get firewall rules
- `GET /api/router/logs` - Get system logs
- `GET /api/router/bandwidth` - Get bandwidth usage

### Real-time Monitoring
- `GET /api/monitoring/realtime` - Get real-time monitoring data
- `POST /api/monitoring/start-monitoring/:interface` - Start interface monitoring
- `GET /api/monitoring/performance` - Get performance metrics
- `GET /api/monitoring/network-stats` - Get network statistics
- `GET /api/monitoring/wireless-stats` - Get wireless statistics
- `GET /api/monitoring/health` - Get system health status
- `GET /api/monitoring/config` - Get monitoring configuration

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Login Request Example
```json
{
  "ipAddress": "192.168.1.1",
  "username": "admin",
  "password": "your-password"
}
```

### Login Response Example
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "routerInfo": {
    "ipAddress": "192.168.1.1",
    "username": "admin",
    "model": "RB951Ui-2HnD",
    "version": "6.48.3",
    "uptime": "2d 15:30:45"
  }
}
```

## WebSocket Events

The application uses Socket.IO for real-time communication:

### Client Events
- `join-monitoring` - Join monitoring room for a specific router

### Server Events
- `interface-traffic` - Real-time interface traffic data

### WebSocket Connection Example
```javascript
const socket = io('http://localhost:5000');

// Join monitoring for a specific router
socket.emit('join-monitoring', 'router-id');

// Listen for real-time traffic data
socket.on('interface-traffic', (data) => {
  console.log('Interface traffic:', data);
});
```

## Data Structure

### System Resources
```json
{
  "cpu-load": "5",
  "cpu-count": "1",
  "total-memory": "131072",
  "free-memory": "65536",
  "uptime": "2d 15:30:45"
}
```

### Interface Statistics
```json
{
  "name": "ether1",
  "type": "ether",
  "running": true,
  "stats": {
    "rx-byte": "1024000",
    "tx-byte": "512000",
    "rx-packet": "1000",
    "tx-packet": "500"
  }
}
```

### Performance Metrics
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "cpu": {
    "load": 5,
    "count": 1
  },
  "memory": {
    "total": 131072,
    "free": 65536,
    "used": 65536,
    "usagePercentage": 50
  },
  "uptime": "2d 15:30:45",
  "bandwidth": [...],
  "interfaces": 5
}
```

## Security Considerations

1. **Change JWT Secret**: Always change the default JWT secret in production
2. **Use HTTPS**: Enable HTTPS in production environments
3. **Rate Limiting**: The API includes rate limiting to prevent abuse
4. **Input Validation**: All inputs are validated using express-validator
5. **CORS Configuration**: Configure CORS properly for your frontend domain
6. **Router Security**: Ensure your MikroTik router has proper security settings

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Development

### Project Structure
```
backend/
├── config/
│   └── config.js          # Application configuration
├── middleware/
│   └── auth.js            # Authentication middleware
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── router.js          # Router management routes
│   └── monitoring.js      # Monitoring routes
├── services/
│   └── mikrotik-api.js    # MikroTik API service
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

### Adding New Features

1. **New Routes**: Add new route files in the `routes/` directory
2. **New Services**: Add new service files in the `services/` directory
3. **Middleware**: Add new middleware in the `middleware/` directory
4. **Configuration**: Update `config/config.js` for new settings

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check router IP, credentials, and API access
2. **Authentication Errors**: Verify JWT token and session validity
3. **Permission Denied**: Ensure router user has API access permissions
4. **Rate Limiting**: Reduce request frequency if hitting rate limits

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

## License

This project is licensed under the ISC License.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Check MikroTik router logs
4. Verify network connectivity to the router







