# Motores y librerías 2D recomendados  
Para un juego de desplazamiento lateral web lo más práctico es usar un **game engine HTML5/JS** existente. Por ejemplo, **Phaser 3** es un framework 2D muy popular diseñado para navegadores. Phaser permite dibujar en un elemento `canvas` (o WebGL) y ofrece manejo integrado de escenas, físicas básicas, tilemaps, sprites y carga de recursos. Otra opción es **melonJS**, un motor ligero open-source especializado en plataformas 2D, que ofrece renderización GPU/WebGL con fallback a canvas y soporte nativo de mapas creados con Tiled. Incluso Stage.js puede servir para juegos sencillos: es una biblioteca canvas para juegos 2D básicos. En cualquier caso, el juego correrá dentro de un elemento HTML `<canvas>` (o WebGL) en el navegador, lo que garantiza compatibilidad en desktop y móvil.

# Formatos de datos (mapas y eventos)  
Para definir niveles y metadatos es común usar **archivos JSON o CSV**. Ambos formatos pueden describir la disposición del mapa (tiles, coordenadas) y datos extra (textos, imágenes, fechas). En Phaser, por ejemplo, la API de Tilemap admite cargar mapas exportados de Tiled en JSON o CSV. Tiled es un editor de niveles 2D muy usado; exporta mapas a **JSON**, **CSV** (y otros formatos). Gracias a esto, se puede diseñar visualmente el escenario (capas de fondo, muros, tuberías, parallax) y exportarlo como JSON que lee el juego. En melonJS la integración con Tiled también es completa (capas múltiples, objetos con propiedades, etc.).  

Esquema típico de datos en JSON:  

```json
{
  "background": "cielo.png",
  "tiles": [
    {"type":"wall","x":0,"y":0}, {"type":"wall","x":1,"y":0}, ... 
  ],
  "pipes": [
    {"x":10,"y":5}, {"x":20,"y":5}
  ],
  "icons": [
    {
      "type":"hongo",
      "x": 30, "y": 10,
      "title": "Graduación",
      "text": "Me gradué de la universidad.",
      "image": "grad.png",
      "year": 2010
    },
    {
      "type":"vida",
      "x": 50, "y": 8,
      "title": "Nacimiento",
      "text": "Nací en este año.",
      "image": "birth.jpg",
      "year": 1985
    }
  ],
  "darkZones": [
    {
      "x": 0, "y": 12, "width": 50, "height": 5,
      "title": "Pandemia COVID-19",
      "text": "Suspendido evento 2020.",
      "year": 2020
    }
  ]
}
```  

Cada objeto (pared, pipe, icono, zona oscura) lleva coordenadas y propiedades personalizadas. Phaser puede leer este JSON con su Loader (`this.load.json('nivel', 'datos.json')`) y luego crear los elementos adecuados en la escena. También se puede usar un CSV en caso de solo necesitar una matriz de tiles; la API Tilemap de Phaser puede cargar CSV con métodos como `this.load.tilemapTiledCSV` (o usar un array 2D en código). En resumen, **JSON** es ideal para flexibilidad (textos largos, múltiples atributos) y **CSV** para datos de tiles en cuadrícula simple.

# Arquitectura general de la aplicación  
El cliente web integrará varios componentes básicos:  

