# GeoScript — Premium Civic Technology

Sistema de diseño de la interfaz web/PWA de GeoScript, la plataforma municipal de reportes ciudadanos sobre fallas en servicios públicos.
La fuente de verdad es `frontend/src/index.css` (tokens en `@theme` de Tailwind v4 + clases de componente). Este documento explica las decisiones; si algo cambia en el CSS, se actualiza aquí.

## 1. Punto de partida (auditoría)

- **Arquitectura móvil:** web responsive + **PWA** (`vite-plugin-pwa`, manifest, service worker, accesos directos). No hay Capacitor ni app nativa. Se mantiene: la PWA ya instala, funciona sin conexión y es la base para empaquetar con Capacitor más adelante sin reescribir.
- **Stack visual:** React 18 + Tailwind v4 (`@theme`), HeadlessUI, Heroicons (outline 24), `motion` para transiciones, Mapbox GL vía `react-map-gl`.
- **Lo que ya funcionaba:** tokens de marca y sombras centralizados, foco visible, `prefers-reduced-motion`, áreas táctiles de 44 px, barra inferior con *safe areas*, marcadores y tarjetas del mapa propios.
- **Lo que se sentía de plantilla:**
  - Etiquetas en mayúsculas con tracking sobre cada título ("PANEL DE ADMINISTRACIÓN", "ADMINISTRACIÓN").
  - Indicadores como cuatro tarjetas idénticas con icono en cuadro de color y flecha: el kit de tablero genérico.
  - Un solo radio para todo (tarjetas, botones, entradas), así que no había jerarquía de formas.
  - Tipografía Lexend: redondeada y amable, más educativa que institucional-tecnológica.
  - Exceso de pastillas por fila en las listas del administrador.
  - En el mapa móvil, ocho controles flotantes compiten con el mapa.
- **Defecto encontrado:** en el celular el logotipo se veía como un punto. El degradado del SVG usaba un `id` fijo y la primera copia vive en la barra lateral oculta (`display:none`), así que la referencia fallaba.

> La referencia visual mencionada en la solicitud no llegó adjunta a la conversación. La dirección se basa en la descripción escrita (minimalismo tecnológico de inspiración Apple, sin copiarlo).

## 2. Idea rectora

**"Papel y material."** La interfaz es papel institucional: superficies sólidas, claras, con filetes finos y tipografía precisa. Solo lo que **flota sobre la ciudad** usa *material*, una capa translúcida con desenfoque: los controles del mapa, la barra inferior y el encabezado móvil. Así la transparencia tiene un significado ("esto está encima del mapa o del contenido") y no se vuelve decoración.

La audacia se gasta en un solo lugar: **el mapa** (marcadores "señal GeoScript", controles de instrumento) y, en el resumen del administrador, **la cifra** como protagonista tipográfico. Todo lo demás queda quieto y disciplinado.

## 3. Color

| Token | Valor | Uso |
|---|---|---|
| `brand-600` | `#2556EB` | Azul cívico institucional: acción principal, enlaces, selección (5.4:1 sobre blanco). |
| `brand-700` | `#1D43D8` | Texto de marca y *hover* (7:1). |
| `ink` (`slate-900`) | `#0F172A` | Texto principal y títulos. |
| `slate-600` / `slate-500` | `#475569` / `#64748B` | Texto secundario; 500 solo para tamaños ≥ 14 px (4.8:1). |
| `canvas` | `#F3F5F8` | Fondo de la aplicación (porcelana fría). |
| `surface` | `#FFFFFF` | Papel: tarjetas, paneles, diálogos. |
| `surface-sunken` | `#F7F8FA` | Zonas hundidas dentro de una tarjeta (filtros, pies). |
| `line` / `line-strong` | `#E4E8EE` / `#CDD4DE` | Filetes y bordes de controles. |
| `material` | `rgb(255 255 255 / .78)` + `blur(20px) saturate(1.6)` | Solo elementos que flotan sobre el mapa o el contenido. |

**Semánticos (estados de reporte y mensajes).** El color nunca va solo: siempre se acompaña de texto o forma.

| Estado | Color | Ejemplo |
|---|---|---|
| Recibido / por atender | ámbar `#B45309` texto, `#FEF3C7` fondo | Pastilla "Recibido" |
| En atención | azul cívico | "Asignado", "En atención" |
| Resuelto | verde `#15803D`, `#DCFCE7` | "Resuelto" |
| Crítico / error | rojo `#B91C1C`, `#FEE2E2` | Rombo crítico, errores |
| Cerrado / inactivo | `slate-500` | Contorno sin relleno |

