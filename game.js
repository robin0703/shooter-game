const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 480;
const CANVAS_HEIGHT = 720;

let gameRunning = false;
let score = 0;
let lives = 3;
let level = 1;
let enemiesKilled = 0;
let levelUpScore = 1000;

let player = null;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let explosions = [];
let stars = [];

const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false
};

const LEVEL_CONFIG = {
    1: {
        enemySpawnRate: 2000,
        enemySpeed: 2,
        enemyBulletRate: 3000,
        bulletSpeed: 10,
        maxEnemies: 3,
        enemyTypes: ['basic']
    },
    2: {
        enemySpawnRate: 1500,
        enemySpeed: 3,
        enemyBulletRate: 2000,
        bulletSpeed: 12,
        maxEnemies: 4,
        enemyTypes: ['basic', 'fast']
    },
    3: {
        enemySpawnRate: 1000,
        enemySpeed: 4,
        enemyBulletRate: 1000,
        bulletSpeed: 15,
        maxEnemies: 5,
        enemyTypes: ['basic', 'fast', 'heavy']
    }
};

let touchStartX = 0;
let touchStartY = 0;
let touchStartPlayerX = 0;
let touchStartPlayerY = 0;
let isTouching = false;
let isMobile = false;

function checkMobile() {
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        document.getElementById('mobileControls').style.display = 'flex';
        document.getElementById('keyboardHint').style.display = 'none';
    }
}

class Player {
    constructor() {
        this.width = 50;
        this.height = 60;
        this.x = CANVAS_WIDTH / 2 - this.width / 2;
        this.y = CANVAS_HEIGHT - this.height - 20;
        this.speed = 6;
        this.shootCooldown = 0;
        this.maxCooldown = 15;
        this.invincible = false;
        this.invincibleTime = 0;
    }