- **Bucle de juego y escenas**: Según la arquitectura de Phaser, existe un bucle infinito (“Game Loop”) que procesa constantemente entradas, física y renderizado. Se divide la lógica en *escenas* independientes: por ejemplo, una escena de carga (preload) y una escena principal de juego. Cada escena tiene métodos `preload()` (carga de recursos), `create()` (creación de objetos) y `update()` (lógica cada frame).  
- **Renderizado en Canvas/WebGL**: El motor dibuja mapas y sprites en un `<canvas>`. Para el scroll lateral 2D se configuran capas de tiles (fondo, suelo, foreground) y la cámara sigue al personaje. Phaser facilita cámaras desplazables (soporte multi-cámara) para hacer scrolling parallax.  
- **Tilemap y tilesets**: Se carga un *tilemap* (por ejemplo, JSON exportado de Tiled) que define los tiles de piso, paredes y plataformas. Esto genera layers de tiles en el juego. Cada tile se asocia a colisiones si corresponde (por ejemplo las paredes bloquean movimiento). En Phaser cada *Tileset* es un conjunto de imágenes en cuadrícula que forman el mapa.  
- **Jugador (Sprite)**: El avatar del usuario es un *sprite* animado (por ejemplo un personaje estilo Mario). Se crea con `this.physics.add.sprite()` (en Phaser) o equivalente, se le aplica gravedad horizontal/vertical y límites de movimiento. El jugador es un objeto con propiedades físicas (tamaño, velocidad, animaciones) y controlado por el teclado (flechas para moverse y saltar).  
- **Objetos interactivos (hongos, vidas, tuberías, marcas)**: Cada elemento icónico se representa también como un sprite. Por ejemplo, los *hongos* y *vidas extra* se crean leyendo los datos JSON: por cada objeto “icon” se instancia un sprite en (x,y). Estos sprites pueden ser estáticos (no afectados por gravedad) y con colisión especial. Se les asigna un tipo interno (p.ej. `type="hongo"`) para distinguir su lógica.  

- **Detector de colisiones/solapamientos**: Para saber cuándo el jugador interactúa con un icono, se usan los sistemas de física: en Phaser típicamente `this.physics.add.collider(jugador, paredes)` para detenerlo en paredes, y `this.physics.add.overlap(jugador, iconos, callback)` para detectar cuando toca un hongo o vida. En el callback se ejecuta la acción correspondiente (mostrar información, marcar evento) y opcionalmente se destruye o desactiva el icono recogido.  
- **Gestor de datos/estado**: Se almacena el estado del juego (posición del jugador, eventos ocurridos, puntuación). Al cargar la escena, se lee el JSON (p. ej. `let data = this.cache.json.get('nivelDatos')` en Phaser). A partir de ese objeto se construye el mapa, los sprites interactivos, las zonas oscuras, etc. El código de la escena intercala lectura del JSON con llamadas a la API del motor.  
- **UI / Modales / Texto**: Se necesita mostrar imágenes y textos en eventos importantes. Para esto se usan overlays HTML/CSS o ventanas emergentes internas. Por ejemplo, se puede crear una **escena de interfaz** (UI) separada que se lanza por encima de la de juego cuando ocurre un evento. En Phaser, una práctica común es crear una escena “ModalScene” con un fondo semitransparente y texto/imágenes, y lanzarla desde la escena principal. Otra opción es usar elementos DOM flotantes: Phaser permite incorporar elementos HTML en el canvas con `scene.add.dom(...)`. En cualquiera de los casos, al tocar un ícono se pausa el juego (o escena) y se muestra la ventana con la imagen y texto asignado (incluyendo la marca de tiempo o año del evento).  

En resumen, la infraestructura incluye *un renderer* (Canvas/WebGL), *un bucle principal*, *gestor de escenas*, *carga de assets* (imágenes, spritesheets, JSON/CSV), *motor físico/cámara*, *manejadores de entrada* (teclado), y *subsistemas de UI* para modales y HUD. Cada componente es escalable: por ejemplo, al cambiar el JSON se agregan nuevos eventos sin tocar la lógica base.

# Definición de datos y scripting de eventos  
Se debe definir un esquema de datos que describa todos los elementos personalizables. Por ejemplo, en el JSON de nivel puede haber campos como:  

