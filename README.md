# Vinyl Store — Ricardo Crespo

Aplicación de gestión de una tienda de vinilos desarrollada con
Ionic y Angular standalone.

## Estado del proyecto

En desarrollo. Están implementadas la navegación, la autenticación
con roles, la gestión de productos con portadas y las reservas.

Actualmente incluye:

- Menú lateral adaptable a escritorio y móvil.
- Siete páginas con carga diferida.
- Inicio, cierre y recuperación de sesión mediante Supabase Auth.
- Perfiles con roles cliente y administrador en PostgreSQL.
- Creación automática de perfiles con rol cliente.
- Lectura del perfil propio mediante RLS y escritura restringida.
- Rutas protegidas según sesión y rol.
- Menú actualizado automáticamente según la sesión y el rol.
- Alta y edición de productos mediante formularios reactivos.
- Validación de campos obligatorios, precios y existencias.
- Publicación y retirada de productos mediante el campo activo.
- Catálogo público de productos activos distribuido en cards.
- Subida de portadas a Supabase Storage y visualización pública.
- Escritura de productos e imágenes restringida al administrador.
- Reserva de unidades desde el catálogo con sesión iniciada.
- Consulta y cancelación de reservas propias.
- Gestión administrativa de reservas y filtro por estado.
- Descuento y devolución de existencias mediante funciones PostgreSQL.
- Protección frente a reintentos de una misma solicitud de reserva.
- Mensajes de carga, error, confirmación y listados vacíos.

Las páginas de ayuda y estadísticas mantienen contenido provisional.
El diseño visual y la revisión final de accesibilidad están pendientes.

## Tecnologías

- Ionic y Angular standalone.
- TypeScript y SCSS.
- Formularios reactivos y binding bidireccional con ngModel.
- Supabase Auth, PostgreSQL y Storage.
- Git y GitHub.
- Vercel para despliegues vinculados al repositorio.

Esta actividad utiliza persistencia SQL. La integración NoSQL queda
fuera de su alcance según las indicaciones del profesor.

## Ejecución local

Instalar las dependencias:

    npm ci

Iniciar el servidor de desarrollo:

    npm start

El servidor indicará la dirección local de la aplicación.

## Configuración de Supabase

Los archivos src/environments/environment.ts y
src/environments/environment.prod.ts contienen la URL del proyecto
y su clave pública.

La aplicación utiliza una clave publicable. No deben incorporarse
claves secretas ni service_role al código del cliente.

La configuración de la base de datos y Storage está documentada en:

- supabase/migrations/202610260001_create_profiles.sql
- supabase/migrations/202610270001_create_productos.sql
- supabase/migrations/202610270002_configure_portadas.sql
- supabase/migrations/202610270003_create_reservas.sql
- supabase/migrations/202610270004_create_reservar_function.sql
- supabase/migrations/202610270005_create_estado_reserva_function.sql

Los scripts se han ejecutado manualmente en el SQL Editor de Supabase,
en el orden de sus nombres. La aplicación no ejecuta migraciones
automáticamente.

Las cuentas nuevas reciben el rol cliente. La asignación del rol
admin se realiza desde la administración de la base de datos.

## Productos y portadas

Los productos contienen título, artista, género, precio, existencias,
descripción, ruta de portada, estado de publicación y fecha de creación.

Los productos inactivos se conservan en administración y no aparecen
en el catálogo público. Un producto activo sin existencias continúa
visible, indicando que está temporalmente agotado.

Las imágenes se almacenan en el bucket público portadas.
El campo imagen_path guarda la ruta del archivo.

Se admiten imágenes JPEG, PNG y WebP de hasta 2 MiB.
Cada subida utiliza un nombre único.

Al sustituir una portada, la imagen anterior permanece en Storage.
La limpieza de archivos sin referencias está pendiente.

## Funcionamiento de las reservas

Las reservas son para recoger los discos. No incluyen pagos
ni caducidad automática.

Al reservar:

- Se comprueban la sesión, el producto, la cantidad y las existencias.
- La identidad del usuario y el precio se obtienen en el servidor.
- Se guarda el precio unitario del momento de la reserva.
- Se descuentan las unidades y se registra la reserva en una
  misma transacción.
