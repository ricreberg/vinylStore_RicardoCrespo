## Estado del proyecto

En desarrollo. Se ha creado la base de Ionic con Angular standalone
y la estructura inicial de navegación.

Actualmente incluye:
- Menú lateral adaptable a escritorio y móvil.
- Siete páginas iniciales con carga diferida: catálogo, mis reservas,
  ayuda, acceso, productos, gestión de reservas y estadísticas.
- Rutas administrativas agrupadas bajo /admin.

Las páginas contienen únicamente su estructura inicial. La autenticación,
los permisos, la persistencia y las operaciones de negocio están pendientes.

Comprobaciones realizadas:
- Inicio de la aplicación mediante ionic serve.
- Compilación de producción mediante npm run build.
- Análisis estático mediante npm run lint.

Quedan pendientes la revisión de las vulnerabilidades detectadas en
dependencias de desarrollo y el ajuste de Browserslist a los navegadores
admitidos por Angular.