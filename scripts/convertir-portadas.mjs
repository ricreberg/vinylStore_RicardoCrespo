import { mkdir, readFile, writeFile, rename, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const carpetaDatos = new URL('../datos-importacion/', import.meta.url);
const carpetaWebp = new URL('portadas-webp/', carpetaDatos);
const archivoCatalogo = new URL('catalogo.json', carpetaDatos);
const archivoTemporal = new URL('catalogo.tmp.json', carpetaDatos);

async function convertirPortadas() {
  const catalogo = JSON.parse(
    await readFile(archivoCatalogo, 'utf8'),
  );

  if (!Array.isArray(catalogo) || catalogo.length === 0) {
    throw new Error('El catálogo está vacío o no contiene una lista.');
  }

  // Comprobamos los datos antes de comenzar la conversión.
  for (const disco of catalogo) {
    if (!disco.musicbrainz_id || !disco.imagen_local) {
      throw new Error(
        `Faltan datos o portada: ${disco.artista} / ${disco.titulo}.`,
      );
    }
  }

  await mkdir(carpetaWebp, { recursive: true });

  let pesoOriginal = 0;
  let pesoWebp = 0;

  for (const [indice, disco] of catalogo.entries()) {
    // Guardamos la ruta original para poder repetir la conversión
    // sin comprimir otra vez una imagen ya convertida.
    const rutaOriginal = disco.imagen_original ?? disco.imagen_local;
    const entrada = new URL(rutaOriginal, carpetaDatos);

    const nombre = `${disco.musicbrainz_id}.webp`;
    const salida = new URL(nombre, carpetaWebp);

    const original = await stat(entrada);

    await sharp(fileURLToPath(entrada))
      .autoOrient()
      .resize({
        width: 500,
        height: 500,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(fileURLToPath(salida));

    const convertido = await stat(salida);

    pesoOriginal += original.size;
    pesoWebp += convertido.size;

    disco.imagen_original = rutaOriginal;
    disco.imagen_local = `portadas-webp/${nombre}`;

    console.log(
      `[${indice + 1}/${catalogo.length}] ` +
      `${disco.artista} — ${disco.titulo}: ` +
      `${(original.size / 1024).toFixed(1)} KB → ` +
      `${(convertido.size / 1024).toFixed(1)} KB`,
    );
  }

  // Primero escribimos un archivo temporal y después sustituimos el JSON.
  await writeFile(
    archivoTemporal,
    JSON.stringify(catalogo, null, 2) + '\n',
  );

  await rename(archivoTemporal, archivoCatalogo);

  const reduccion = (1 - pesoWebp / pesoOriginal) * 100;

  console.log('\nConversión terminada.');
  console.log(`Portadas WebP: ${catalogo.length}`);
  console.log(
    `Peso original: ${(pesoOriginal / 1024 / 1024).toFixed(2)} MiB`,
  );
  console.log(
    `Peso WebP: ${(pesoWebp / 1024 / 1024).toFixed(2)} MiB`,
  );
  console.log(`Reducción total: ${reduccion.toFixed(1)} %`);
  console.log('catalogo.json actualizado.');
  console.log('Originales conservados. Supabase no se ha modificado.');
}

convertirPortadas().catch((error) => {
  console.error(`\nNo se ha completado la conversión: ${error.message}`);
  console.error('El archivo catalogo.json no se ha sustituido.');
  process.exitCode = 1;
});