## 4. Tipografía

- **Familia única: Instrument Sans** (Google Fonts, variable 400–700). Es una grotesca de proporciones contenidas y remates rectos. Se lee técnica y precisa sin la frialdad de las genéricas. Cubre el español completo.
- Pila de respaldo: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.
- Las cifras usan `tabular-nums` para que los indicadores no "bailen" al actualizarse.

| Rol | Tamaño / interlínea | Peso | Tracking |
|---|---|---|---|
| Cifra (indicadores) | 40/44 → 48/52 en escritorio | 600 | −0.03em |
| Título de página (`.page-title`) | 28/34 → 34/40 | 600 | −0.025em |
| Título de sección (h2) | 20/28 | 600 | −0.015em |
| Título de tarjeta (`.card-title`) | 17/24 | 600 | −0.01em |
| Texto | 16/24 | 400 | 0 |
| Secundario | 14/20 | 400–500 | 0 |
| Leyenda (`.eyebrow`, metadatos) | 13/18 | 500 | 0, **en tipo oración** |

No se usan mayúsculas sostenidas para etiquetas ni se resalta una sola palabra de un título.

## 5. Espaciado y retícula

- Base de **4 px**. Escala usada: 4, 8, 12, 16, 20, 24, 32, 48, 64.
- Dentro de una tarjeta: 20 px (móvil) / 24 px (escritorio). Entre secciones de página: 32 px (móvil) / 40 px.
- Contenido con ancho máximo de 72 rem (1152 px) y medida de lectura ≤ 70 caracteres en textos largos.
- Márgenes de página: 16 px (390), 24 px (768), 40 px (≥ 1024).

## 6. Formas (radios con jerarquía)

| Elemento | Radio |
|---|---|
| Botones y pastillas de estado | completo (píldora) |
| Entradas, menús, elementos de lista | 12 px (`rounded-xl`) |
| Tarjetas y paneles | 20 px (`rounded-2xl`) |
| Diálogos y hojas inferiores | 28 px (`rounded-3xl`) |

## 7. Elevación

| Nivel | Token | Dónde |
|---|---|---|
| 0 | filete `line` | Elementos sobre el lienzo sin relieve. |
| 1 | `shadow-card` | Tarjetas y paneles (borde de 1 px + sombra difusa muy baja). |
| 2 | `shadow-lift` | *Hover* de elementos interactivos, menús. |
| 3 | `shadow-pop` | Diálogos, hojas, tarjeta del mapa. |
| Material | `shadow-float` + `material` | Controles del mapa, barra inferior. |

Las sombras están teñidas de tinta (`15 23 42`), son largas y de baja opacidad. Nunca se usa el gris plano `rgba(0,0,0,.1)`.

## 8. Componentes

### Botones
- `.btn-primary`: píldora azul sólida, 44 px de alto, para la acción principal (una por vista).
- `.btn-secondary`: píldora blanca con filete, para acciones alternativas.
- `.btn-danger`: píldora blanca con texto rojo; la confirmación destructiva usa un diálogo.
- `.btn-link`: texto azul con subrayado al pasar.
- Modificador `.btn-compact` (36 px) para filas y tablas.
- Estados: *hover* (oscurece), activo (escala 0.97), foco (anillo de 2 px de `brand-600` con separación), deshabilitado (50 % de opacidad, sin eventos).

### Campos de formulario
- `.label` sobre el campo (14 px, 600); la ayuda va debajo, en 13 px, `slate-500`.
- `.input`: 44 px, radio 12, filete `line-strong`. Al enfocar, el filete pasa a azul con un halo de 4 px al 15 %. Con `aria-invalid`, borde y halo rojos.
- El error va bajo el campo con icono y texto (`ErrorMessage`) y se asocia con `aria-describedby`.
- En el celular, los campos usan 16 px para que iOS no haga *zoom*. El botón de envío no queda tapado por el teclado: el formulario hace *scroll* y la barra inferior se oculta al escribir.

### Tarjetas
- `.card`: papel con radio 20, `shadow-card` y relleno de 20/24 px.
- Las listas se agrupan en **una** tarjeta con divisores, no en una tarjeta por elemento.
- Las tarjetas interactivas (enlaces) suben a `shadow-lift` al pasar el cursor; no se desplazan.

### Ventanas emergentes y hojas
- Diálogo (`Modal`): radio 28 y `shadow-pop`. El fondo es tinta al 40 % con desenfoque de 2 px; entra con fundido y escala de 0.98 a 1 (200 ms).
- En el celular, los menús y diálogos largos son **hojas inferiores**: con asa, radio superior de 28, que entran desde abajo, se cierran con la X, con Esc o tocando fuera, y respetan `safe-area-inset-bottom`.

