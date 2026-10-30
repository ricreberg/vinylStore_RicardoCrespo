# Vinyl Store — Ricardo Crespo

Aplicación de gestión de una tienda de vinilos desarrollada con
Ionic y Angular standalone.

## Estado del proyecto

En desarrollo. Están implementadas la navegación, la autenticación,
los productos y portadas, las reservas, la consulta administrativa
de clientes y el dashboard con exportación de informes.

Actualmente incluye:

- Menú lateral adaptable a escritorio y móvil.
- Nueve páginas con carga diferida.
- Inicio, cierre y recuperación de sesión mediante Supabase Auth.
- Perfiles con nombre y roles cliente y administrador.
- Creación automática de perfiles con rol cliente.
- Rutas protegidas según sesión y rol.
- Menú actualizado automáticamente según la sesión.
- Alta y edición de productos mediante formularios reactivos.
- Validación de campos obligatorios, precios y existencias.
- Protección frente a sobrescrituras de stock al editar productos.
- Publicación y retirada de productos del catálogo.
- Catálogo público distribuido en cards.
- Portadas almacenadas en Supabase Storage.
- Reserva de unidades desde el catálogo.
- Validación asíncrona de disponibilidad contra Supabase.
- Consulta y cancelación de reservas propias.
- Gestión administrativa de reservas y filtro por estado.
- Descuento y devolución de existencias mediante funciones PostgreSQL.
- Protección frente a reintentos de una misma solicitud de reserva.
- Listado y ficha de clientes para el administrador.
- Historial de reservas por cliente.
- Identificación del cliente desde la gestión de reservas.
- Dashboard con gráficos de líneas y de anillo.
- Selector de periodos de 7, 14 y 30 días.
- Tablas alternativas con los datos de los gráficos.
- Exportación de estadísticas en PDF y CSV.
- Estados de carga, errores, confirmaciones y listados vacíos.

La página de ayuda mantiene contenido provisional.
El diseño visual y la revisión final de accesibilidad están pendientes.

## Tecnologías

- Ionic y Angular standalone.
- TypeScript y SCSS.
- Formularios reactivos y binding bidireccional con ngModel.
- RxJS.
- Supabase Auth, PostgreSQL y Storage.
- Chart.js.
- jsPDF y jsPDF-AutoTable.
- Git y GitHub.
- Vercel.

Esta actividad utiliza persistencia SQL. La integración NoSQL queda
fuera de su alcance según las indicaciones del profesor.

## Ejecución local

Instalar las dependencias:

    npm ci

Iniciar el servidor de desarrollo desde la raíz del proyecto:

    ionic serve

Comprobar la compilación y el análisis estático:

    npm run build
    npm run lint

## Configuración de Supabase

Los archivos src/environments/environment.ts y
src/environments/environment.prod.ts contienen la URL del proyecto
y su clave pública.

La aplicación utiliza una clave publicable. No deben incorporarse
claves secretas ni service_role al código del cliente.

La configuración está documentada en:

- supabase/migrations/202610260001_create_profiles.sql
- supabase/migrations/202610270001_create_productos.sql
- supabase/migrations/202610270002_configure_portadas.sql
- supabase/migrations/202610270003_create_reservas.sql
- supabase/migrations/202610270004_create_reservar_function.sql
- supabase/migrations/202610270005_create_estado_reserva_function.sql
- supabase/migrations/202610280001_configure_clientes.sql

Los scripts se han ejecutado manualmente en el SQL Editor de Supabase,
en el orden de sus nombres. La aplicación no ejecuta migraciones
automáticamente.

Las cuentas nuevas reciben el rol cliente. La asignación del rol
admin se realiza desde la administración de la base de datos.

## Acceso y clientes

Los visitantes pueden consultar el catálogo y sus portadas.
Las reservas requieren iniciar sesión.

Los clientes consultan su sesión y sus reservas. La escritura directa
de perfiles y reservas está restringida.

