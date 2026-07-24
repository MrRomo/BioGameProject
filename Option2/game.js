const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#87CEEB',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 800 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let player;
let cursors;
let gameData;

// Variables para el modal dentro del Canvas
let inGameModal;
let modalTitle;
let modalDate;
let modalDesc;

function preload() {
    this.load.json('levelData', 'data.json');
}

function create() {
    gameData = this.cache.json.get('levelData');
    
    this.physics.world.setBounds(0, 0, gameData.level.width, gameData.level.height);

    gameData.darkZones.forEach(zone => {
        const zoneWidth = zone.x2 - zone.x1;
        const darkZone = this.add.rectangle(zone.x1 + zoneWidth / 2, gameData.level.height / 2, zoneWidth, gameData.level.height, parseInt(zone.color));
        darkZone.setAlpha(zone.alpha);
        darkZone.setBlendMode(Phaser.BlendModes.MULTIPLY);
    });

    const ground = this.add.rectangle(gameData.level.width / 2, gameData.level.height - 20, gameData.level.width, 40, 0x228B22);
    this.physics.add.existing(ground, true); 

    player = this.add.rectangle(100, 400, 40, 40, 0xFF0000);
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);
    
    this.cameras.main.setBounds(0, 0, gameData.level.width, gameData.level.height);
    this.cameras.main.startFollow(player, true, 0.08, 0.08); 

    const staticGroup = this.physics.add.staticGroup();
    gameData.structures.forEach(struct => {
        const color = struct.type === 'pipe' ? 0x00FF00 : 0x8B4513;
        const rect = this.add.rectangle(struct.x, struct.y, struct.width, struct.height, color);
        staticGroup.add(rect);
    });

    const eventGroup = this.physics.add.staticGroup();
    gameData.events.forEach(ev => {
        const color = ev.type === 'mushroom' ? 0xFF69B4 : 0xFFD700;
        const item = this.add.rectangle(ev.x, ev.y, 30, 30, color);
        
        item.uiPayload = ev.uiPayload;
        item.isTriggered = false; 
        
        // Hacemos que el elemento sea interactivo al clic del ratón o toque
        item.setInteractive();
        item.on('pointerdown', () => {
            if (this.physics.world.isPaused) {
                // Si el juego está pausado, al hacer clic en el hongo reanudamos las físicas
                this.physics.resume();
            } else if (item.isTriggered) {
                // Si ya estaba gris y caminamos de vuelta hacia él, al hacerle clic volvemos a ver la info
                actualizarModal(item.uiPayload);
                this.physics.pause();
            }
        });

        eventGroup.add(item);
    });

    this.physics.add.collider(player, ground);
    this.physics.add.collider(player, staticGroup);
    this.physics.add.overlap(player, eventGroup, triggerEvent, null, this);

    cursors = this.input.keyboard.createCursorKeys();

    // ==========================================
    // CREACIÓN DEL MODAL DENTRO DEL CANVAS
    // ==========================================
    const screenCenterX = this.cameras.main.width / 2;
    
    const modalBg = this.add.rectangle(screenCenterX, 120, 600, 180, 0x000000, 0.85);
    modalBg.setStrokeStyle(4, 0xFFFFFF); // Borde blanco estético
    
    modalTitle = this.add.text(screenCenterX, 60, '', { fontSize: '24px', fill: '#FFFFFF', fontStyle: 'bold' }).setOrigin(0.5);
    modalDate = this.add.text(screenCenterX, 95, '', { fontSize: '18px', fill: '#00BFFF', fontStyle: 'bold' }).setOrigin(0.5);
    modalDesc = this.add.text(screenCenterX, 140, '', { fontSize: '16px', fill: '#DDDDDD', align: 'center', wordWrap: { width: 550 } }).setOrigin(0.5);

    inGameModal = this.add.container(0, 0, [modalBg, modalTitle, modalDate, modalDesc]);
    
    // setScrollFactor(0) ancla el contenedor a la pantalla, ignorando la cámara
    inGameModal.setScrollFactor(0); 
    inGameModal.setVisible(false);
}

function update() {
    if (cursors.left.isDown) {
        player.body.setVelocityX(-gameData.config.playerSpeed);
    } else if (cursors.right.isDown) {
        player.body.setVelocityX(gameData.config.playerSpeed);
    } else {
        player.body.setVelocityX(0);
    }

    if (cursors.up.isDown && player.body.touching.down) {
        player.body.setVelocityY(gameData.config.jumpForce);
    }
}

function triggerEvent(player, item) {
    // Solo se dispara automáticamente la primera vez que lo tocamos
    if (!item.isTriggered) {
        item.setFillStyle(0x808080); // Cambiamos el color a gris
        item.isTriggered = true;
        
        actualizarModal(item.uiPayload);
        
        // Pausamos las físicas (movimiento) pero no la escena, para poder escuchar clics
        this.physics.pause();
    }
}

function actualizarModal(payload) {
    modalTitle.setText(payload.title);
    modalDate.setText(payload.date);
    modalDesc.setText(payload.description);
    inGameModal.setVisible(true);
}

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});