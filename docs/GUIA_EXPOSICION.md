# Guía de Defensa y Exposición - IntegraHub

Esta guía está diseñada para cubrir los **15 minutos** de la defensa final.

---

## 🕒 Parte 1: Presentación (2-3 minutos)
*Objetivo: Mostrar claridad en el problema y la solución arquitectónica.*

### 1. El Problema (Slide 1)
*   **Narrativa**: "Buenas tardes. Nuestro proyecto nace de la necesidad de una empresa mediana de Retail que tiene sus sistemas desconectados. Tienen un sistema de archivos para pedidos legacy, un e-commerce nuevo, y pagos por otro lado."
*   **Impacto**: "Esto genera pérdida de pedidos, inventarios desactualizados y costos manuales altos."

### 2. La Solución y Arquitectura (Slide 2 - Mostrar Diagrama C4)
*   **Narrativa**: "Diseñamos **IntegraHub**, una plataforma de integración basada en **Eventos**."
*   **Componentes Clave**:
    *   **API Gateway**: Centraliza la seguridad y el tráfico.
    *   **RabbitMQ**: El corazón del sistema. Desacopla los servicios para que si uno falla, el resto siga funcionando.
    *   **Microservicios**: Orders, Payments, Inventory. Cada uno con una responsabilidad única.
    *   **Legacy Adapter**: Un servicio especial que escucha una carpeta FTP/Local para integrar los archivos antiguos automáticamente.

### 3. Patrones y Decisiones (Slide 3)
*   **¿Por qué EDA (Event-Driven)?**: Para resiliencia. Si Pagos se cae, el pedido no se pierde, queda en la cola.
*   **¿Por qué RabbitMQ?**: Necesitábamos enrutamiento complejo (Topics) para diferenciar eventos de inventario de los de pagos, algo que RabbitMQ maneja mejor que Kafka para volúmenes transaccionales medios.

---

## 💻 Parte 2: Demo en Vivo (8-10 minutos)
*Objetivo: Evidenciar que el sistema funciona "End-to-End" y maneja fallos.*

### Paso 1: "Happy Path" (Creación de Pedido)
1.  **Acción**: Abrir el **Demo Portal** (`localhost:3000`). Mostrar que el sistema está "Operational".
2.  **Acción**: Abrir **RabbitMQ** (`localhost:15672`).
3.  **Acción**: En el Portal, llenar el formulario y crear un pedido.
4.  **Explicación**: "Miren como al crear el pedido, inmediatamente aparece en el log de eventos a la derecha. Eso es **SSE (Server-Sent Events)** en tiempo real."
5.  **Explicación**: "El pedido pasó de `CREATED` a `CONFIRMED` asíncronamente. El Gateway recibió el POST, Orders publicó el evento, Inventory reservó stock y Payments cobró."

### Paso 2: Integración Legacy (Archivos)
1.  **Acción**: Mostrar la carpeta `legacy_dropzone` (vacía).
2.  **Acción**: Arrastrar el archivo `test_order.csv` a esa carpeta.
3.  **Acción**: Volver al Portal rápidamente.
4.  **Explicación**: "Automáticamente, el servicio Legacy detectó el archivo, lo validó, se autenticó con JWT y creó el pedido en el sistema central. Aquí lo vemos en pantalla."

### Paso 3: Seguridad (JWT)
1.  **Acción**: Abrir **Postman**.
2.  **Acción**: Ejecutar la request "Create Order" **SIN** token o con token inválido.
3.  **Resultado**: Mostrar el error `401 Unauthorized`.
4.  **Explicación**: "Nuestras APIs están protegidas. Solo servicios autenticados o usuarios logueados pueden inyectar pedidos."

### Paso 4: Resiliencia y Circuit Breaker (El clímax de la demo)
1.  **Contexto**: "Ahora vamos a simular que la pasarela de pagos se cae o está lenta."
2.  **Acción**: (Opcional si hay tiempo) Puedes ver los logs del servicio `payments` donde simula fallos aleatorios (30%).
3.  **Acción**: Lanzar varios pedidos seguidos en el Portal.
4.  **Explicación**: "Si el pago falla, el sistema no crashea. Tenemos un **Circuit Breaker** que, tras varios fallos, 'abre el circuito' para dejar de intentar y no saturar el sistema externo. Además, los mensajes fallidos van a una **DLQ (Dead Letter Queue)**."
5.  **Evidencia**: Mostrar la cola `payments_dlq` en RabbitMQ si algún mensaje falló definitivamente.

### Paso 5: Analítica
1.  **Acción**: Hacer click en `/api/analytics` o mostrar el JSON de métricas.
2.  **Explicación**: "Tenemos un servicio sidecar que escucha todo lo que pasa en RabbitMQ sin afectar el rendimiento de los pedidos, generando métricas en tiempo real."

---

## ❓ Parte 3: Preguntas Frecuentes (Q&A)

**P: ¿Qué pasa si RabbitMQ se cae?**
R: Los servicios tienen una política de reintentos (Retries) al arrancar. Si se cae en operación, los servicios de borde (Orders) pueden guardar en BD local y re-encolar cuando vuelva (Patrón Store-and-Forward).

**P: ¿Por qué no usaron Kafka?**
R: Para este volumen de transacciones y la necesidad de enrutamiento inteligente (Routing Keys), RabbitMQ es más eficiente y menos complejo de operar que Kafka. Kafka es mejor para streaming masivo de datos (millones/seg), lo cual excede el alcance de este MVP.

**P: ¿Cómo garantizan que no se dupliquen pedidos (Idempotencia)?**
R: Cada pedido genera un `correlation_id` único desde el inicio. Los consumidores verifican si ya procesaron ese ID antes de efectuar cambios de estado.
