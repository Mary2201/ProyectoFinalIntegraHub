# IntegraHub

Enterprise Integration Platform for Order-to-Cash flows using Microservices, Event-Driven Architecture, and Legacy Integration.

## Architecture
- **Order Service**: Producer, REST API (Node.js/Express)
- **Inventory Service**: Consumer, Stock Validation (Node.js)
- **Payment Service**: Consumer, Circuit Breaker (Node.js)
- **Legacy Service**: File Watcher for CSV integration.
- **Notification Service**: SSE Stream for Dashboard.
- **Frontend**: React + Tailwind (via Vite).
- **Infrastructure**: RabbitMQ, PostgreSQL.

## Prerequisites
- Docker & Docker Compose
- Node.js (optional, for local dev)

## Quick Start
Run the entire platform with a single command:

```bash
docker compose up -d --build
```

Access the Demo Portal at: http://localhost:3000

## API Documentation
- **Authentication**: `POST /api/orders/auth/login` (Body: `{ "username": "admin", "password": "password" }`) -> Returns JWT.
- **Create Order**: `POST http://localhost:3000/api/orders/orders`
  - Headers: `Authorization: Bearer <your-token>`
  - Body: `{ "customer_id": "123", "items": [...], "total_amount": 100 }`
- **Analytics**: `GET http://localhost:3000/api/analytics`

## Features demonstrated
- **Security**: JWT Authentication (admin/password).
- **Sync/Async**: REST -> RabbitMQ.
- **Analytics**: Real-time event consumption and metrics API.
- **Resilience**: Circuit Breaker on Payments, Retries on DB/Rabbit connect.
- **Legacy**: Drop a file in `legacy_dropzone/` to auto-import orders (Requires Authentication, handled automatically).
- **Observability**: Real-time event log in Dashboard.