- **Capas de tiles**: referencia a la imagen de fondo, tamaños de tile, matrices de valores (en CSV) o rutas de tileset.  
- **Objetos de fondo/piso**: arrays de rectángulos o puntos que marcan muros y suelo (para colisiones).  
- **Íconos de evento**: lista de objetos con propiedades `{ type, x, y, title, text, image, timestamp }`.  Aquí `type` puede ser `"hongo"`, `"vida"`, etc., y el juego sabe asociar cada tipo con una imagen sprite. Las coordenadas `(x,y)` indican posición en el mapa (en unidades de tile o píxeles). Los campos `title,text,image,timestamp` contienen el contenido del modal: texto descriptivo, ruta de imagen, y la marca de tiempo (año o fecha) del evento.  
- **Zonas especiales**: e.g. `"darkZones"` con `{x,y,width,height,title,text,timestamp}`. El juego al leer esto crea un sprite rectangular semitransparente negro sobre esa área, resaltando un “período oscuro” (p.ej. la pandemia).  

En el código, tras cargar el JSON, se realiza algo como:  

```js
// Pseudocódigo en Phaser:
let data = this.cache.json.get('nivelDatos');

// Crear tilemap de fondo (layer) usando data.tilemap
const map = this.make.tilemap({ data: data.tiles, tileWidth: 32, tileHeight: 32 });
map.addTilesetImage('spritesheet');
// ... configurar capas y colisiones ...

// Crear jugador
this.player = this.physics.add.sprite(data.playerStart.x, data.playerStart.y, 'playerSprite');

// Crear objetos fijos (muros, pipes)
data.walls.forEach(obj => {
  let muro = this.physics.add.staticImage(obj.x, obj.y, 'brick');
  this.physics.add.collider(this.player, muro);
});

// Crear iconos de evento
data.icons.forEach(ev => {
  let spr = this.physics.add.staticSprite(ev.x, ev.y, ev.type); // carga sprite según ev.type
  spr.evData = ev;  // guardar los datos del evento en la instancia
  this.physics.add.overlap(this.player, spr, (pj, icon) => {
    // al solapar, mostrar modal con info:
    showEventModal(icon.evData);
    icon.destroy();
  });
});

// Zonas oscuras
data.darkZones.forEach(zone => {
  let overlay = this.add.rectangle(zone.x, zone.y, zone.width, zone.height, 0x000000, 0.5);
  // se puede omitir física, solo estético
});
```

Este pseudocódigo ilustra cómo recorrer las listas JSON para instanciar objetos en la escena. La clave es que **todo lo personalizable esté en datos externos** (JSON/CSV), y la lógica de juego sea genérica: para cada elemento del nivel crea un sprite con colisión, y asigna manejadores (callbacks) para los eventos.


# Arbol de archivos propuesto
life-game/

 ├── src/
 │
 ├── engine/
 │     CameraManager.ts
 │     PhysicsManager.ts
 │     AssetManager.ts
 │     EventSystem.ts
 │     UIManager.ts
 │     Timeline.ts
 │     SaveManager.ts
 │     AudioManager.ts
 │
 ├── scenes/
 │     BootScene.ts
 │     PreloadScene.ts
 │     MainScene.ts
 │     UIScene.ts
 │
 ├── entities/
 │     Player.ts
 │     Pipe.ts
 │     Mushroom.ts
 │     Life.ts
 │     Trigger.ts
 │     Background.ts
 │     Platform.ts
 │
 ├── components/
 │     SpriteComponent.ts
 │     ColliderComponent.ts
 │     ScriptComponent.ts
 │     AnimationComponent.ts
 │
 ├── scripts/
 │     TriggerScript.ts
 │     CameraScript.ts
 │     TimelineScript.ts
 │
 ├── data/
 │     world.json
 │     events.json
 │     assets.json
 │
 ├── assets/
 │     sprites/
 │     music/
 │     fonts/
 │     images/
 │
 ├── ui/
 │     Modal.ts
 │     HUD.ts
 │     Timeline.ts
 │
 ├── styles/
 │
 ├── public/
 │
 ├── README.md
 │
 └── package.json

