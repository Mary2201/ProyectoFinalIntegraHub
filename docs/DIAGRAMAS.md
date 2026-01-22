# Diagramas de Arquitectura y Flujo (Evidencias)

## 1. Diagrama C4 - Nivel Contexto
```mermaid
C4Context
    title Diagrama de Contexto - Sistema IntegraHub
    Person(customer, "Cliente", "Usuario que realiza pedidos via Web o API")
    Person(operations, "Operador", "Personal que monitorea el sistema")
    System(integrahub, "IntegraHub", "Plataforma de integración de pedidos")
    System_Ext(legacy, "Sistema Legacy", "Genera archivos CSV diarios")
    System_Ext(payment_gw, "Pasarela de Pagos", "Procesa cobros (Simulado)")

    Rel(customer, integrahub, "Crea Pedidos", "HTTPS/JSON")
    Rel(operations, integrahub, "Monitorea Estado", "HTTPS/Dashboard")
    Rel(legacy, integrahub, "Sube Archivos CSV", "SFTP/Folder")
    Rel(integrahub, payment_gw, "Procesa Pagos", "HTTPS/API")
```

## 2. Diagrama C4 - Nivel Contenedor
```mermaid
C4Container
    title Diagrama de Contenedores - IntegraHub
    
    Person(user, "Cliente", "Usa el Demo Portal")
    
    Container(frontend, "Demo Portal", "React/Vite", "Interfaz de usuario para demos")
    Container(gateway, "API Gateway", "Nginx", "Enrutamiento y seguridad")
    
    ContainerDb(db, "Base de Datos", "PostgreSQL", "Persistencia de pedidos")
    ContainerQueue(rabbitmq, "Event Bus", "RabbitMQ", "Comunicación asíncrona")

    Container(orders, "Order Service", "Node.js", "Recibe pedidos y orquesta")
    Container(inventory, "Inventory Service", "Node.js", "Valida stock")
    Container(payments, "Payment Service", "Node.js", "Procesa pagos (Circuit Breaker)")
    Container(analytics, "Analytics Service", "Node.js", "Streaming de métricas")
    Container(notifications, "Notif. Service", "Node.js", "Webhooks y SSE")
    Container(legacy, "Legacy Adapter", "Node.js", "Watcher de archivos CSV")

    Rel(user, frontend, "Usa", "HTTPS")
    Rel(frontend, gateway, "Llamadas API", "HTTPS")
    Rel(gateway, orders, "Proxy", "HTTP")
    Rel(gateway, analytics, "Proxy", "HTTP")
    
    Rel(orders, db, "Guarda Pedido", "SQL")
    Rel(orders, rabbitmq, "Publica OrderCreated", "AMQP")
    
    Rel(rabbitmq, inventory, "Consume Eventos", "AMQP")
    Rel(rabbitmq, payments, "Consume Eventos", "AMQP")
    Rel(rabbitmq, analytics, "Consume Eventos", "AMQP")
    
    Rel(legacy, orders, "Crea Pedido (HTTP)", "Rest API")
```

## 3. Diagrama de Secuencia: Create Order (E2E)
```mermaid
sequenceDiagram
    participant User
    participant API as Orders API
    participant DB
    participant Bus as RabbitMQ
    participant Inv as Inventory
    participant Pay as Payment

    User->>API: POST /orders (JWT)
    API->>API: Valida Token
    API->>DB: INSERT (Status: CREATED)
    API->>Bus: Pub OrderCreated
    API-->>User: 201 Created (CorrelationID)
    
    Bus->>Inv: OrderCreated
    Inv->>Bus: Pub InventoryReserved
    
    Bus->>Pay: InventoryReserved
    Pay->>Pay: CircuitBreaker.fire()
    Pay->>Bus: Pub PaymentProcessed
    
    Bus->>API: PaymentProcessed
    API->>DB: UPDATE (Status: CONFIRMED)
```

## 4. Diagrama de Secuencia: Fallo + DLQ
```mermaid
sequenceDiagram
    participant Bus as RabbitMQ
    participant Pay as Payment Service
    participant PayGW as Mock Gateway
    participant DLQ as Dead Letter Queue

    Bus->>Pay: InventoryReserved
    Pay->>PayGW: Process Payment
    PayGW-->>Pay: Timeout / Error 500
    Pay->>Pay: Retry x3
    Pay-->>Bus: NACK (Failed)
    Bus->>DLQ: Send to payments_dlq
    Note right of DLQ: Mensaje almacenado para revisión manual
```
