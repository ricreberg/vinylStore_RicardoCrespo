# Vinyl Store — Ricardo Crespo

Aplicación académica de gestión de una tienda de vinilos desarrollada
con Ionic y Angular Standalone.

- [Aplicación en Vercel](https://vinyl-store-ricardo-crespo.vercel.app/catalogo)
- [Repositorio GitHub](https://github.com/ricreberg/vinylStore_RicardoCrespo)
- [Manual de usuario integrado](https://vinyl-store-ricardo-crespo.vercel.app/ayuda)

Los cambios de desarrollo llegan a producción cuando se integran
y despliegan desde main.

## Funcionalidades

### Catálogo y clientes

- Catálogo público con búsqueda por título o artista.
- Filtros por género y disponibilidad y opciones de ordenación.
- Portadas alojadas en Supabase Storage.
- Inicio y cierre de sesión y restauración de la sesión existente.
- Reservas con validación asíncrona de disponibilidad.
- Consulta y cancelación de reservas propias pendientes.
- Manual integrado en la página Ayuda.
- Diseño adaptable y selector de tema claro y oscuro.

### Administración

- Alta y edición de productos mediante formularios reactivos.
- Gestión de portadas, precios y existencias.
- Publicación y retirada de productos conservando el historial.
- Protección frente a sobrescrituras de existencias desactualizadas.
- Búsqueda, filtros y gestión de reservas pendientes.
- Confirmación de recogidas y cancelaciones.
- Fichas de clientes con historial y gasto acumulado.
- Estadísticas con gráficos de líneas y de anillo.
- Periodos de 7, 30, 90 y 365 días, todo el historial y fechas personalizadas.
- Tablas alternativas a los gráficos.
- Exportación de informes PDF y CSV.

Se muestran estados de carga, errores, confirmaciones y listados vacíos.

## Tecnologías y estructura

- Ionic y Angular Standalone, sin AppModule.
- TypeScript, SCSS, formularios reactivos, signals y RxJS.
- Supabase Auth, PostgreSQL y Storage.
- Chart.js, jsPDF y jsPDF-AutoTable.
- Sharp para preparar imágenes.
- Compodoc para generar documentación técnica.
- Git, GitHub y Vercel.

Las versiones se conservan en package-lock.json.

Organización:

- src/app/pages/: páginas públicas, de cliente y de administración.
- src/app/core/services/: servicios y acceso a datos.
- src/app/core/guards/: protección de rutas.
- src/app/core/utils/: cálculos y utilidades.
- src/theme/ y src/global.scss: tema y estilos compartidos.
- supabase/migrations/: esquema, permisos y funciones PostgreSQL.
- scripts/: preparación de datos de demostración.
- docs/compodoc/: documentación técnica generada.

Esta actividad utiliza SQL. NoSQL corresponde a otra actividad
según la aclaración recibida del profesor.

## Ejecución local

Desde la raíz del proyecto:

    npm ci
    ionic serve

Comprobaciones:

    npm run lint
    npm run build
    npm test -- --watch=false
    npm audit --omit=dev

La compilación de producción genera www/.

## Configuración de Supabase

src/environments/environment.ts y environment.prod.ts contienen
la URL del proyecto y su clave pública.

No deben incorporarse claves secretas ni service_role al código
del navegador ni al repositorio. La clave pública no sustituye
las políticas de acceso.

Las migraciones de supabase/migrations/ se aplican en el orden
de sus nombres. En este proyecto se han ejecutado manualmente
en el SQL Editor de Supabase.

Definen perfiles, productos, reservas, Storage, políticas RLS
y funciones de negocio. La aplicación no las ejecuta automáticamente.

La migración 202610310001_clientes_fecha_alta.sql establece
profiles.created_at como fecha de alta de negocio del cliente,
conservando la fecha técnica de Auth.

Las cuentas nuevas reciben el rol cliente. El administrador
se asigna desde la administración de la base de datos.

## Acceso y seguridad

El visitante consulta el catálogo activo. Reservar requiere sesión.

El cliente consulta sus reservas y cancela las pendientes.
El administrador gestiona productos, reservas, clientes e informes.

La interfaz adapta sus opciones al rol; los guards protegen
la navegación y PostgreSQL aplica los permisos mediante RLS
y funciones que comprueban la identidad y la operación.

AuthService centraliza sesión y rol. El SDK de Supabase gestiona
los tokens y su renovación mediante sus propias peticiones fetch.
No se utiliza un interceptor HTTP propio de Angular.

No hay registro público, recuperación de contraseña ni edición
del perfil desde la aplicación.

Las credenciales de evaluación se facilitan en la memoria.
No se publican contraseñas en este repositorio.

## Productos y portadas

Los productos incluyen título, artista, género, precio,
existencias, descripción, portada y estado de publicación.

Retirar un producto conserva sus datos e historial y lo oculta
del catálogo público. Los publicados sin existencias pueden
seguir visibles como agotados.

Al editar sin modificar existencias, el stock se omite de la
actualización. Si se modifica, se exige que conserve el valor
original del formulario para evitar sobrescribir cambios recientes.

El bucket público portadas admite JPEG, PNG y WebP de hasta 2 MiB.
imagen_path guarda la ruta del archivo.

Al sustituir una imagen pueden quedar archivos sin referencia.
Su limpieza automática está pendiente.

## Reservas y compras recogidas

Una reserva corresponde a un producto y una cantidad para recoger
en tienda. No hay caducidad automática.

crear_reserva comprueba identidad, producto, cantidad y existencias
y obtiene el precio desde PostgreSQL. La creación y el descuento
se realizan en una transacción con bloqueo FOR UPDATE.

Estados:

- pendiente: unidades apartadas y descontadas de las disponibles.
- recogida: entrega confirmada por el administrador, sin otro descuento.
- cancelada: devolución de las unidades a las existencias.

La recogida equivale, en esta práctica, a una compra completada
y cobrada en tienda. Su importe se incorpora al gasto del cliente
y a las estadísticas. No existe pasarela de pago ni módulo de caja.

Las reservas finalizadas no cambian de estado. Repetir una
cancelación no devuelve existencias otra vez.

Cada solicitud tiene un identificador. Reintentar la misma devuelve
la reserva existente sin repetir el descuento. La última solicitud
fallida se conserva en memoria, no tras una recarga completa.

precio_unitario conserva el precio histórico aunque cambie el catálogo.

Si se retira un producto, la reserva permanece. Si RLS impide
consultar sus datos relacionados, se muestra un texto alternativo.

### Validación asíncrona

La cantidad debe ser un entero mayor que cero. Al abandonar
el campo se consulta la disponibilidad.

Durante la comprobación se bloquea la confirmación. Se distingue
entre falta de existencias y fallo de conexión, con un tiempo
máximo de espera de diez segundos.

Esta consulta no aparta unidades. La función PostgreSQL comprueba
otra vez las existencias al confirmar.

## Estadísticas e informes

Las métricas distinguen:

- Reservas creadas por created_at.
- Compras recogidas por updated_at de las recogidas.
- Cancelaciones por updated_at de las canceladas.
- Estado actual de las reservas creadas dentro del periodo.
- Productos y existencias actuales.

Los intervalos incluyen ambos días según las fechas locales.
La evolución se agrupa por día en periodos cortos y por mes
en los largos.

Las reservas se recuperan por páginas desde Supabase; después
se calculan localmente los periodos. Los importes se acumulan
en céntimos usando el precio histórico.

Los gráficos incluyen tablas alternativas y sus instancias
se destruyen al abandonar la página.

PDF y CSV utilizan el periodo seleccionado. El PDF contiene
tablas paginadas y carga sus bibliotecas mediante importación
dinámica. El CSV utiliza UTF-8 con BOM y separador punto y coma.

Los informes no incluyen correos ni fichas de clientes.

## Datos de demostración

La carga preparada contiene:

- 60 álbumes con portada WebP.
- 15 clientes ficticios.
- 400 reservas repartidas a lo largo de unos dos años:
  - 320 recogidas: 370 unidades.
  - 60 canceladas: 67 unidades.
  - 20 pendientes: 22 unidades.

La selección inicial de álbumes se preparó con ayuda de IA.
Los metadatos se contrastaron con MusicBrainz y las portadas
se obtuvieron de Cover Art Archive.

Precios, existencias e historial comercial son ficticios.
Las imágenes conservan los derechos de sus titulares.

La aplicación consulta Supabase durante su uso habitual.
Las API musicales se utilizan durante la preparación.

Sharp convirtió las 60 portadas a WebP: de 3,66 MiB a 1,84 MiB,
una reducción del 49,8 %.

Scripts:

- scripts/preparar-catalogo.mjs
- scripts/convertir-portadas.mjs
- scripts/importar-catalogo.mjs
- scripts/crear-clientes-demo.mjs
- scripts/preparar-historial.mjs

Los resultados locales se excluyen mediante .gitignore.
Los scripts no se ejecutan al arrancar la aplicación.
No es necesario regenerar cuentas ni historial para utilizarla.

## Manual y documentación técnica

La página /ayuda explica las reservas, los estados, la gestión,
las estadísticas y la resolución de problemas habituales.

Generar la documentación técnica:

    npm run docs

La salida HTML se guarda en docs/compodoc/.

Consultar mediante un servidor local:

    npm run docs:serve

Abrir http://localhost:8080. Detener con Ctrl+C.

tsconfig.doc.json selecciona el código y excluye las pruebas.
Compodoc documenta la estructura técnica; Ayuda contiene
las instrucciones de uso.

## Comprobaciones y limitaciones

Se han realizado compilación, lint y una prueba básica de
AppComponent. No representan cobertura completa de negocio.

Se han comprobado manualmente navegación, sesiones, formularios,
movimientos de existencias, listados y exportaciones.

Las pruebas previas mediante API con una cuenta cliente incluyeron:

- Lectura del perfil propio y rechazo de su modificación.
- Rechazo de creación de productos y ausencia de actualizaciones autorizadas.
- Rechazo de subida de portadas.
- Reintento de reserva sin repetir el descuento.
- Cancelación repetida sin repetir la devolución.
- Rechazo de confirmación de recogida por el cliente.
- Rechazo de modificación directa de reservas.
- Rechazo de consulta administrativa de clientes.

Revisar SQL local no certifica que todas las políticas desplegadas
coincidan con las migraciones.

Quedan pruebas adicionales de concurrencia, expiración y mala conexión.

Browserslist se ha actualizado. Persisten tres avisos de tamaño CSS
en catálogo, productos y dashboard, sin impedir la compilación.

Lighthouse y la comprobación del despliegue definitivo se
documentan en la memoria de entrega.

## Mejoras futuras

- Ampliar pruebas automatizadas y de concurrencia.
- Reducir CSS y extraer componentes reutilizables.
- Paginar o virtualizar listados extensos.
- Limpiar portadas sin referencia.
- Registro, recuperación de contraseña y edición del perfil.
- Contacto y gestión de incidencias.
- Pruebas y empaquetado Android con Capacitor.
- Evaluar instalación PWA y funcionamiento sin conexión.

No se presenta como completada una versión Android ni una PWA
con funcionamiento sin conexión.

## Control de versiones y publicación

Se utilizan main, develop y ramas feature/* y fix/*.
Los cambios se integran mediante pull requests.

main se reserva para versiones estables. Vercel utiliza main
para producción y genera despliegues Preview para desarrollo.

Vercel publica la web; Supabase mantiene autenticación,
base de datos y portadas.

## Fuentes

- Angular: https://angular.dev/
- Ionic: https://ionicframework.com/docs
- Supabase: https://supabase.com/docs
- Chart.js: https://www.chartjs.org/docs/latest/
- MusicBrainz: https://musicbrainz.org/doc/MusicBrainz_API
- Cover Art Archive: https://coverartarchive.org/
- Compodoc: https://compodoc.app/

Se ha utilizado IA como apoyo para explicación, desarrollo,
revisión y preparación de datos de prueba. La memoria detalla su uso.
