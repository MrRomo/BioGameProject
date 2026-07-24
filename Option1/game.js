// Configuración inicial de Phaser
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 200 }, debug: false } // Gravedad tipo Mario
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let player, cursors, levelData, backgroundRect;
let isPaused = false; // Bandera para pausar controles al abrir un modal
let inDarkZone = false; // Rastreo de zonas

// Redimensionar canvas al cambiar tamaño de ventana
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});

// 1. CARGA DE RECURSOS
function preload() {
    // Cargamos el Script que define tu vida
    this.load.json('levelData', 'level_data.json');
}

// 2. CREACIÓN DEL MUNDO
function create() {
    levelData = this.cache.json.get('levelData');
    const worldW = levelData.config.worldWidth;
    
    // Configurar los límites del mundo y la cámara
    this.cameras.main.setBounds(0, 0, worldW, window.innerHeight);
    this.physics.world.setBounds(0, 0, worldW, window.innerHeight);

    // Fondo Dinámico
    backgroundRect = this.add.rectangle(0, 0, worldW*2, window.innerHeight*2, 0x87CEEB).setOrigin(0,0);
    backgroundRect.setDepth(-1);

    // Grupos de físicas
    const platforms = this.physics.add.staticGroup();
    const milestones = this.physics.add.group({ allowGravity: false, immovable: true });
    
    // Generador de Escenario (Procedural con Formas Geométricas para facilitar inicio)
    levelData.scenery.forEach(item => {
        let rect = this.add.rectangle(item.x + item.width/2, item.y + item.height/2, item.width, item.height, 0x8B4513); // Café
        if(item.type === 'ground') rect.fillColor = 0x4CAF50; // Césped verde
        if(item.type === 'wall' || item.type === 'pipe') rect.fillColor = 0x2E7D32; // Tuberías verdes oscuras
        platforms.add(rect);
    });

    // Generador de Hitos Interactivos (Hongos, Estrellas)
    levelData.milestones.forEach(item => {
        let color = 0xff0000; // Rojo hongo por defecto
        if(item.icon === 'star') color = 0xffd700; // Amarillo estrella
        if(item.icon === 'heart') color = 0xff69b4; // Rosado corazón
        
        let milestone = this.add.circle(item.x, item.y, 20, color);
        milestones.add(milestone);
        milestone.modalData = item.modalData; // Inyectamos la info del JSON al objeto de Phaser
        
        // Efecto flotante
        this.tweens.add({
            targets: milestone, y: item.y - 15,
            duration: 1500, ease: 'Sine.inOut',
            yoyo: true, repeat: -1
        });
    });

    // Creación del "Tú" (Avatar del Jugador)
    player = this.add.rectangle(100, 300, 32, 48, 0x1E90FF); // Avatar Azul
    this.physics.add.existing(player);
    player.body.setBounce(0.1);
    player.body.setCollideWorldBounds(true);
    
    // La cámara te sigue
    this.cameras.main.startFollow(player, true, 0.08, 0.08);
    // Offset visual para que no estés pegado al centro vertical
    this.cameras.main.setFollowOffset(0, 100);

    // Detección de colisiones
    this.physics.add.collider(player, platforms);
    // overlap detona la recolección
    this.physics.add.overlap(player, milestones, hitMilestone, null, this);

    // Teclas de control (Flechas y Espacio)
    cursors = this.input.keyboard.createCursorKeys();
    
    // Conexión DOM - Botones del Modal
    document.getElementById('continue-btn').addEventListener('click', closeModal);
    document.getElementById('close-btn').addEventListener('click', closeModal);
}

// 3. ACTUALIZACIÓN (Bucle del Juego)
function update() {
    if(isPaused) {
        player.body.setVelocityX(0); // Quedarse quieto al leer
        return;
    }

    // Lógica de Movimiento
    const speed = 300;
    if (cursors.left.isDown) { 
        player.body.setVelocityX(-speed); 
    }
    else if (cursors.right.isDown) { 
        player.body.setVelocityX(speed); 
    }
    else { 
        player.body.setVelocityX(0); 
    }

    // Lógica de Salto (solo si toca suelo)
    if ((cursors.up.isDown || cursors.space.isDown) && player.body.touching.down) {
        player.body.setVelocityY(-550);
    }

    // Lógica de Zonas Oscuras / Eventos Ambientales
    let playerX = player.x;
    let currentZone = levelData.zones.find(z => playerX >= z.startX && playerX <= z.endX);
    let zoneText = document.getElementById('zone-text');
    
    // Oscurecer cielo
    if (currentZone && currentZone.theme === 'dark' && !inDarkZone) {
        inDarkZone = true;
        this.tweens.addCounter({
            from: 0, to: 100, duration: 1000,
            onUpdate: (tween) => {
                let v = tween.getValue();
                let c = Phaser.Display.Color.Interpolate.ColorWithColor(
                    Phaser.Display.Color.HexStringToColor('#87CEEB'),
                    Phaser.Display.Color.HexStringToColor('#222222'),
                    100, v);
                backgroundRect.fillColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
            }
        });
        zoneText.innerText = currentZone.ambientText;
        zoneText.classList.remove('hidden');
    } 
    // Aclarar cielo
    else if (!currentZone && inDarkZone) {
        inDarkZone = false;
        this.tweens.addCounter({
            from: 0, to: 100, duration: 1000,
            onUpdate: (tween) => {
                let v = tween.getValue();
                let c = Phaser.Display.Color.Interpolate.ColorWithColor(
                    Phaser.Display.Color.HexStringToColor('#222222'),
                    Phaser.Display.Color.HexStringToColor('#87CEEB'),
                    100, v);
                backgroundRect.fillColor = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
            }
        });
        zoneText.classList.add('hidden');
    }
}

// 4. FUNCIONES EXTERNAS
function hitMilestone(player, milestone) {
    if(isPaused) return; // Anti-rebote
    
    isPaused = true; 
    player.body.setVelocity(0,0);
    milestone.destroy(); // Recoger el hito
    
    // Extraer datos configurados en el JSON
    let data = milestone.modalData;
    
    // Inyectar en el HTML
    document.getElementById('modal-date').innerText = data.date || '';
    document.getElementById('modal-title').innerText = data.title || '';
    document.getElementById('modal-text').innerText = data.text || '';
    
    let img = document.getElementById('modal-img');
    if(data.imagePath) {
        img.src = data.imagePath;
        img.style.display = 'block';
    } else {
        img.style.display = 'none';
    }

    // Mostrar Capa Web
    document.getElementById('ui-layer').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('ui-layer').classList.add('hidden');
    // Pequeño delay para evitar falsos positivos de teclado
    setTimeout(() => { isPaused = false; }, 100); 
}