- La fila del producto se bloquea temporalmente con FOR UPDATE
  para coordinar modificaciones concurrentes.

Los estados son:

- pendiente: unidades reservadas y descontadas de las existencias.
- recogida: recogida confirmada por el administrador, sin otro descuento.
- cancelada: cancelación realizada por su propietario o el administrador,
  con devolución de las unidades.

Las reservas finalizadas no pueden cambiar a otro estado.
Repetir una cancelación no devuelve las unidades otra vez.

Cada solicitud de creación tiene un identificador. Reintentar la misma
solicitud devuelve la reserva existente sin volver a descontar stock.
La página conserva el identificador de su última solicitud fallida
mientras permanece en memoria; esa conservación no persiste tras
una recarga completa.

La aplicación consulta las reservas directamente, pero las crea y cambia
de estado mediante RPC a funciones PostgreSQL. No tiene permisos de
inserción o actualización directa sobre la tabla reservas.

Los clientes solo pueden consultar sus reservas. El administrador puede
consultarlas todas y filtrarlas por estado.

Si un producto pasa a inactivo, el cliente conserva los datos propios
de la reserva, pero sus datos relacionados del catálogo dejan de ser
visibles por RLS. La interfaz muestra un texto alternativo.

## Comprobaciones realizadas

- Compilación de producción: npm run build.
- Análisis estático: npm run lint.
- Navegación entre las siete páginas.
- Inicio, cierre y recuperación de sesión.
- Rechazo de credenciales incorrectas.
- Acceso a rutas según sesión y rol, también mediante URL directa.
- Actualización del menú al cambiar de cuenta y cerrar sesión.
- Verificación de RLS, política de lectura y disparador de perfiles.
- API de perfiles: lectura limitada al perfil propio y actualización
  rechazada con HTTP 403.
- Creación y edición de productos con persistencia tras recargar.
- Cancelación de edición sin guardar cambios.
- Publicación y retirada de productos del catálogo.
- Consulta del catálogo y portadas sin iniciar sesión.
- Subida y sustitución de portadas desde administración.
- Validación del límite de tamaño de imágenes.
- API de productos con cuenta cliente: actualización sin filas afectadas
  y creación rechazada con HTTP 403 y código 42501.
- API de Storage con cuenta cliente: subida rechazada por RLS.
  La prueba respondió HTTP 400 con statusCode 403 y AccessDenied
  en el cuerpo.
- Reserva desde catálogo y descuento de unidades.
- Consulta de reservas propias y cancelación con devolución de unidades.
- Gestión administrativa y filtrado por estado.
- Recogida sin descontar existencias por segunda vez.
- Persistencia de estados y existencias tras recargar.
- API de reservas: repetir la creación devuelve la misma reserva
  sin descontar más stock.
- API de reservas: el cliente no puede confirmar la recogida.
  La función respondió HTTP 400 con el mensaje de rechazo esperado.
- API de reservas: cancelar dos veces devuelve el stock una sola vez.

La prueba de dos usuarios reservando simultáneamente la última unidad
todavía está pendiente. El bloqueo está implementado, pero ese escenario
no se presenta como verificado.

## Trabajo pendiente

- Ficha de clientes y su identificación en la gestión administrativa.
- Validaciones asíncronas de formularios contra un servicio.
- Pruebas adicionales de concurrencia y acceso a reservas de otra cuenta.
- Dashboard sin gráficos de barras.
- Exportación de informes en PDF y CSV.
- Contenido de ayuda y manual de usuario.
- Documentación técnica generada con Compodoc.
- Limpieza segura de portadas que ya no utiliza ningún producto.
- Diseño visual y revisión de la experiencia de usuario.
- Revisión de accesibilidad y auditorías Lighthouse.
- Completar los requisitos de despliegue y entrega.
- Revisar las vulnerabilidades detectadas en dependencias de desarrollo.
- Ajustar Browserslist a los navegadores admitidos por Angular.

## Organización del desarrollo

Se utilizan ramas feature para cada bloque de trabajo y pull requests
para integrarlas en develop. La rama main se reserva para versiones
estables de publicación o entrega.

Vercel utiliza main para producción y genera despliegues Preview
para las ramas de desarrollo.