### Menús
- `ActionMenu` / listas de selección: papel con radio 12, `shadow-lift`, opciones de 40 px y opción activa en `brand-50`.

### Navegación
- **Escritorio (≥ 1024 px):** barra lateral de 256 px sobre el mismo lienzo. No es un panel blanco aparte, solo se separa con un filete. El elemento activo es una píldora de papel con sombra nivel 1 y el icono en azul. Los grupos llevan un título en tipo oración.
- **Celular y tablet (< 1024 px):** barra inferior de *material* (en tablet se centra en 34 rem, como las apps nativas de iPad/Android) con 3–4 destinos y etiqueta siempre visible. El destino activo lleva una píldora tenue detrás del icono. El ciudadano tiene "Reportar" como botón central redondo. El resto de las secciones está en "Menú" (hoja inferior).
- **Encabezado móvil:** *material*, logotipo y avatar. En el mapa no hay encabezado: el mapa ocupa la pantalla.

### Estados de carga, error y vacío
- **Carga:** esqueletos con la forma del contenido final (`Skeleton`, `ListSkeleton`, `ReportCardSkeleton`), pulso suave. En recargas con datos ya visibles se muestra la etiqueta "Actualizando…", sin vaciar la pantalla.
- **Error:** panel rojo tenue con qué pasó y un botón "Reintentar". Sin disculpas ni vaguedades.
- **Vacío:** icono en un cuadro de marca, título que dice qué falta y una acción para resolverlo ("Crear el primer reporte").

## 9. Mapa

- Se conservan Mapbox y su atribución visibles.
- **Controles (5, antes 8):**
  - Arriba a la izquierda, una barra de herramientas de *material* con Filtros, Lista y Simbología; el número de filtros activos aparece como insignia.
  - Debajo, una línea de contexto: "N reportes en Tecamachalco, Puebla".
  - Arriba a la derecha, el zoom.
  - Abajo, "Vista 3D" a la izquierda y "Cerca de mí" a la derecha.
  - El centro queda libre.
- **Marcadores "señal GeoScript":** placa con punta y un solo glifo por etapa; el crítico es un rombo rojo. Están en `index.css`, sección *Marcadores*.
- **Grupos:** anillo con la proporción por etapa y la cifra al centro; el rombo rojo indica cuántos son críticos.
- **Tarjeta del reporte:** *popup* de 288 px en escritorio y hoja inferior en el celular, con `shadow-pop`.

## 10. Movimiento

- Respuesta a la acción del usuario: 150 ms `ease-out` (*hover*, pulsación).
- Paneles, hojas y diálogos: 200–300 ms con `cubic-bezier(.22,1,.36,1)`.
- Sin animaciones infinitas ni entradas escalonadas en cada sección. Solo hay un fundido de página al navegar.
- Con `prefers-reduced-motion: reduce`, las transiciones quedan en 0.01 ms.

## 11. Accesibilidad y rendimiento

- Contraste AA como mínimo: texto principal 16:1, secundario ≥ 4.5:1.
- Foco visible en todo elemento interactivo y enlace "Saltar al contenido".
- Iconos decorativos con `aria-hidden`; botones solo de icono con `aria-label`.
- Objetivos táctiles de al menos 44 × 44 px; separación mínima de 8 px.
- Una sola familia tipográfica variable, cargada con `display=swap`.
- Desenfoques solo en 3–4 superficies a la vez, nunca en listas largas, para cuidar los teléfonos de gama media.
- Imágenes con `loading="lazy"` y miniaturas del servidor (`thumbUrl`).

## 12. Indicadores del administrador

El resumen no usa cuatro tarjetas iguales. Es **un solo panel** dividido por filetes, con la cifra como protagonista (clase `.figure`, 40–48 px). Un punto de color y una etiqueta dicen la etapa, y "Requieren atención" va primero y en rojo cuando hay casos. En la lista, cada fila muestra solo la pastilla de estado; los motivos van en una línea de texto, y el rombo rojo marca la gravedad crítica (la misma forma que en el mapa).

## 13. Reglas de uso

1. Antes de crear un estilo nuevo, busca el token o la clase existente.
2. Un color nuevo se agrega como token en `@theme`, nunca como valor suelto en un componente.
3. *Material* (transparencia) solo para lo que flota sobre el mapa o el contenido.
4. Una acción primaria por vista.
5. Sin mayúsculas sostenidas en etiquetas, sin numeración decorativa y sin flechas añadidas a los textos de botones.
