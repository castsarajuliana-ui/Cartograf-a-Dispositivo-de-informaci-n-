# Configurar el archivo central de PixelNest

El archivo central permite que las fotos nuevas lleguen desde distintos dispositivos y que solo la administradora consulte la galería completa. Las imágenes se guardan en un bucket privado de Supabase; el proyecto no contiene contraseñas ni claves secretas.

## 1. Crear el proyecto y la cuenta administradora

1. Crea un proyecto en Supabase.
2. En **Authentication > Users**, crea el usuario administrador con el correo que usarás para consultar el archivo.
3. Desactiva los registros públicos de usuarios. No compartas la contraseña administradora.
4. Si el proyecto requiere URLs de retorno, agrega la dirección HTTPS donde publicarás PixelNest.

## 2. Crear tablas, almacenamiento y permisos

1. Abre `supabase-setup.sql`.
2. Reemplaza todas las apariciones de `REPLACE_WITH_ADMIN_EMAIL` por el correo exacto del usuario administrador.
3. Ejecuta el SQL en **SQL Editor** de Supabase.

Las políticas permiten enviar fotos sin iniciar sesión, pero solo el correo administrador puede leerlas o eliminarlas. El bucket es privado.

## 3. Conectar la página

En **Project Settings > API**, copia la URL del proyecto y la clave `anon`/publicable. En `supabase-config.js`, asigna esos valores a `url` y `anonKey`.

Usa únicamente la clave pública `anon`/publicable. **Nunca** pongas la clave `service_role` en los archivos de la página.

## 4. Publicar para todos los dispositivos

Publica `index.html`, `styles.css`, `script.js` y `supabase-config.js` en un sitio web servido por HTTPS. Abrir la página como archivo local (`file://`) no la hace accesible por internet ni permite sincronizarla entre dispositivos.

Una vez publicada y conectada, las fotos nuevas se guardan en el dispositivo y se envían al archivo central. Si la conexión falla, la página avisa y conserva la copia local para reintentar.

En el panel **Archivo central**, inicia sesión con la cuenta administradora para ver la galería completa, eliminar fotos del archivo central y descargar un respaldo JSON con todas las imágenes.

## 5. Importar fotos que ya estaban guardadas

Los datos de `file://` y del nuevo sitio HTTPS se guardan en ubicaciones distintas del navegador. Para trasladar el álbum que ya tienes:

1. Abre esta versión de PixelNest en el navegador donde estaban guardadas las fotos.
2. En **Archivo central**, pulsa **Descargar fotos guardadas en este dispositivo**.
3. Abre la página publicada por HTTPS y pulsa **Importar un respaldo local**.
4. Confirma la importación. Si el servicio ya está configurado, las fotos importadas se copiarán al archivo central.

Para fotos antiguas guardadas en otros dispositivos, repite esos pasos en cada dispositivo. Las fotos nuevas se sincronizan automáticamente cuando se usa la página publicada.

Los respaldos JSON contienen las imágenes; guárdalos en un lugar privado.