El administrador gestiona productos y reservas y puede consultar
el listado de clientes y sus fichas.

Las fichas muestran nombre, correo, fecha de alta e historial.
La consulta administrativa utiliza una función PostgreSQL que
comprueba el rol antes de devolver datos de Auth y perfiles.

Las fichas son de consulta; no permiten editar nombres ni gestionar
las cuentas de Auth desde la aplicación.

Las cuentas se crean desde Supabase. La interfaz no incluye registro
público ni recuperación de contraseña.

## Productos y portadas

Los productos incluyen título, artista, género, precio, existencias,
descripción, ruta de portada, estado de publicación y fecha de creación.

Los productos inactivos se conservan en administración y no aparecen
en el catálogo público. Un producto activo sin existencias sigue
visible, indicando que está temporalmente agotado.

Al editar sin cambiar las existencias, el stock se omite de la
actualización para conservar los movimientos realizados por reservas.

Si el administrador modifica las existencias, la actualización exige
que el stock siga coincidiendo con el valor original del formulario.
Si ha cambiado, se rechaza el guardado y se solicita revisar el listado.

Las imágenes se almacenan en el bucket público portadas.
El campo imagen_path guarda la ruta del archivo.

Se admiten JPEG, PNG y WebP de hasta 2 MiB.
Cada subida utiliza un nombre único.

Al sustituir una portada, la imagen anterior permanece en Storage.
También pueden quedar archivos sin referencia tras un guardado fallido.
La limpieza segura de esos archivos está pendiente.

## Reservas

Cada reserva corresponde a un producto y una cantidad de unidades,
para recoger en tienda. No incluye pagos ni caducidad automática.

Al reservar, PostgreSQL comprueba la sesión, el producto,
la cantidad y las existencias. La identidad y el precio se obtienen
en el servidor.

El descuento de unidades y la creación de la reserva se realizan
en una misma transacción. Se utiliza FOR UPDATE para coordinar
las modificaciones del stock.

Estados:

- pendiente: unidades reservadas y descontadas.
- recogida: recogida confirmada por el administrador, sin otro descuento.
- cancelada: cancelación del propietario o administrador, con devolución
  de las unidades.

Las reservas finalizadas no pueden cambiar a otro estado.
Repetir una cancelación no vuelve a devolver existencias.

Cada solicitud de creación tiene un identificador. Reintentar la misma
solicitud devuelve la reserva existente sin descontar más stock.

La página conserva la última solicitud fallida mientras permanece
en memoria. Esa conservación no persiste tras una recarga completa
ni mantiene un historial de todas las solicitudes anteriores.

La aplicación consulta las reservas directamente, pero las crea
y cambia de estado mediante RPC a funciones PostgreSQL.

Si un producto pasa a inactivo, el cliente conserva su reserva,
pero no puede consultar sus datos relacionados del catálogo por RLS.
La interfaz muestra un texto alternativo.

### Validación asíncrona de disponibilidad

El formulario valida que la cantidad sea un entero mayor que cero.
Después consulta mediante un servicio si el producto sigue activo
y tiene suficientes unidades en Supabase.

Los cambios del campo se validan al perder el foco.
Mientras la consulta está pendiente, se muestra un mensaje de
comprobación y se bloquea la confirmación.

Se distinguen la falta de disponibilidad y los errores de conexión.
La validación tiene un tiempo máximo de espera de diez segundos.

La consulta utiliza el stock actual, aunque el catálogo mostrase
unas existencias anteriores.

Esta validación no aparta unidades. La función PostgreSQL mantiene
la comprobación definitiva al confirmar, porque el stock puede
cambiar después de validar el campo.

## Dashboard e informes

El dashboard está restringido al administrador.

Productos y existencias reflejan la situación actual.
Las métricas de reservas utilizan su fecha de creación dentro
del periodo seleccionado, incluido hoy, según la hora local
del navegador.

