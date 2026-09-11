import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            /*
              Reparto por RUTA del módulo, no por nombre de paquete.

              Con la lista por nombre (`vendor: ['react-dom', ...]`) Rollup sólo
              agrupaba el punto de entrada exacto de cada paquete. `react-dom`
              se usa en realidad como `react-dom/client`, que es OTRO módulo y
              por tanto no entraba en `vendor`: el grueso de React acababa
              dentro del paquete de arranque de la aplicación, que cambia en
              cada despliegue. Resultado: 228 kB que el navegador volvía a
              descargar tras cada subida, en vez de reutilizarlos de su caché.
              Comprobando la ruta entra todo el paquete, sus submódulos
              incluidos.
            */
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return;

              // `scheduler` es una dependencia interna de react-dom: si se
              // queda fuera, arrastra a react-dom con ella.
              if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|zustand)[\\/]/.test(id)) {
                return 'vendor';
              }

              // Los iconos van juntos y aparte: los comparten el escritorio y
              // el móvil, así que el navegador los descarga una sola vez para
              // las dos interfaces.
              if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'icons';

              /*
                Arrastrar y soltar: sólo lo usan el tablero de Finanzas y el
                gestor de etiquetas, ambos de escritorio. Estaba metido en el
                mismo paquete que los iconos, de modo que TODO teléfono se
                descargaba un motor de arrastre que el modo móvil no usa en
                ninguna pantalla.
              */
              if (/[\\/]node_modules[\\/]@dnd-kit[\\/]/.test(id)) return 'dnd';

              if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return 'supabase';

              // xlsx/jszip se importan con import() dinámico donde se usan
              // (exportar/importar Excel, exportar ZIP de imágenes), así que ya
              // no deben ir junto a supabase-js, que se carga en cada página.
              if (/[\\/]node_modules[\\/]xlsx[\\/]/.test(id)) return 'xlsx';
            }
          }
        },
        chunkSizeWarningLimit: 1000,
      },
      esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : [],
      }
    };
});