# Interactividad y personalización  
Con esta infraestructura basada en datos, la **personalización es sencilla**. Para añadir un nuevo evento basta con editar el JSON/CSV: por ejemplo, agregar un nuevo objeto `{type:"hongo", x:70, y:12, title:"Vacaciones", text:"Fui a Tal ciudad...", image:"vacaciones.jpg", year:2015}`. El código interpretará el campo `type` y dibujará el sprite “hongo” predefinido, luego al colisionar mostrará el modal con `title/text/image/year` extraídos del JSON. Lo mismo para fondos o muros: cambiando las coordenadas o el tileset en el JSON se ajusta el nivel.

Para **marcas de tiempo**, simplemente incluya un campo de fecha o año en los datos. El modal puede mostrarlo como texto adicional. Alternativamente, se puede renderizar un objeto gráfico (ej. un icono de reloj o un texto fijo) en la escena indicando la edad o año actual del personaje. 

La zona oscura se distingue visualmente sobre el mapa: se coloca un rectángulo semitransparente (p.ej. color negro con alfa) en las coordenadas definidas en el JSON, produciendo efecto de “penumbra” en esa región. Esto se puede lograr con un objeto gráfico: `this.add.rectangle(x, y, w, h, 0x000000, 0.5)` en Phaser. Cuando el jugador entra en esa área, opcionalmente se podría cambiar la música o tono.

# Conclusión – Componentes clave  
En resumen, la aplicación requiere estos componentes principales:  

- **Carga de assets y datos**: escenas de preload que usan `this.load.image`, `this.load.spritesheet` y `this.load.json`/`tilemap` para cargar imágenes y archivos JSON/CSV.  
- **Tilemap y Layers**: creación de mapas de tiles a partir de JSON/CSV (p.ej. `this.load.tilemapTiledJSON('map', 'mapa.json')`). Se generan capas estáticas que definen fondo, plataformas y colisiones.  
- **Jugador y Sprites**: sprite del personaje con físicas (movimiento y saltos), más sprites estáticos para hongos/vidas/pipes, cargados desde atlas o imágenes según el tipo. Los sprites animados (jugador) usan hojas de sprites (spritesheet).  
- **Física y Colisiones**: motor físico simple (propio del engine) para gravedad y colisión. Se definen colisiones player-pared, player-icono (overlap) para disparar eventos.  
- **Cámara Scroll**: cámara que sigue al jugador a lo largo del nivel (scroll lateral). Phaser permite `cameras.main.startFollow(player)` para este fin.  
- **UI / Modals**: escena o sistema de UI independiente. Al activarse un evento (colisión con icono), se lanza un modal con texto e imagen. Esto se puede implementar con otra escena encima (p.ej. una `ModalScene` con fondo oscuro), o con elementos DOM (`scene.add.dom`) si se prefiere HTML.  
- **Sistema de datos**: el contenido del juego (textos, imágenes de eventos, posiciones) viene de un JSON externo. El juego parsea este JSON en `create()` y genera todo dinámicamente. Así se separa la lógica de la presentación de los datos personales.  

Toda la infraestructura busca ser **fácilmente personalizable**: basta con modificar el archivo JSON/CSV para cambiar fondos, añadir eventos, ajustar posiciones o contenidos, sin cambiar el código fuente. En esencia, el juego lee y dibuja el nivel a partir de esos datos, y reacciona programáticamente a las interacciones del jugador según los scripts asociados a cada icono/evento.

**Referencias:** La documentación de Phaser confirma que puede cargar mapas Tiled en JSON/CSV, mientras guías como *Envato Tuts+* destacan Phaser y MelonJS como motores 2D HTML5 rápidos y gratuitos. Phaser en particular implementa un bucle de juego con escenas, sprites y tilesets tal como se describió. Para la UI, la comunidad sugiere crear escenas modales independientes o usar DOM con Phaser 3. Todas estas fuentes respaldan la arquitectura aquí planteada.