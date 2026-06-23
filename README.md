# Ticketera de Eventos - Grupo 9

Este proyecto es la implementación de una arquitectura de microservicios asíncrona orientada a eventos para una ticketera de eventos con cupo limitado.

## Estructura del Monorepo

El monorepo está organizado de la siguiente manera:

- **/frontend**: Interfaz de usuario para clientes que interactúa con la API.
- **/backend**: Microservicios de negocio.
  - `/events`: API REST expuesta mediante ALB, maneja el CRUD de eventos y publica las solicitudes de compra en NATS.
  - `/inventory`: Worker NATS que procesa la validación y reserva atómica de stock en base de datos.
  - `/payments`: Worker NATS que simula el cobro ante una reserva exitosa o descarta la transacción si no hay cupo.
- **/terraform**: Definición de Infraestructura como Código (IaC) modularizada para despliegues repetibles en AWS (ECS Fargate, NATS, Cloud Map, etc.).

## Tecnologías Utilizadas

- **AWS ECS Fargate**: Orquestación de contenedores Serverless.
- **NATS (JetStream)**: Broker de mensajería asíncrona para la coreografía de eventos.
- **AWS Cloud Map**: Descubrimiento de servicios internos (DNS privado).
- **Terraform**: Gestión de infraestructura como código con Backend en S3 y bloqueo en DynamoDB.