    draw() {
        ctx.save();
        
        if (this.invincible && Math.floor(this.invincibleTime / 5) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        
        ctx.beginPath();
        ctx.moveTo(centerX, this.y);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.lineTo(centerX, this.y + this.height - 15);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
        gradient.addColorStop(0, '#00ffff');
        gradient.addColorStop(0.5, '#0088ff');
        gradient.addColorStop(1, '#0044aa');
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(centerX, centerY - 5, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffff';
        ctx.fill();
        
        ctx.restore();
    }

    update() {
        if (keys.up && this.y > 0) this.y -= this.speed;
        if (keys.down && this.y < CANVAS_HEIGHT - this.height) this.y += this.speed;
        if (keys.left && this.x > 0) this.x -= this.speed;
        if (keys.right && this.x < CANVAS_WIDTH - this.width) this.x += this.speed;

        if (this.shootCooldown > 0) this.shootCooldown--;

        if (keys.shoot && this.shootCooldown === 0) {
            this.shoot();
            this.shootCooldown = this.maxCooldown;
        }

        if (this.invincible) {
            this.invincibleTime--;
            if (this.invincibleTime <= 0) {
                this.invincible = false;
            }
        }
    }

    shoot() {
        bullets.push(new Bullet(this.x + this.width / 2 - 3, this.y, -12, '#00ffff'));
        playShootSound();
    }

    takeDamage() {
        if (!this.invincible) {
            lives--;
            this.invincible = true;
            this.invincibleTime = 120;
            updateLifeUI();
            
            if (lives <= 0) {
                gameOver();
            }
        }
    }
}

class Bullet {
    constructor(x, y, speed, color) {
        this.x = x;
        this.y = y;
        this.width = 6;
        this.height = 15;
        this.speed = speed;
        this.color = color;
        this.active = true;
    }

    draw() {
        ctx.save();
        
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y, this.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        if (this.y < -this.height || this.y > CANVAS_HEIGHT) {
            this.active = false;
        }
    }
}

class Enemy {
    constructor(type = 'basic') {
        this.type = type;
        this.setupByType();
        this.x = Math.random() * (CANVAS_WIDTH - this.width);
        this.y = -this.height;
        this.active = true;
        this.shootCooldown = Math.random() * 60;
        this.maxCooldown = this.type === 'fast' ? 40 : 60;
    }

    setupByType() {
        switch (this.type) {
            case 'fast':
                this.width = 35;
                this.height = 40;
                this.speed = LEVEL_CONFIG[level].enemySpeed + 2;
                this.health = 1;
                this.points = 150;
                this.color1 = '#ffaa00';
                this.color2 = '#ff6600';
                break;
            case 'heavy':
                this.width = 60;
                this.height = 70;
                this.speed = LEVEL_CONFIG[level].enemySpeed - 1;
                this.health = 3;
                this.points = 300;
                this.color1 = '#ff4444';
                this.color2 = '#aa0000';
                break;
            default:
                this.width = 45;
                this.height = 50;
                this.speed = LEVEL_CONFIG[level].enemySpeed;
                this.health = 1;
                this.points = 100;
                this.color1 = '#ff4488';
                this.color2 = '#aa2266';
        }
    }

    draw() {
        ctx.save();
        
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        
        ctx.beginPath();
        ctx.moveTo(centerX, this.y + this.height);
        ctx.lineTo(this.x + this.width, this.y);
        ctx.lineTo(centerX, this.y + 15);
        ctx.lineTo(this.x, this.y);
        ctx.closePath();
        
        const gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
        gradient.addColorStop(0, this.color1);
        gradient.addColorStop(1, this.color2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (this.type === 'heavy') {
            ctx.beginPath();
            ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#ff0000';
            ctx.fill();
        }
        
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        
        if (this.y > CANVAS_HEIGHT + this.height) {
            this.active = false;
        }

        if (this.y > 0 && this.y < CANVAS_HEIGHT - 100) {
            this.shootCooldown--;
            if (this.shootCooldown <= 0) {
                this.shoot();
                this.shootCooldown = this.maxCooldown;
            }
        }
    }

    shoot() {
        const bulletX = this.x + this.width / 2 - 3;
        enemyBullets.push(new Bullet(bulletX, this.y + this.height, LEVEL_CONFIG[level].bulletSpeed, '#ff4444'));
    }

    takeDamage() {
        this.health--;
        if (this.health <= 0) {
            this.destroy();
        }
    }

    destroy() {
        this.active = false;
        explosions.push(new Explosion(this.x + this.width / 2, this.y + this.height / 2, this.width));
        score += this.points;
        enemiesKilled++;
        updateScoreUI();
        checkLevelUp();
        playExplosionSound();
    }
}

class Explosion {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.radius = 0;
        this.maxRadius = size * 1.5;
        this.active = true;
        this.alpha = 1;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, '#ffff00');
        gradient.addColorStop(0.4, '#ff8800');
        gradient.addColorStop(0.7, '#ff4400');
        gradient.addColorStop(1, 'transparent');
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.restore();
    }

    update() {
        this.radius += 3;
        this.alpha -= 0.05;
        
        if (this.radius >= this.maxRadius || this.alpha <= 0) {
            this.active = false;
        }
    }
}

class Star {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * CANVAS_WIDTH;
        this.y = Math.random() * CANVAS_HEIGHT;
        this.size = Math.random() * 2 + 1;
        this.speed = Math.random() * 2 + 0.5;
        this.brightness = Math.random();
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = 0.5 + this.brightness * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.y += this.speed;
        if (this.y > CANVAS_HEIGHT) {
            this.reset();
            this.y = -5;
        }
    }
}

function initStars() {
    stars = [];
    for (let i = 0; i < 50; i++) {
        stars.push(new Star());
    }
}

function spawnEnemy() {
    if (enemies.length < LEVEL_CONFIG[level].maxEnemies) {
        const types = LEVEL_CONFIG[level].enemyTypes;
        const type = types[Math.floor(Math.random() * types.length)];
        enemies.push(new Enemy(type));
    }
}

function checkLevelUp() {
    if (score >= level * levelUpScore && level < 3) {
        level++;
        updateLevelUI();
        showLevelUp();
    }
}

function showLevelUp() {
    const levelUpEl = document.getElementById('levelUp');
    levelUpEl.classList.add('show');
    setTimeout(() => {
        levelUpEl.classList.remove('show');
    }, 2000);
}

function checkCollisions() {
    bullets = bullets.filter(bullet => {
        for (let enemy of enemies) {
            if (isColliding(bullet, enemy)) {
                enemy.takeDamage();
                return false;
            }
        }
        return bullet.active;
    });

    enemyBullets = enemyBullets.filter(bullet => {
        if (player && isColliding(bullet, player)) {
            player.takeDamage();
            return false;
        }
        return bullet.active;
    });

    if (player && !player.invincible) {
        for (let enemy of enemies) {
            if (isColliding(player, enemy)) {
                player.takeDamage();
                enemy.destroy();
                break;
            }
        }
    }

    enemies = enemies.filter(enemy => enemy.active);
    explosions = explosions.filter(exp => exp.active);
}

