# Vinyl Store — Ricardo Crespo

Proyecto individual de Desarrollo de Interfaces (módulo 0488).

Aplicación de gestión de una tienda de vinilos, con catálogo,
control de existencias y reservas para recoger en tienda.

## Estado del proyecto

En desarrollo. Actualmente se está preparando la estructura inicial
y el control de versiones.

## Tecnologías previstas

- Ionic y Angular.
- API REST con persistencia relacional (SQL).
- Servicio de documentos en tiempo real (NoSQL).

Los servicios de datos y la plataforma de despliegue están pendientes
de concretar.

## Funciones previstas

### Cliente

- Consultar el catálogo y el detalle de los vinilos.
- Buscar y filtrar productos.
- Reservar vinilos disponibles para recoger en tienda.
- Consultar sus reservas y cancelar las pendientes de preparación.
- Recibir notificaciones de los cambios de estado.

### Administrador

- Crear, editar y desactivar productos del catálogo.
- Gestionar las existencias y las reservas.
- Consultar estadísticas.
- Exportar informes en PDF y CSV.

## Funcionamiento previsto de las reservas

Una reserva puede contener varios vinilos y sus cantidades.
Las unidades quedan apartadas al confirmar la reserva.

Los estados son pendiente, preparada, recogida y cancelada.
El cliente puede cancelar una reserva pendiente. El administrador
puede cancelarla mientras no se haya recogido. Al cancelar,
las unidades vuelven a estar disponibles.

Inicialmente no habrá caducidad automática de reservas.
El pago se realizará en tienda, fuera de la aplicación.

## Organización del repositorio

- main: versiones estables.
- develop: integración del trabajo.
- feature/*: desarrollo de funcionalidades.

## Documentación

La documentación técnica, el manual de usuario y las instrucciones
de instalación se incorporarán conforme avance el desarrollo.

## Autor

Ricardo Crespo.