Incluye:

- Productos registrados y activos.
- Unidades disponibles en los productos activos.
- Reservas creadas en el periodo y cuántas siguen pendientes.
- Valor de las reservas del periodo que están recogidas.
- Línea de reservas creadas por día.
- Anillo con el estado actual de las reservas del periodo.

El valor de las reservas recogidas no representa pagos registrados.
La aplicación no implementa cobros.

Los gráficos tienen tablas alternativas y sus instancias se destruyen
al abandonar la página.

Los informes PDF y CSV utilizan los datos mostrados en el dashboard.
Incluyen resumen, distribución por estado y actividad diaria.
No incluyen correos ni fichas de clientes.

El PDF contiene tablas paginadas con cabeceras y numeración.
Sus bibliotecas se cargan mediante importación dinámica al descargar.

El CSV utiliza UTF-8 y punto y coma como separador.

## Comprobaciones realizadas

- Build y lint correctos.
- Navegación, sesiones, menú y rutas según el rol.
- Acceso mediante URL directa.
- Alta y edición de productos con persistencia tras recargar.
- Cancelación de edición sin guardar cambios.
- Publicación y retirada del catálogo.
- Consulta pública de catálogo y portadas.
- Subida, sustitución y validación de tamaño de imágenes.
- Reserva desde catálogo y descuento de unidades.
- Cancelación con devolución de unidades.
- Recogida sin descontar stock por segunda vez.
- Persistencia de estados y existencias.
- Filtro administrativo de reservas.
- Listado, fichas e historial de clientes.
- Navegación desde una reserva hasta su cliente.
- Dashboard, periodos, gráficos y tablas alternativas.
- Salida y regreso al dashboard sin reutilización incorrecta del canvas.
- Descarga y revisión de informes PDF y CSV.
- Cambio de título tras una reserva sin sobrescribir el stock.
- Rechazo del guardado de existencias desactualizadas.
- Validación asíncrona de cantidades disponibles y superiores al stock.
- Rechazo de cantidad cero y recuperación de validez al corregirla.
- Detección de cambios de stock desde otra sesión sin recargar el catálogo.

Pruebas mediante API con cuenta cliente:

- Perfiles: lectura del propio y actualización rechazada con HTTP 403.
- Productos: actualización sin filas afectadas y creación rechazada
  con HTTP 403 y código 42501.
- Storage: subida rechazada por RLS; HTTP 400 con statusCode 403
  y AccessDenied en el cuerpo.
- Reservas: reintento de creación con la misma reserva y un solo descuento.
- Reservas: cancelación repetida con una sola devolución de stock.
- Reservas: confirmación de recogida rechazada al cliente.
- Reservas: actualización directa rechazada con HTTP 403 y código 42501.
- Clientes: consulta administrativa rechazada con HTTP 403
  y código 42501.

La prueba de dos usuarios reservando simultáneamente la última unidad
está pendiente. El bloqueo está implementado, pero ese escenario
no se presenta como verificado.

## Trabajo pendiente

- Pruebas adicionales de concurrencia y acceso a reservas de otra cuenta.
- Contenido de ayuda y manual de usuario.
- Documentación técnica generada con Compodoc.
- Limpieza segura de portadas sin referencias.
- Diseño visual y revisión de la experiencia de usuario.
- Revisión de accesibilidad y auditorías Lighthouse.
- Completar los requisitos de despliegue y entrega.
- Revisar las vulnerabilidades detectadas en dependencias de desarrollo.
- Ajustar Browserslist a los navegadores admitidos por Angular.

## Organización del desarrollo

Se utilizan ramas feature para cada bloque y pull requests
para integrarlas en develop. Las correcciones pueden utilizar ramas fix.

La rama main se reserva para versiones estables de publicación
o entrega.

Vercel utiliza main para producción y genera despliegues Preview
para las ramas de desarrollo.