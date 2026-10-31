import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Las rutas se calculan desde este archivo, no desde la terminal.
const carpetaSalida = new URL('../datos-importacion/', import.meta.url);
const carpetaPortadas = new URL('portadas/', carpetaSalida);
const archivoCatalogo = new URL('catalogo.json', carpetaSalida);

// Identificamos el proyecto al consultar la API.
const cabeceras = {
  'User-Agent':
    'VinylStoreRicardoCrespo/1.0 (https://github.com/ricreberg/vinylStore_RicardoCrespo)',
};

// Cada fila contiene: género, artista y sus dos álbumes.
// Es una selección de álbumes, no de ediciones concretas de vinilo.
const seleccion = [
  ['Rock', 'The Beatles', 'Abbey Road', 'Revolver'],
  ['Rock', 'Pink Floyd', 'The Dark Side of the Moon', 'Wish You Were Here'],
  ['Rock', 'Fleetwood Mac', 'Rumours', 'Tusk'],
  ['Rock', 'David Bowie', 'Hunky Dory'],
  ['Rock', 'Nirvana', 'Nevermind', 'In Utero'],

  ['Pop', 'Michael Jackson', 'Thriller', 'Bad'],
  ['Pop', 'Madonna', 'Like a Prayer', 'True Blue'],
  ['Pop', 'Prince', 'Purple Rain', '1999'],
  ['Pop', 'Adele', '21', '25'],
  ['Pop', 'Dua Lipa', 'Future Nostalgia', 'Radical Optimism'],

  ['Jazz', 'Miles Davis', 'Kind of Blue', 'Sketches of Spain'],
  ['Jazz', 'John Coltrane', 'Blue Train', 'A Love Supreme'],
  ['Jazz', 'Nina Simone', 'Little Girl Blue', 'I Put a Spell on You'],
  ['Jazz', 'Herbie Hancock', 'Head Hunters', 'Maiden Voyage'],
  ['Jazz', 'Chet Baker', 'Chet Baker Sings', 'Chet'],

  ['Soul', 'Aretha Franklin', 'Lady Soul', 'I Never Loved a Man the Way I Love You'],
  ['Soul', 'Marvin Gaye', "Let's Get It On"],
  ['Soul', 'Stevie Wonder', 'Innervisions', 'Songs in the Key of Life'],
  ['Soul', 'Amy Winehouse', 'Frank', 'Back to Black'],
  ['Soul', 'Sade', 'Diamond Life', 'Promise'],

  ['Electrónica', 'Daft Punk', 'Discovery', 'Random Access Memories'],
  ['Electrónica', 'Massive Attack', 'Blue Lines', 'Mezzanine'],
  ['Electrónica', 'Portishead', 'Dummy', 'Portishead'],
  ['Electrónica', 'Björk', 'Post', 'Homogenic'],
  ['Electrónica', 'The Chemical Brothers', 'Dig Your Own Hole', 'Surrender'],

  ['Hip hop', 'Kendrick Lamar', 'good kid, m.A.A.d city', 'To Pimp a Butterfly'],
  ['Hip hop', 'Nas', 'Illmatic', 'It Was Written'],
  ['Hip hop', 'OutKast', 'ATLiens', 'Stankonia'],
  ['Hip hop', 'A Tribe Called Quest', 'The Low End Theory', 'Midnight Marauders'],
  ['Pop', 'Taylor Swift', '1989', 'Red', 'folklore', 'evermore'],
];

// Convertimos las filas anteriores en una lista de 60 discos.
const discos = [];

for (const [genero, artista, ...titulos] of seleccion) {
  for (const titulo of titulos) {
    discos.push({ genero, artista, titulo });
  }
}

function esperar(milisegundos) {
  return new Promise((resolver) => setTimeout(resolver, milisegundos));
}

// Permite comparar nombres aunque cambien tildes o signos.
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Reintentamos si hay problemas de red o el servidor está ocupado.
async function solicitar(url) {
  let ultimoError;

  for (let intento = 1; intento <= 3; intento++) {
    try {
      const respuesta = await fetch(url, {
        headers: cabeceras,
        signal: AbortSignal.timeout(25000),
      });

      if (respuesta.ok || respuesta.status === 404) {
        return respuesta;
      }

      if (respuesta.status !== 429 && respuesta.status < 500) {
        throw new Error(`La consulta ha devuelto HTTP ${respuesta.status}.`);
      }

      ultimoError = new Error(
        `Servidor ocupado: HTTP ${respuesta.status}.`,
      );

      await respuesta.body?.cancel();
    } catch (error) {
      ultimoError = error;
    }

    if (intento < 3) {
      await esperar(3000 * intento);
    }
  }

  throw ultimoError;
}

