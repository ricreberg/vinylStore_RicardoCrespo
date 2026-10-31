import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const marca = 'vinylstore-demo-v1';

const nombres = [
  'Lucía Martín',
  'Daniel Romero',
  'Sara Molina',
  'Adrián Navarro',
  'Paula Serrano',
  'Marcos Vidal',
  'Elena Castro',
  'Álvaro Santos',
  'Clara Moreno',
  'Hugo Ortega',
  'Irene Delgado',
  'Pablo Rivas',
  'Nerea Campos',
  'Diego Lozano',
  'Marta Soler',
];

const carpetaDatos = new URL('../datos-importacion/', import.meta.url);
const archivoClientes = new URL('clientes-demo.json', carpetaDatos);

async function prepararClientes() {
  const clave = process.env.VINYL_SECRET_KEY;

  if (!clave?.startsWith('sb_secret_')) {
    throw new Error('La clave debe ser una Secret que empiece por sb_secret_.');
  }

  const entorno = await readFile(
    new URL('../src/environments/environment.ts', import.meta.url),
    'utf8',
  );

  const configuracion = entorno.match(
    /supabaseUrl\s*:\s*(['"])(.*?)\1/,
  );

  if (!configuracion) {
    throw new Error('No se encuentra supabaseUrl en environment.ts.');
  }

  const supabase = createClient(configuracion[2], clave, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data: listado, error: errorListado } =
    await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (errorListado) {
    throw errorListado;
  }

  const usuarios = listado.users;

  if (!usuarios.some(
    (usuario) => usuario.email === 'cliente@vinylstore.example',
  )) {
    throw new Error(
      'No se encuentra la cuenta original cliente@vinylstore.example.',
    );
  }

  await mkdir(carpetaDatos, { recursive: true });

  const clientes = [];

  for (const [indice, nombre] of nombres.entries()) {
    const esOriginal = indice === 0;

    const correo = esOriginal
      ? 'cliente@vinylstore.example'
      : `cliente${String(indice + 1).padStart(2, '0')}@vinylstore.example`;

    let usuario = usuarios.find((actual) => actual.email === correo);

    if (usuario) {
      if (!esOriginal && usuario.app_metadata?.origen_datos !== marca) {
        throw new Error(
          `${correo} ya existe y no pertenece a estos datos de demostración.`,
        );
      }

      // Comprobar el rol antes de modificar un perfil existente.
      const { data: perfil, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', usuario.id)
        .single();

      if (error || perfil?.role !== 'cliente') {
        throw new Error(`${correo} no tiene un perfil de cliente válido.`);
      }
    } else {
      // Cada cuenta nueva tiene una contraseña aleatoria diferente.
      const contrasena =
        `Demo!${randomBytes(24).toString('base64url')}9aA`;

      const { data, error } = await supabase.auth.admin.createUser({
        email: correo,
        password: contrasena,
        email_confirm: true,
        user_metadata: { nombre },
        app_metadata: { origen_datos: marca },
      });

      if (error) {
        throw new Error(`${correo}: ${error.message}`);
      }

      usuario = data.user;
    }

    // Solo cambiar el nombre del perfil.
    // El correo y la contraseña de la cuenta original se conservan.
    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles')
      .update({ nombre })
      .eq('id', usuario.id)
      .eq('role', 'cliente')
      .select('id')
      .single();

    if (errorPerfil || !perfil) {
      throw new Error(
        `No se ha podido guardar el perfil de ${correo}: ` +
        (errorPerfil?.message ?? 'perfil no disponible'),
      );
    }

    clientes.push({
      id: usuario.id,
      nombre,
      correo,
      cuenta_prueba: esOriginal,
    });

    await writeFile(
      archivoClientes,
      JSON.stringify(clientes, null, 2) + '\n',
    );

    console.log(
      `[${indice + 1}/15] ${nombre} — ${correo}` +
      (esOriginal ? ' — Cuenta original conservada' : ''),
    );
  }

  console.log('\nClientes preparados: 15');
  console.log('Tu cuenta mantiene su correo y contraseña originales.');
  console.log('Identificadores guardados en datos-importacion/clientes-demo.json');
}

prepararClientes().catch((error) => {
  console.error(`\nProceso detenido: ${error.message}`);
  process.exitCode = 1;
});