# GuardWise Development Environment

## Quick Start with Docker

### Prerequisites
- Docker Desktop installed and running

### Start All Services
```bash
# Option 1: Double-click
start-dev.bat

# Option 2: Command line
docker-compose up --build
```

### Stop All Services
```bash
# Option 1: Double-click
stop-dev.bat

# Option 2: Command line
docker-compose down
```

### Service URLs
| Service | URL | Description |
|---------|-----|-------------|
| API Server | http://localhost:4000/api | Express backend |
| Platform Dashboard | http://localhost:8080 | Admin dashboard |
| Companion AI | http://localhost:8082 | Guard mobile app |
| Staff App | http://localhost:8081 | Field officer app |

### First-Time Setup

Credentials are **auto-generated** on first run. View them with:

```bash
docker-compose logs api | grep -A 20 "INITIAL CREDENTIALS"
```

**⚠️ Important:** Save these credentials immediately - they won't be shown again!

For subsequent logins, use the credentials that were printed during initial setup.

### Development Notes
- Source code is mounted as volumes, so changes will hot-reload
- Database is persisted in a Docker volume (`api-data`)
- To reset the database, run: `docker-compose down -v`

### Individual Services
```bash
# Run only specific services
docker-compose up api platform
docker-compose up api companion-ai
docker-compose up api staff-app
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f platform
```