async function buscarAlbum(disco) {
  // Dejamos margen respecto al límite de MusicBrainz.
  await esperar(1200);

  const url = new URL('https://musicbrainz.org/ws/2/release-group');

  url.searchParams.set(
    'query',
    `artist:"${disco.artista}" AND releasegroup:"${disco.titulo}" AND primarytype:album`,
  );
  url.searchParams.set('fmt', 'json');
  url.searchParams.set('limit', '10');

  const respuesta = await solicitar(url);

  if (!respuesta.ok) {
    throw new Error('No se ha podido consultar MusicBrainz.');
  }

  const datos = await respuesta.json();
  const resultados = datos['release-groups'] ?? [];

  // No elegimos simplemente el primer resultado:
  // deben coincidir el título y al menos uno de los artistas.
  const encontrado = resultados.find((album) => {
    const coincideTitulo =
      normalizar(album.title) === normalizar(disco.titulo);

    const coincideArtista = (album['artist-credit'] ?? []).some(
      (credito) =>
        normalizar(credito.artist?.name ?? credito.name ?? '') ===
        normalizar(disco.artista),
    );

    return coincideTitulo && coincideArtista;
  });

  if (!encontrado) {
    throw new Error('No se ha encontrado una coincidencia clara.');
  }

  return encontrado;
}

async function descargarPortada(identificador) {
  const url =
    `https://coverartarchive.org/release-group/${identificador}/front-500`;

  const respuesta = await solicitar(url);

  if (respuesta.status === 404) {
    return null;
  }

  const tipo = (respuesta.headers.get('content-type') ?? '')
    .split(';')[0]
    .trim();

  const extensiones = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  const extension = extensiones[tipo];

  if (!extension) {
    throw new Error(`Formato de portada no admitido: ${tipo}.`);
  }

  const contenido = Buffer.from(await respuesta.arrayBuffer());

  if (contenido.length > 2 * 1024 * 1024) {
    throw new Error('La portada supera los 2 MiB.');
  }

  const nombre = `${identificador}.${extension}`;

  await writeFile(new URL(nombre, carpetaPortadas), contenido);

  return {
    archivo: `portadas/${nombre}`,
    origen: url,
  };
}

// Crear carpetas no borra lo que ya contengan.
await mkdir(carpetaPortadas, { recursive: true });

// Recuperamos el resultado anterior para poder continuar otra ejecución.
let catalogo = [];

try {
  catalogo = JSON.parse(await readFile(archivoCatalogo, 'utf8'));

  if (!Array.isArray(catalogo)) {
    throw new Error('El archivo catalogo.json no contiene una lista.');
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    throw error;
  }
}

for (const [indice, disco] of discos.entries()) {
  console.log(
    `[${indice + 1}/${discos.length}] ${disco.artista} — ${disco.titulo}`,
  );

  const posicionAnterior = catalogo.findIndex(
    (producto) =>
      normalizar(producto.artista) === normalizar(disco.artista) &&
      normalizar(producto.titulo) === normalizar(disco.titulo),
  );

  const anterior = catalogo[posicionAnterior];

  // Lo que ya está completo no necesita descargarse otra vez.
  if (anterior?.musicbrainz_id && anterior?.imagen_local) {
    console.log('  Ya preparado.');
    continue;
  }

  const producto = {
    titulo: disco.titulo,
    artista: disco.artista,
    genero: disco.genero,

    // Valores ficticios de la tienda, no obtenidos de la API.
    precio: Number((19.9 + (indice % 8) * 3).toFixed(2)),
    stock: indice % 13 === 0 ? 0 : 1 + (indice % 12),
    descripcion: '',
    activo: true,

    musicbrainz_id: null,
    musicbrainz_url: null,
    imagen_local: null,
    portada_url: null,
    incidencia: null,
  };

  try {
    const album = await buscarAlbum(disco);
    const fecha = album['first-release-date'] ?? '';
    const anio = fecha.slice(0, 4);

    producto.titulo = album.title;
    producto.musicbrainz_id = album.id;
    producto.musicbrainz_url =
      `https://musicbrainz.org/release-group/${album.id}`;

    producto.descripcion = anio
      ? `Álbum de ${disco.artista}, publicado originalmente en ${anio}.`
      : `Álbum de ${disco.artista}.`;

    const portada = await descargarPortada(album.id);

    if (portada) {
      producto.imagen_local = portada.archivo;
      producto.portada_url = portada.origen;
      console.log('  Datos y portada preparados.');
    } else {
      producto.incidencia = 'No hay portada disponible para este álbum.';
      console.log('  Datos preparados; sin portada.');
    }
  } catch (error) {
    producto.incidencia = error.message;
    console.log(`  Pendiente de revisar: ${error.message}`);
  }

  if (posicionAnterior === -1) {
    catalogo.push(producto);
  } else {
    catalogo[posicionAnterior] = producto;
  }

  // Guardamos después de cada disco para conservar el progreso.
  await writeFile(
    archivoCatalogo,
    JSON.stringify(catalogo, null, 2) + '\n',
  );
}

const conDatos = catalogo.filter((producto) => producto.musicbrainz_id);
const conPortada = catalogo.filter((producto) => producto.imagen_local);
const pendientes = catalogo.filter((producto) => producto.incidencia);

console.log('\nResultado:');
console.log(`Registros preparados: ${catalogo.length}`);
console.log(`Con datos contrastados: ${conDatos.length}`);
console.log(`Con portada: ${conPortada.length}`);
console.log(`Con incidencias: ${pendientes.length}`);
console.log(`Carpeta: ${fileURLToPath(carpetaSalida)}`);

if (pendientes.length > 0) {
  console.log('\nPendientes de revisar:');

  for (const producto of pendientes) {
    console.log(
      `- ${producto.artista} / ${producto.titulo}: ${producto.incidencia}`,
    );
  }
}

console.log('\nNo se ha modificado Supabase.');