# Deployment Guide

## Production Setup with Docker Compose
```bash
docker-compose up -d --build
```

Services started:
- `app`: Workflow API server & frontend bundle running on Port 3000
- `mongodb`: MongoDB replica set on Port 27017
- `redis`: Redis cache and distributed worker queue on Port 6379

## Environment Variables
Ensure production variables are configured in `.env`:
```
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/workflow_engine
REDIS_URL=redis://redis:6379
JWT_SECRET=production_secret_key
API_KEY_SECRET=production_salt_key
```

## Scaling Worker Fleet
Horizontal scaling of worker processes:
```bash
docker-compose up -d --scale app=3
```
