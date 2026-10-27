# Vinyl Store — Ricardo Crespo

Aplicación de gestión de una tienda de vinilos desarrollada con
Ionic y Angular standalone.

## Estado del proyecto

En desarrollo. Están implementadas la navegación, la autenticación
con roles y la gestión inicial de productos con portadas.

Actualmente incluye:

- Menú lateral adaptable a escritorio y móvil.
- Siete páginas con carga diferida.
- Inicio y cierre de sesión mediante Supabase Auth.
- Recuperación de la sesión al recargar.
- Perfiles con roles cliente y administrador en PostgreSQL.
- Creación automática de perfiles con rol cliente.
- RLS para consultar el perfil propio y restricción de su escritura.
- Acceso a mis reservas condicionado a tener sesión.
- Rutas administrativas protegidas según el rol.
- Menú actualizado automáticamente según la sesión y el rol.
- Alta y edición de productos mediante formularios reactivos.
- Validación de campos obligatorios, precios y existencias.
- Publicación y retirada de productos mediante el campo activo.
- Catálogo público de productos activos, distribuido en cards.
- Subida de portadas a Supabase Storage y visualización pública.
- Restricción de escritura de productos e imágenes al administrador.
- Mensajes de carga, error, confirmación y listados vacíos.

Las páginas de reservas, ayuda y estadísticas mantienen contenido
provisional. La funcionalidad de reservas todavía no está implementada.

## Tecnologías

- Ionic y Angular standalone.
- TypeScript y SCSS.
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

Los scripts se han ejecutado manualmente en el SQL Editor de Supabase.
La aplicación no ejecuta migraciones automáticamente.

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

## Comprobaciones realizadas

- Compilación de producción: npm run build.
- Análisis estático: npm run lint.
- Navegación entre las siete páginas.
- Inicio, cierre y recuperación de sesión.
- Rechazo de credenciales incorrectas.
- Acceso a rutas según la sesión y el rol, también mediante URL directa.
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
  En la prueba respondió HTTP 400 con statusCode 403 y AccessDenied
  en el cuerpo de la respuesta.

## Trabajo pendiente

- Gestión de reservas y sus efectos sobre las existencias.
- Reglas de acceso a los datos de reservas.
- Validaciones asíncronas contra un servicio.
- Completar la demostración de binding unidireccional y bidireccional.
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