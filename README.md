# Vinyl Store — Ricardo Crespo

Aplicación de gestión de una tienda de vinilos desarrollada con
Ionic y Angular standalone.

## Estado del proyecto

En desarrollo. Están implementadas la navegación inicial y la
autenticación con Supabase.

Actualmente incluye:

- Menú lateral adaptable a escritorio y móvil.
- Siete páginas con carga diferida: catálogo, mis reservas, ayuda,
  acceso y sesión, productos, gestión de reservas y estadísticas.
- Inicio de sesión con correo y contraseña mediante Supabase Auth.
- Recuperación de la sesión al recargar y cierre de sesión.
- Perfiles con roles cliente y administrador en PostgreSQL.
- Creación automática del perfil de las nuevas cuentas con rol cliente.
- RLS para permitir la lectura del perfil propio.
- Restricción de escritura de perfiles desde la aplicación.
- Acceso a mis reservas condicionado a tener sesión.
- Rutas administrativas protegidas según el rol.
- Menú actualizado automáticamente según la sesión y el rol.

Las páginas de catálogo, reservas, productos, ayuda y estadísticas
mantienen contenido provisional. Sus funciones de negocio están pendientes.

## Tecnologías

- Ionic y Angular standalone.
- TypeScript y SCSS.
- Supabase Auth y PostgreSQL.
- Git y GitHub.

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

La estructura inicial de perfiles, sus permisos y el disparador
de creación están definidos en:

    supabase/migrations/202610260001_create_profiles.sql

Este archivo se ha ejecutado manualmente en el SQL Editor de Supabase;
la aplicación no ejecuta migraciones automáticamente.

Las cuentas nuevas reciben el rol cliente. La asignación del rol
admin se realiza desde la administración de la base de datos.

## Comprobaciones realizadas

- Compilación de producción: npm run build.
- Análisis estático: npm run lint.
- Navegación entre las siete páginas.
- Inicio de sesión con una cuenta de prueba.
- Recuperación de sesión tras recargar.
- Cierre de sesión y comprobación posterior a la recarga.
- Rechazo de credenciales incorrectas.
- Acceso a rutas según la sesión y el rol.
- Comprobación de acceso mediante URL directa.
- Actualización del menú al cambiar de cuenta y cerrar sesión.
- Verificación de RLS, política de lectura y disparador de perfiles.
- Prueba mediante API con cuenta cliente: lectura limitada al perfil propio
  y actualización del perfil rechazada con HTTP 403.

## Trabajo pendiente

- Gestión de productos y existencias.
- Consulta del catálogo y gestión de reservas.
- Reglas de acceso a los datos de productos y reservas.
- Estadísticas y exportación.
- Contenido de ayuda.
- Concretar la integración documental NoSQL y de tiempo real.
- Diseño visual y revisión de la experiencia de usuario.
- Completar los requisitos de despliegue y entrega.
- Revisar las vulnerabilidades detectadas en dependencias de desarrollo.
- Ajustar Browserslist a los navegadores admitidos por Angular.

## Organización del desarrollo

Se utilizan ramas feature para cada bloque de trabajo y pull requests
para integrarlas en develop. La rama main se reserva para versiones
estables de publicación o entrega.