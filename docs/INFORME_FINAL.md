# Informe Final - Proyecto IntegraHub

## 1. Identificación y Análisis del Problema
**Contexto**: Una empresa mediana de retail ha crecido orgánicamente, resultando en un ecosistema de sistemas heterogéneos (Legacy, ERPs, ventas online) que operan en silos. Esto genera ineficiencias operativas, falta de trazabilidad en los pedidos y riesgos de pérdida de datos.

**Análisis de Factores**:
- **Económico**: La falta de integración automática aumenta los costos operativos por trabajo manual y errores de digitación (pérdida de ingresos por stock desactualizado).
- **Ambiental**: Al optimizar la logística y reducir el uso de papel (digitalización de procesos legacy), se reduce la huella de carbono de la operación.
- **Social/Cultural**: La transformación digital demanda un cambio cultural hacia la agilidad y la transparencia de datos, empoderando a los equipos de operaciones con información en tiempo real.
- **Tecnológico**: El reto es integrar tecnologías modernas (Cloud, APIs) con sistemas heredados (CSV/Archivos) sin interrumpir la operación.

**Definición del Problema**: Necesidad urgente de una plataforma de integración ("IntegraHub") robusta, escalable y segura que orqueste el flujo Order-to-Cash, garantizando la integridad de datos y la resiliencia ante fallos.

## 2. Propuesta de Solución
**Arquitectura**: Se propone una arquitectura **Microservicios** basada en **Event-Driven Architecture (EDA)**.
- **Componentes Clave**:
  - **API Gateway (Nginx)**: Punto único de entrada seguro.
  - **Message Broker (RabbitMQ)**: Desacoplamiento asíncrono para escalabilidad y resiliencia.
  - **Servicios Especializados**: Orders, Inventory, Payments, Notifications, Analytics.
  - **Legacy Adapter**: Patrón *Channel Adapter* para integrar sistemas basados en archivos.

**Innovación**: Implementación de un "Demo Portal" en tiempo real usando **Server-Sent Events (SSE)** para visibilidad operativa inmediata, combinando patrones de integración clásicos con UX moderna.

## 3. Evaluación y Justificación de la Solución
**Selección de Tecnologías**:
- **RabbitMQ vs Kafka**: Se seleccionó RabbitMQ por su soporte nativo de patrones de enrutamiento complejos (Topics, Routing Keys) necesarios para la orquestación de pedidos, frente a Kafka que es más adecuado para streaming masivo de datos crudos. Para el volumen esperado en una empresa mediana, RabbitMQ ofrece mejor latencia y garantías de entrega.
- **Node.js**: Por su modelo I/O no bloqueante, ideal para microservicios que manejan alta concurrencia de red y eventos.
- **PostgreSQL**: Base de datos relacional robusta para la integridad transaccional de los pedidos.

**Factibilidad**:
- **Técnica**: Uso de contenedores Docker asegura portabilidad y consistencia entre desarrollo y producción.
- **Económica**: Stack Open Source (Node, Postgres, RabbitMQ) sin costos de licenciamiento.

## 4. Plan de Trabajo y Metodología
**Metodología**: Se utilizó un enfoque **Ágil / Iterativo e Incremental**.
- **Fase 1: Core & Infraestructura**: Setup de Docker Compose y RabbitMQ.
- **Fase 2: Servicios Base**: Implementación de Orders e Inventory.
- **Fase 3: Resiliencia & Seguridad**: Implementación de Circuit Breaker, Retries, DLQ y JWT.
- **Fase 4: Frontend & Observabilidad**: Desarrollo del Portal y Analytics.
- **Fase 5: Integración Legacy**: Adaptador de archivos.

**Gestión**: Uso de Git para control de versiones y Docker para gestión de dependencias.

## 5. Implementación de la Solución
La solución cumple con todos los requisitos funcionales:
- **Flujo E2E**: Creación de pedido -> Validación Inventario -> Pago -> Confirmación.
- **Integración Legacy**: Ingesta automática de CSVs.
- **Analítica**: Dashboard de métricas en tiempo real.

**Patrones de Integración Implementados**:
1.  **Point-to-Point**: Colas de trabajo para tareas críticas.
2.  **Publish/Subscribe**: Eventos de dominio (`order.created`) para notificaciones y analítica.
3.  **Message Translator**: Normalización de datos del CSV legacy a estructura JSON estándar.
4.  **Dead Letter Channel**: Manejo de mensajes fallidos en `payments_dlq`.
5.  **Idempotent Consumer**: Control de duplicados mediante `correlation_id`.

## 6. Pruebas y Validación
**Estrategia de Pruebas**:
- **Pruebas Unitarias/Integración**: Validación de lógica de negocio en servicios.
- **Pruebas de Carga/Resiliencia**: Simulación de fallos en Pasarela de Pagos (Circuit Breaker) y desconexión de RabbitMQ.
- **Seguridad**: Validación de tokens JWT (casos válidos e inválidos).

**Evidencias**:
- **Postman Collection**: `docs/postman_collection.json` con escenarios de éxito y error.
- **Demo Portal**: Evidencia visual del flujo y manejo de errores en tiempo real.

## 7. Conclusiones y Lecciones Aprendidas
- La arquitectura orientada a eventos aumenta significativamente la resiliencia del sistema, permitiendo que componentes (como Analytics) fallen sin detener el flujo principal.
- La integración de sistemas Legacy requiere mecanismos robustos de manejo de errores (archivos corruptos) que no deben afectar la estabilidad del resto de la plataforma.
- La seguridad debe ser una capa transversal (Gateway + Servicios) y no un afterthought.
