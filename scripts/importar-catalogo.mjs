import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const carpetaDatos = new URL('../datos-importacion/', import.meta.url);
const archivoCatalogo = new URL('catalogo.json', carpetaDatos);
const archivoInforme = new URL('resultado-importacion.json', carpetaDatos);

let supabase;

// Leemos únicamente los dos valores públicos que ya utiliza la aplicación.
function obtenerConfiguracion(texto, nombre) {
  const patron = new RegExp(`${nombre}\\s*:\\s*(['"])(.*?)\\1`);
  const resultado = texto.match(patron);

  if (!resultado) {
    throw new Error(`No se encuentra ${nombre} en environment.ts.`);
  }

  return resultado[2];
}

async function importarCatalogo() {
  const correo = process.env.VINYL_ADMIN_EMAIL;
  const contrasena = process.env.VINYL_ADMIN_PASSWORD;

  if (!correo || !contrasena) {
    throw new Error('Faltan el correo y la contraseña del administrador.');
  }

  const catalogo = JSON.parse(
    await readFile(archivoCatalogo, 'utf8'),
  );

  if (!Array.isArray(catalogo) || catalogo.length === 0) {
    throw new Error('El catálogo está vacío o no contiene una lista.');
  }

  const preparados = [];
  const identificadores = new Set();

  // Validamos todos los registros y archivos antes de subir nada.
  for (const disco of catalogo) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(disco.musicbrainz_id ?? '') ||
      !disco.titulo?.trim() ||
      !disco.artista?.trim() ||
      !disco.genero?.trim() ||
      !Number.isFinite(disco.precio) ||
      disco.precio < 0 ||
      !Number.isInteger(disco.stock) ||
      disco.stock < 0 ||
      !disco.imagen_local?.endsWith('.webp')
    ) {
      throw new Error(`Datos incompletos o incorrectos: ${disco.titulo}.`);
    }

    if (identificadores.has(disco.musicbrainz_id)) {
      throw new Error(`Identificador duplicado: ${disco.titulo}.`);
    }

    identificadores.add(disco.musicbrainz_id);

    const imagen = await readFile(
      new URL(disco.imagen_local, carpetaDatos),
    );

    const esWebp =
      imagen.subarray(0, 4).toString() === 'RIFF' &&
      imagen.subarray(8, 12).toString() === 'WEBP';

    if (!esWebp || imagen.length > 2 * 1024 * 1024) {
      throw new Error(`Portada inválida o demasiado grande: ${disco.titulo}.`);
    }

    preparados.push({ disco, imagen });
  }

  const entorno = await readFile(
    new URL('../src/environments/environment.ts', import.meta.url),
    'utf8',
  );

  supabase = createClient(
    obtenerConfiguracion(entorno, 'supabaseUrl'),
    obtenerConfiguracion(entorno, 'supabaseKey'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const { data: acceso, error: errorAcceso } =
    await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });

  if (errorAcceso) {
    throw new Error(`No se ha podido iniciar sesión: ${errorAcceso.message}`);
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', acceso.user.id)
    .single();

  if (errorPerfil || perfil?.role !== 'admin') {
    throw new Error('La cuenta debe tener el rol admin.');
  }

  console.log('Sesión de administrador comprobada.');

  const informe = {
    fecha: new Date().toISOString(),
    creados: [],
    omitidos: [],
    errores: [],
  };

  for (const [indice, preparado] of preparados.entries()) {
    const { disco, imagen } = preparado;
    const nombreImagen = `${disco.musicbrainz_id}.webp`;
    const rutaImagen = `catalogo/${nombreImagen}`;

    console.log(
      `[${indice + 1}/${preparados.length}] ` +
      `${disco.artista} — ${disco.titulo}`,
    );

    try {
      // Comprobar el UUID permite reanudar una importación interrumpida.
      const { data: existente, error: errorConsulta } = await supabase
        .from('productos')
        .select('id')
        .eq('id', disco.musicbrainz_id)
        .maybeSingle();

      if (errorConsulta) {
        throw errorConsulta;
      }

      if (existente) {
        informe.omitidos.push({
          id: existente.id,
          titulo: disco.titulo,
        });

        console.log('  Ya importado; se conserva sin cambios.');
        continue;
      }

      // También evitamos duplicar un álbum creado previamente a mano.
      const { data: coincidencia, error: errorCoincidencia } = await supabase
        .from('productos')
        .select('id')
        .eq('titulo', disco.titulo)
        .eq('artista', disco.artista)
        .limit(1)
        .maybeSingle();

      if (errorCoincidencia) {
        throw errorCoincidencia;
      }

      if (coincidencia) {
        informe.omitidos.push({
          id: coincidencia.id,
          titulo: disco.titulo,
        });

        console.log('  El título y artista ya existen; se conserva.');
        continue;
      }

      // Una ejecución anterior pudo subir la imagen y fallar al crear el producto.
      const { data: archivos, error: errorListado } = await supabase.storage
        .from('portadas')
        .list('catalogo', {
          search: nombreImagen,
          limit: 10,
        });

      if (errorListado) {
        throw errorListado;
      }

      const portadaExiste = archivos.some(
        (archivo) => archivo.name === nombreImagen,
      );

      if (!portadaExiste) {
        const { error: errorSubida } = await supabase.storage
          .from('portadas')
          .upload(rutaImagen, imagen, {
            contentType: 'image/webp',
            cacheControl: '31536000',
            upsert: false,
          });

        if (errorSubida) {
          throw errorSubida;
        }
      }

      // Solo enviamos columnas que existen en la tabla productos.
      const { error: errorProducto } = await supabase
        .from('productos')
        .insert({
          id: disco.musicbrainz_id,
          titulo: disco.titulo,
          artista: disco.artista,
          genero: disco.genero,
          precio: disco.precio,
          stock: disco.stock,
          descripcion: disco.descripcion ?? '',
          imagen_path: rutaImagen,
          activo: true,
        });

      if (errorProducto) {
        throw errorProducto;
      }

      informe.creados.push({
        id: disco.musicbrainz_id,
        titulo: disco.titulo,
        artista: disco.artista,
        imagen_path: rutaImagen,
      });

      console.log('  Producto y portada importados.');
    } catch (error) {
      informe.errores.push({
        titulo: disco.titulo,
        artista: disco.artista,
        mensaje: error.message,
      });

      console.log(`  Error: ${error.message}`);
    } finally {
      // El informe conserva el progreso sin guardar credenciales ni tokens.
      await writeFile(
        archivoInforme,
        JSON.stringify(informe, null, 2) + '\n',
      );
    }
  }

  console.log('\nResultado de esta ejecución:');
  console.log(`Creados: ${informe.creados.length}`);
  console.log(`Omitidos por existir: ${informe.omitidos.length}`);
  console.log(`Errores: ${informe.errores.length}`);
  console.log('Informe: datos-importacion/resultado-importacion.json');

  if (informe.errores.length > 0) {
    process.exitCode = 1;
  }
}

importarCatalogo()
  .catch((error) => {
    console.error(`\nImportación detenida: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (supabase) {
      // Cerramos solo la sesión del script.
      await supabase.auth.signOut({ scope: 'local' });
    }
  });