function isColliding(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

function updateLifeUI() {
    for (let i = 1; i <= 3; i++) {
        const lifeEl = document.getElementById(`life${i}`);
        lifeEl.classList.toggle('empty', i > lives);
    }
}

function updateScoreUI() {
    document.getElementById('score').textContent = score;
}

function updateLevelUI() {
    document.getElementById('level').textContent = level;
}

function gameLoop() {
    if (!gameRunning) return;

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    stars.forEach(star => {
        star.update();
        star.draw();
    });

    if (player) {
        player.update();
        player.draw();
    }

    bullets.forEach(bullet => {
        bullet.update();
        bullet.draw();
    });

    enemyBullets.forEach(bullet => {
        bullet.update();
        bullet.draw();
    });

    enemies.forEach(enemy => {
        enemy.update();
        enemy.draw();
    });

    explosions.forEach(exp => {
        exp.update();
        exp.draw();
    });

    checkCollisions();

    requestAnimationFrame(gameLoop);
}

let lastEnemySpawn = 0;
function spawnLoop() {
    if (!gameRunning) return;

    const now = Date.now();
    if (now - lastEnemySpawn > LEVEL_CONFIG[level].enemySpawnRate) {
        spawnEnemy();
        lastEnemySpawn = now;
    }

    requestAnimationFrame(spawnLoop);
}

function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOver').classList.remove('show');
    
    score = 0;
    lives = 3;
    level = 1;
    enemiesKilled = 0;
    
    player = new Player();
    bullets = [];
    enemyBullets = [];
    enemies = [];
    explosions = [];
    
    updateLifeUI();
    updateScoreUI();
    updateLevelUI();
    
    gameRunning = true;
    lastEnemySpawn = Date.now();
    
    gameLoop();
    spawnLoop();
}

function restartGame() {
    startGame();
}

function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.add('show');
    playGameOverSound();
}

function playShootSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {}
}

function playExplosionSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 200;
        oscillator.type = 'sawtooth';
        
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {}
}

function playGameOverSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.4);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.8);
    } catch (e) {}
}

document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'ArrowUp':
        case 'KeyW':
            keys.up = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = true;
            break;
        case 'Space':
            keys.shoot = true;
            e.preventDefault();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'ArrowUp':
        case 'KeyW':
            keys.up = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = false;
            break;
        case 'Space':
            keys.shoot = false;
            break;
    }
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isTouching = true;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    
    if (player) {
        touchStartPlayerX = player.x;
        touchStartPlayerY = player.y;
    }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isTouching || !player) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.width, touchStartPlayerX + deltaX));
    player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.height, touchStartPlayerY + deltaY));
}, { passive: false });

canvas.addEventListener('touchend', () => {
    isTouching = false;
});

function handleShootBtnDown() {
    keys.shoot = true;
}

function handleShootBtnUp() {
    keys.shoot = false;
}

window.handleShootBtnDown = handleShootBtnDown;
window.handleShootBtnUp = handleShootBtnUp;

initStars();
checkMobile();

let deferredPrompt = null;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/shooter-game/service-worker.js', { scope: '/shooter-game/' })
            .then((registration) => {
                console.log('Service Worker registered: ', registration.scope);
            })
            .catch((registrationError) => {
                console.log('Service Worker registration failed: ', registrationError);
            });
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
    console.log('App installed successfully!');
});

function showInstallButton() {
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.classList.add('show');
    }
}

function hideInstallButton() {
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.classList.remove('show');
    }
}

function installPWA() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
        document.getElementById('iosGuide').style.display = 'block';
        setTimeout(() => {
            document.getElementById('iosGuide').style.display = 'none';
        }, 5000);
        return;
    }
    
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }
            deferredPrompt = null;
        });
    } else {
        document.getElementById('installGuide').style.display = 'block';
        setTimeout(() => {
            document.getElementById('installGuide').style.display = 'none';
        }, 5000);
    }
}

window.startGame = startGame;
window.restartGame = restartGame;
window.installPWA = installPWA;
