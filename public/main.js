/********************************************************************
 * KAIROS: Mech Frontier
 ********************************************************************/

// Full viewport width/height
const canvas = document.getElementById('gameCanvas');
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();



// Weapon base class
class Weapon {
    constructor(config) {
        this.name = config.name;
        this.damage = config.damage;
        this.ammo = config.startingAmmo;
        this.maxAmmo = config.startingAmmo;
        this.projectileSpeed = config.projectileSpeed;
        this.cooldown = config.cooldown;
        this.currentCooldown = 0;
        this.projectileColor = config.projectileColor;
        this.projectileSize = config.projectileSize || 0.2;
        this.spreadAngle = config.spreadAngle || 0;
        this.projectilesPerShot = config.projectilesPerShot || 1;
    }

    canFire() {
        return this.ammo > 0 && this.currentCooldown <= 0;
    }

    update() {
        if (this.currentCooldown > 0) {
            this.currentCooldown--;
        }
    }

    createProjectile(position, direction) {
        if (!this.canFire()) return null;

        this.ammo--;
        this.currentCooldown = this.cooldown;

        let projectiles = [];
        
        for (let i = 0; i < this.projectilesPerShot; i++) {
            // Calculate spread for this projectile
            let spreadDir = {...direction};
            if (this.spreadAngle > 0) {
                let angle = (Math.random() - 0.5) * this.spreadAngle;
                spreadDir = rotateY(direction, angle);
                // Add some vertical spread too
                let verticalAngle = (Math.random() - 0.5) * this.spreadAngle * 0.5;
                spreadDir = rotateX(spreadDir, verticalAngle);
            }

            projectiles.push({
                name: "projectile",
                position: {...position},
                rotation: vec3(0, 0, 0),
                velocity: mul3(spreadDir, this.projectileSpeed),
                life: 200,
                boundingBox: {
                    min: vec3(-this.projectileSize/2, -this.projectileSize/2, -this.projectileSize/2),
                    max: vec3(this.projectileSize/2, this.projectileSize/2, this.projectileSize/2)
                },
                ...makeBox(this.projectileSize, this.projectileSize, this.projectileSize),
                color: this.projectileColor,
                damage: this.damage
            });
        }

        return projectiles;
    }
}

// Define specific weapon types
class Rifle extends Weapon {
    constructor() {
        super({
            name: "Rifle",
            damage: 1,
            startingAmmo: 99,
            projectileSpeed: 0.3,
            cooldown: 20,
            projectileColor: "#ff0",
            projectileSize: 0.2,
            spreadAngle: 0.1,
            projectilesPerShot: 1
        });
    }
}

class Shotgun extends Weapon {
    constructor() {
        super({
            name: "Shotgun",
            damage: 0.5,  // Less damage per pellet
            startingAmmo: 24,
            projectileSpeed: 0.25,
            cooldown: 120,
            projectileColor: "#f80",
            projectileSize: 0.15,  // Smaller pellets
            spreadAngle: 0.3,  // Wide spread
            projectilesPerShot: 8  // Multiple pellets per shot
        });
    }
}

// Weapon management system for the player
class WeaponSystem {
    constructor() {
        this.weapons = [
            new Rifle(),
            new Shotgun()
        ];
        this.currentWeaponIndex = 0;
    }

    getCurrentWeapon() {
        return this.weapons[this.currentWeaponIndex];
    }

    update() {
        this.getCurrentWeapon().update();
    }

    switchWeapon(index) {
        if (index >= 0 && index < this.weapons.length) {
            this.currentWeaponIndex = index;
            return true;
        }
        return false;
    }

    nextWeapon() {
        this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weapons.length;
    }

    fireCurrentWeapon(position, direction) {
        return this.getCurrentWeapon().createProjectile(position, direction);
    }

    getCurrentAmmo() {
        const weapon = this.getCurrentWeapon();
        return `${weapon.name}: ${weapon.ammo}/${weapon.maxAmmo}`;
    }
}


// Spatial relativity helpers
function vec3(x=0,y=0,z=0){return {x,y,z};}
function add3(a,b){return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z};}
function sub3(a,b){return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};}
function mul3(a,s){return {x:a.x*s,y:a.y*s,z:a.z*s};}
function dot3(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
function length3(v){return Math.sqrt(dot3(v,v));}
function normalize3(v){let l=length3(v);if(l===0)return vec3();return {x:v.x/l,y:v.y/l,z:v.z/l};}

function rotateY(v, angle){
  let s = Math.sin(angle), c = Math.cos(angle);
  return {x: v.x*c+v.z*s, y:v.y, z:-v.x*s+v.z*c};
}
function rotateX(v,a){
  let s=Math.sin(a),c=Math.cos(a);
  return {x:v.x,y:v.y*c - v.z*s,z:v.y*s+v.z*c};
}

function projectPoint(p, fov, width, height) {
    if(p.z <= 0) return null; 
    let f = fov;
    let x = (p.x * f / p.z) + width/2;
    let y = (-p.y * f / p.z) + height/2;
    return {x, y, z: p.z}; // Return z for line clipping
}

function drawObject(ctx, obj, cam, w, h) {
    let color = obj.color||"#0f0";
    if((obj.name==="enemy" || obj.name==="player") && obj.hitFlashTimer>0) {
        color="#fff";
    }
    
    let transformedVerts = obj.vertices.map(v=>transformVertex(v,obj.position,obj.rotation,cam));
    let projectedVerts = transformedVerts.map(v=>projectPoint(v,fov,w,h));
    
    ctx.beginPath();
    ctx.strokeStyle=color;
    for(let e of obj.edges) {
        let v1 = transformedVerts[e[0]];
        let v2 = transformedVerts[e[1]];
        let p1 = projectedVerts[e[0]];
        let p2 = projectedVerts[e[1]];
        
        // Line clipping against camera plane
        if(clipAndDrawLine(ctx, v1, v2, p1, p2, w, h, fov)) {
            continue;
        }
    }
    ctx.stroke();
}

function clipAndDrawLine(ctx, v1, v2, p1, p2, w, h, fov) {
    // Both points behind camera
    if(v1.z <= 0 && v2.z <= 0) return true;
    
    // Line crosses z=0 plane, need to clip
    if(v1.z <= 0 || v2.z <= 0) {
        // Calculate intersection with z=0 plane
        let t = -v1.z / (v2.z - v1.z);
        let x = v1.x + t * (v2.x - v1.x);
        let y = v1.y + t * (v2.y - v1.y);
        
        // Project the intersection point
        let intersect = {
            x: (x * fov / 0.1) + w/2,
            y: (-y * fov / 0.1) + h/2
        };
        
        // Draw from visible point to intersection
        if(v1.z > 0) {
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(intersect.x, intersect.y);
        } else {
            ctx.moveTo(intersect.x, intersect.y);
            ctx.lineTo(p2.x, p2.y);
        }
        return true;
    }
    
    // Normal case - both points visible
    if(p1 && p2) {
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
    }
    return false;
}

// Buildings
function makeBox(w,h,d){
  let hw = w/2, hh = h/2, hd = d/2;
  let vertices = [
    vec3(-hw,-hh,-hd),
    vec3(hw,-hh,-hd),
    vec3(hw,-hh,hd),
    vec3(-hw,-hh,hd),
    vec3(-hw,hh,-hd),
    vec3(hw,hh,-hd),
    vec3(hw,hh,hd),
    vec3(-hw,hh,hd),
  ];
  let edges = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7]
  ];
  return {vertices,edges};
}

// Enemies
function makePyramid(baseSize,height){
  let half = baseSize/2;
  let vertices = [
    vec3(-half,0,-half),
    vec3(half,0,-half),
    vec3(half,0,half),
    vec3(-half,0,half),
    vec3(0,height,0)
  ];
  let edges = [
    [0,1],[1,2],[2,3],[3,0],
    [0,4],[1,4],[2,4],[3,4]
  ];
  return {vertices, edges};
}

// Grid Floor
function makeGround(size, divisions){
  let step = size/divisions;
  let vertices = [];
  let edges = [];
  for(let i=0; i<=divisions; i++){
    vertices.push(vec3(-size/2,-0.01, -size/2+i*step));
    vertices.push(vec3(size/2,-0.01, -size/2+i*step));
    edges.push([vertices.length-2, vertices.length-1]);
    vertices.push(vec3(-size/2+i*step,-0.01,-size/2));
    vertices.push(vec3(-size/2+i*step,-0.01,size/2));
    edges.push([vertices.length-2, vertices.length-1]);
  }
  return {vertices, edges};
}

// Scene
let sceneObjects = [];
let enemies = [];
let projectiles = [];
let fragments = [];

// Ground
let ground = makeGround(200,20);
sceneObjects.push({
  name:"ground",
  position:vec3(0,0,0),
  rotation:vec3(0,0,0),
  color:"#084",
  ...ground,
  boundingBox:null
});

function createBoxObj(x,y,z,w,h,d,color="#0f0", name="box"){
  let b = makeBox(w,h,d);
  return {
    name,
    position:vec3(x,y,z),
    rotation:vec3(0,0,0),
    color,
    ...b,
    boundingBox:{min:vec3(-w/2,-h/2,-d/2),max:vec3(w/2,h/2,d/2)}
  };
}

// Walls and pillars
let wallColor="#0a0";

// Perimeter walls - aligned with ground edges (200x200 ground)
sceneObjects.push(createBoxObj(-100,2.5,0,1,5,200,wallColor)); // Left wall
sceneObjects.push(createBoxObj(100,2.5,0,1,5,200,wallColor));  // Right wall
sceneObjects.push(createBoxObj(0,2.5,-100,200,5,1,wallColor)); // Back wall
sceneObjects.push(createBoxObj(0,2.5,100,200,5,1,wallColor));  // Front wall

// Inner walls - scaled up to match larger map
sceneObjects.push(createBoxObj(-50,2.5,-60,60,5,1,wallColor));
sceneObjects.push(createBoxObj(50,2.5,-40,60,5,1,wallColor));
sceneObjects.push(createBoxObj(-60,2.5,40,60,5,1,wallColor));
sceneObjects.push(createBoxObj(60,2.5,60,60,5,1,wallColor));

// Diagonal walls
sceneObjects.push(createBoxObj(-70,2.5,-20,1,5,40,wallColor));
sceneObjects.push(createBoxObj(70,2.5,20,1,5,40,wallColor));
sceneObjects.push(createBoxObj(-40,2.5,70,1,5,60,wallColor));
sceneObjects.push(createBoxObj(40,2.5,-70,1,5,60,wallColor));

// Tall pillars (strategic cover points)
let pillarPositions = [
    [-60,-70], [60,-70],
    [-70,-30], [70,-30],
    [-60,30], [60,30],
    [-70,70], [70,70],
    //[0,0], // Center pillar
    [-40,0], [40,0],
    [0,-60], [0,60]
];

for(let pos of pillarPositions) {
    sceneObjects.push(createBoxObj(pos[0],5,pos[1],2,10,2,wallColor));
}

// Random smaller pillars
let numRandomPillars = 25; // Increased for larger map
let usedPositions = new Set(pillarPositions.map(p => `${p[0]},${p[1]}`));

for(let i = 0; i < numRandomPillars; i++) {
    let x, z;
    do {
        x = Math.floor((Math.random() * 180) - 90); // Spread across most of map
        z = Math.floor((Math.random() * 180) - 90);
    } while (
        usedPositions.has(`${x},${z}`) || // Avoid overlap with existing pillars
        (Math.abs(x) < 10 && Math.abs(z) < 10) // Keep spawn area clear
    );
    
    usedPositions.add(`${x},${z}`);
    sceneObjects.push(createBoxObj(x,5,z,2,10,2,wallColor));
}

// Player
let playerModel = makePyramid(1,2);
let player = {
    name: "player",
    position: vec3(0,0,0),
    rotation: vec3(0,0,0),
    ...playerModel,
    boundingBox: {min:vec3(-0.5,0,-0.5), max:vec3(0.5,2,0.5)},
    color: "#0f0",
    health: 3,
    hitFlashTimer: 0,
    isDead: false,
    weaponSystem: new WeaponSystem()
};
sceneObjects.push(player);

// Enemies with health=3
function createEnemy(x,z,xRange,zRange){
    let eModel = makePyramid(1,2);
    return {
        name:"enemy",
        position:vec3(x,0,z),
        rotation:vec3(0,0,0),
        ...eModel,
        boundingBox:{min:vec3(-0.5,0,-0.5),max:vec3(0.5,2,0.5)},
        color:"#f00",
        patrolStart:vec3(x,0,z),
        patrolEnd:vec3(x+xRange,0,z+zRange),
        patrolTimer:0,
        patrolDir:1,
        health:3,
        hitFlashTimer:0,
        fireCooldown: Math.floor(Math.random() * 120) // Random initial cooldown
    };
}

// Add enemies to scene
enemies.push(createEnemy(5,25,5,0));
enemies.push(createEnemy(-5,10,-5,5));
enemies.push(createEnemy(20,-10,10,10));
for(let e of enemies) sceneObjects.push(e);

// Camera
let cameraOffset = vec3(0,6,-12);
let cameraTilt = 0.1; 
let fov = 500;

let playerVel = vec3(0,0,0);
let gravity = 0.012;  
let onGround = true;
let jumpSpeed = 0.5;
let baseMoveSpeed = 0.03; 
let friction = 0.94; 

let cameraPos = vec3(0,0,0);
let cameraYaw = 0;
let cameraLerpFactor = 0.2;

// Simple key state object
let keys = {
    w: false, s: false, a: false, d: false,
    ArrowLeft: false, ArrowRight: false,
    Space: false,
    Shift: false,
    "1": false,
    "2": false
};

// Normalize key names
function normalizeKey(key) {
  // Handle special cases
  switch(key) {
    case ' ':
    case 'Space':
      return 'Space';
    case 'Shift':
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'Shift';
    case 'ArrowLeft':
    case 'ArrowRight':
      return key;  // Keep arrow keys as-is
    default:
      return key.toLowerCase();
  }
}

// Key handlers
window.addEventListener('keydown', (e) => {
  let key = normalizeKey(e.key);
  if(key in keys) {
    e.preventDefault();
    if(!e.repeat) { // Ignore key repeat events
      keys[key] = true;
      console.log('Key Down:', key, {...keys});
    }
  }
}, false);

window.addEventListener('keyup', (e) => {
  let key = normalizeKey(e.key);
  if(key in keys) {
    e.preventDefault();
    keys[key] = false;
    // On key release, ensure player stops if no movement keys are pressed
    if(['w', 'a', 's', 'd'].includes(key)) {
      if(!keys.w && !keys.a && !keys.s && !keys.d) {
        playerVel.x = 0;
        playerVel.z = 0;
      }
    }
    console.log('Key Up:', key, {...keys});
  }
}, false);

// Reset all keys when window loses focus
window.addEventListener('blur', () => {
  Object.keys(keys).forEach(key => {
    keys[key] = false;
  });
  playerVel.x = 0;
  playerVel.z = 0;
  console.log('Blur - Reset Keys:', {...keys});
});

function updatePlayer() {
  let forwardDir = rotateY({x:0, y:0, z:1}, player.rotation.y);
  let rightDir = rotateY({x:1, y:0, z:0}, player.rotation.y);

  // Handle player taking damage
  if(player.hitFlashTimer > 0) player.hitFlashTimer--;
  
  // Calculate movement direction
  let moveDir = vec3();
  
  // Handle rotation
  if(keys.ArrowLeft) player.rotation.y -= 0.05;
  if(keys.ArrowRight) player.rotation.y += 0.05;
  
  // Calculate raw movement input
  let moveX = 0;
  let moveZ = 0;
  
  if(keys.w) moveZ += 1;
  if(keys.s) moveZ -= 1;
  if(keys.a) moveX -= 1;
  if(keys.d) moveX += 1;
  
  // Apply movement if there's input
  if(moveX !== 0 || moveZ !== 0) {
    // Normalize diagonal movement
    if(moveX !== 0 && moveZ !== 0) {
      let len = Math.sqrt(2);
      moveX /= len;
      moveZ /= len;
    }
    
    // Convert to world space
    moveDir.x = forwardDir.x * moveZ + rightDir.x * moveX;
    moveDir.z = forwardDir.z * moveZ + rightDir.z * moveX;
    moveDir = normalize3(moveDir);
    moveDir = mul3(moveDir, baseMoveSpeed);
    
    // Apply acceleration
    playerVel.x += moveDir.x;
    playerVel.z += moveDir.z;
  }
  
  // Apply friction
  playerVel.x *= friction;
  playerVel.z *= friction;
  
  // Handle vertical movement
  if(!onGround) {
    playerVel.y -= gravity;
  }
  
  if(keys.Shift && onGround) {
    playerVel.y = jumpSpeed;
    onGround = false;
  }
  
  // Apply movement and handle collisions
  let desiredPos = add3(player.position, playerVel);
  let newPos = slideMovement(player.position, playerVel);
  
  // Ground collision
  if(newPos.y <= 0) {
    newPos.y = 0;
    playerVel.y = 0;
    onGround = true;
  }
  
  // Wall collisions
  if(newPos.x !== desiredPos.x) playerVel.x = 0;
  if(newPos.z !== desiredPos.z) playerVel.z = 0;
  if(newPos.y !== desiredPos.y) playerVel.y = 0;
  
  player.position = newPos;
  

    // Update weapon system
    player.weaponSystem.update();
    
    // Handle shooting
    if (keys.Space) {
        fireProjectile();
    }

    if (keys["1"]) {
        player.weaponSystem.switchWeapon(0);
    }
    if (keys["2"]) {
        player.weaponSystem.switchWeapon(1);
    }
}

// Update debug display
function drawDebugInfo(ctx, w, h) {
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    ctx.fillText(`Keys: ${Object.entries(keys).filter(([,v])=>v).map(([k])=>k).join(', ')}`, 10, 20);
    ctx.fillText(`Vel X: ${playerVel.x.toFixed(3)}`, 10, 40);
    ctx.fillText(`Vel Z: ${playerVel.z.toFixed(3)}`, 10, 60);
    ctx.fillText(`Health: ${player.health}`, 10, 80);
    ctx.fillText(`Ammo: ${player.weaponSystem.getCurrentAmmo()}`, 10, 100);
}

// Add debug info to scene
function drawScene() {
  let canvas = document.getElementById("gameCanvas");
  let ctx = canvas.getContext("2d");
  let w = canvas.width, h = canvas.height;
  
  drawBackground(ctx,w,h);
  
  let cam = getCameraMatrix();
  for(let obj of sceneObjects) {
    drawObject(ctx, obj, cam, w, h);
  }
  
  drawDebugInfo(ctx, w, h);
}

function checkCollision(pos,box, entityBox){
  if(!box.boundingBox) return false;
  let min = add3(box.position, box.boundingBox.min);
  let max = add3(box.position, box.boundingBox.max);
  
  let pMin = add3(pos, entityBox.min);
  let pMax = add3(pos, entityBox.max);
  
  return (pMin.x <= max.x && pMax.x >= min.x &&
          pMin.y <= max.y && pMax.y >= min.y &&
          pMin.z <= max.z && pMax.z >= min.z);
}

function canMoveTo(pos, boxToIgnore=null){
  for(let o of sceneObjects){
    if(o === player || o === boxToIgnore || o.name === "ground" || o.name==="enemy" || o.name==="projectile" || o.name==="fragment") continue;
    if(checkCollision(pos,o,player.boundingBox)) return false;
  }
  if(pos.y<0) pos.y=0;
  return true;
}

function slideMovement(currentPos, desiredMove){
  let testPos = add3(currentPos, desiredMove);
  if(canMoveTo(testPos)) return testPos;
  
  let finalPos = currentPos;
  
  let slideX = vec3(desiredMove.x,0,0);
  let testX = add3(currentPos, slideX);
  if(canMoveTo(testX)) finalPos = testX;
  
  let slideZ = vec3(0,0,desiredMove.z);
  let testZ = add3(finalPos, slideZ);
  if(canMoveTo(testZ)) finalPos = testZ;
  
  let slideY = vec3(0,desiredMove.y,0);
  let testY = add3(finalPos, slideY);
  if(canMoveTo(testY)) finalPos = testY;

  return finalPos;
}

// Enemy patrol
function updateEnemies() {
    for(let e of enemies) {
        if(!sceneObjects.includes(e)) continue;
        
        // Existing patrol logic
        let start = e.patrolStart;
        let end = e.patrolEnd;
        let t = e.patrolTimer;
        let dir = e.patrolDir;
        let x = start.x + (end.x - start.x)*t;
        let z = start.z + (end.z - start.z)*t;
        e.position.x = x;
        e.position.z = z;
        let speed = 0.005;
        e.patrolTimer += speed*dir;
        if(e.patrolTimer>1){e.patrolTimer=1;e.patrolDir=-1;}
        if(e.patrolTimer<0){e.patrolTimer=0;e.patrolDir=1;}
        
        // Update hit flash
        if(e.hitFlashTimer>0) e.hitFlashTimer--;
        
        // Handle shooting with line of sight and range check
        if(!e.fireCooldown) {
            if(canSeePlayer(e.position)) {
                e.fireCooldown = 120; // 2sec cooldown
                fireEnemyProjectile(e);
            }
        }
        if(e.fireCooldown > 0) e.fireCooldown--;
    }
}

function fireProjectile() {
    let forwardDir = rotateY({x:0, y:0, z:1}, player.rotation.y);
    let startPos = add3(player.position, {x:forwardDir.x*0.5, y:1, z:forwardDir.z*0.5});
    
    const newProjectiles = player.weaponSystem.fireCurrentWeapon(startPos, forwardDir);
    if (newProjectiles) {
        for (const projectile of newProjectiles) {
            sceneObjects.push(projectile);
            projectiles.push(projectile); // This is the global projectiles array
        }
    }
}

const ENEMY_FIRING_RANGE = 50; // Maximum distance for enemy to fire

function canSeePlayer(enemyPos) {
    if(player.isDead) return false;
    
    // Check distance first
    let toPlayer = sub3(player.position, enemyPos);
    let distance = length3(toPlayer);
    if(distance > ENEMY_FIRING_RANGE) return false;
    
    // Raycast to check for obstacles
    let direction = normalize3(toPlayer);
    let step = 0.5; // Step size for ray
    let currentPos = {...enemyPos};
    currentPos.y += 1; // Adjust for height
    
    let steps = Math.floor(distance / step);
    
    for(let i = 0; i < steps; i++) {
        currentPos = add3(currentPos, mul3(direction, step));
        
        // Check collision with walls and pillars
        for(let obj of sceneObjects) {
            if(obj.name !== "box") continue; // Only check walls and pillars
            
            if(checkCollision(currentPos, obj, {
                min: vec3(-0.1,-0.1,-0.1),
                max: vec3(0.1,0.1,0.1)
            })) {
                return false; // Line of sight blocked
            }
        }
    }
    
    return true; // No obstacles found
}

function fireEnemyProjectile(enemy) {
    // Calculate direction to player
    let toPlayer = normalize3(sub3(player.position, enemy.position));
    
    let startPos = add3(enemy.position, {x:toPlayer.x*0.5, y:1, z:toPlayer.z*0.5});
    let projectile = {
        name: "enemyProjectile",
        position: startPos,
        rotation: vec3(0,0,0),
        velocity: mul3(toPlayer, 0.2), // Slightly slower than player projectiles
        life: 200,
        boundingBox: {min:vec3(-0.1,-0.1,-0.1), max:vec3(0.1,0.1,0.1)},
        ...makeBox(0.2,0.2,0.2),
        color: "#f00" // Red color for enemy projectiles
    };
    sceneObjects.push(projectile);
    projectiles.push(projectile);
}

function updateProjectiles() {
    for(let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        p.life--;
        if(p.life <= 0) {
            removeObject(p);
            projectiles.splice(i, 1);
            continue;
        }
        
        let nextPos = add3(p.position, p.velocity);
        if(!canMoveTo(nextPos, p)) {
            createWallHitEffect(p.position);
            removeObject(p);
            projectiles.splice(i, 1);
            continue;
        }
        
        p.position = nextPos;
        
        // Handle different projectile types
        if(p.name === "enemyProjectile") {
            if(checkProjectileHitPlayer(p)) {
                damagePlayer(p);
                removeObject(p);
                projectiles.splice(i, 1);
            }
        } else {
            let hitEnemy = checkProjectileHitEnemy(p);
            if(hitEnemy) {
                damageEnemy(hitEnemy, p);
                removeObject(p);
                projectiles.splice(i, 1);
            }
        }
    }
}

function damagePlayer(projectile) {
    if(player.hitFlashTimer > 0) return; // Temporary invulnerability while flashing
    
    player.health--;
    player.hitFlashTimer = 20; // Match enemy flash duration
    
    console.log("Player hit! Health:", player.health); // Debug output
    
    if(player.health <= 0) {
        playerDeath();
    }
}

function checkProjectileHitPlayer(proj) {
    if(player.hitFlashTimer > 0) return false; // Skip hit detection during invulnerability
    return checkCollision(proj.position, player, player.boundingBox);
}

function playerDeath() {
    explodePlayer();
    player.isDead = true;
}

function explodePlayer() {
    // Create a bigger explosion than enemy explosion
    createFragments(player.position, 80); // More particles than enemy explosion
    
    // Remove player model from scene
    let idx = sceneObjects.indexOf(player);
    if(idx >= 0) sceneObjects.splice(idx, 1);
}

function createWallHitEffect(position) {
  for(let i = 0; i < 3; i++) {
    let angle = Math.random() * Math.PI * 2;
    let speed = 0.06 + Math.random() * 0.1; // Reduced speed range
    
    // More even directional spread
    let elevationAngle = (Math.random() - 0.5) * Math.PI * 0.5;
    let dir = {
      x: Math.cos(angle) * Math.cos(elevationAngle),
      y: Math.sin(elevationAngle),
      z: Math.sin(angle) * Math.cos(elevationAngle)
    };
    
    // Normalize direction
    let len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    dir.x /= len;
    dir.y /= len;
    dir.z /= len;
    
    let fragment = {
      name: "fragment",
      position: {...position},
      rotation: vec3(0, 0, 0),
      velocity: mul3(dir, speed),
      life: 30,
      vertices: [
        vec3(0, 0, 0),
        vec3(
          Math.cos(angle) * 0.3, // Reduced from 0.5 to 0.3
          Math.sin(elevationAngle) * 0.3,
          Math.sin(angle) * 0.3
        )
      ],
      edges: [[0, 1]],
      color: "#ff0",
      gravity: 0.001
    };
    fragments.push(fragment);
    sceneObjects.push(fragment);
  }
}

function checkProjectileHitEnemy(proj){
  for(let e of enemies){
    if(!sceneObjects.includes(e)) continue;
    if(checkCollision(proj.position,e, e.boundingBox)){
      return e;
    }
  }
  return null;
}

function damageEnemy(enemy, projectile){
  enemy.health--;
  if(enemy.health>0){
    enemy.hitFlashTimer = 10;
  } else {
    explodeEnemy(enemy);
  }
}

function explodeEnemy(enemy) {
  let idx = sceneObjects.indexOf(enemy);
  if(idx >= 0) sceneObjects.splice(idx, 1);
  let eidx = enemies.indexOf(enemy);
  if(eidx >= 0) enemies.splice(eidx, 1);
  
  createFragments(enemy.position, 50);
}

function createFragments(position, num) {
  const explosionPos = {...position};
  createExplosionCore(explosionPos, 20);    // Central explosion
  createShrapnel(explosionPos, 15);         // Flying debris
  createFireParticles(explosionPos, 30);    // Fire particles
}

function createExplosionCore(pos, num) {
  for(let i = 0; i < num; i++) {
    // Expanding polygons for the core explosion
    let vertices = [];
    let edges = [];
    let sides = 3 + Math.floor(Math.random() * 3); // 3-5 sided polygons
    
    for(let j = 0; j < sides; j++) {
      let angle = (j / sides) * Math.PI * 2;
      let size = 0.2 + Math.random() * 0.3;
      vertices.push(vec3(
        Math.cos(angle) * size,
        Math.sin(angle) * size,
        0
      ));
      edges.push([j, (j + 1) % sides]);
    }

    let dir = normalize3({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2
    });

    let fragment = {
      name: "fragment",
      position: {...pos},
      rotation: vec3(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      ),
      velocity: mul3(dir, 0.15 + Math.random() * 0.1),
      rotationVel: vec3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      ),
      life: 40 + Math.random() * 20,
      vertices,
      edges,
      color: "#f62",
      gravity: 0.001,
      scale: 1
    };
    
    fragments.push(fragment);
    sceneObjects.push(fragment);
  }
}

function createFireParticles(pos, num) {
  for(let i = 0; i < num; i++) {
    let dir = normalize3({
      x: (Math.random() - 0.5) * 2,
      y: Math.random() * 1.5,
      z: (Math.random() - 0.5) * 2
    });

    let fragment = {
      name: "fragment",
      position: {...pos},
      rotation: vec3(0, 0, 0),
      velocity: mul3(dir, 0.08 + Math.random() * 0.1),
      life: 30 + Math.random() * 20,
      vertices: [vec3(0,0,0), vec3(0.1,0.1,0)],
      edges: [[0,1]],
      color: "#f" + Math.floor(Math.random() * 4 + 6) + "0",
      gravity: 0.0005,
      isFireParticle: true
    };
    
    fragments.push(fragment);
    sceneObjects.push(fragment);
  }
}

function createShrapnel(pos, num) {
  for(let i = 0; i < num; i++) {
    let dir = normalize3({
      x: (Math.random() - 0.5) * 2,
      y: Math.random(),
      z: (Math.random() - 0.5) * 2
    });

    let fragment = {
      name: "fragment",
      position: {...pos},
      rotation: vec3(0, 0, 0),
      velocity: mul3(dir, 0.2 + Math.random() * 0.15),
      life: 60 + Math.random() * 30,
      vertices: [
        vec3(0,0,0),
        vec3(0.2 + Math.random() * 0.3, 0.2 + Math.random() * 0.3, 0)
      ],
      edges: [[0,1]],
      color: "#fff",
      gravity: 0.003
    };
    
    fragments.push(fragment);
    sceneObjects.push(fragment);
  }
}

function updateFragments() {
  for(let i = fragments.length - 1; i >= 0; i--) {
    let f = fragments[i];
    f.life--;
    
    if(f.life <= 0) {
      removeObject(f);
      fragments.splice(i, 1);
      continue;
    }

    // Update position
    f.position = add3(f.position, f.velocity);
    
    // Apply gravity
    f.velocity.y -= f.gravity;
    
    // Apply air resistance
    f.velocity = mul3(f.velocity, 0.98);
    
    // Update rotation if it exists
    if(f.rotationVel) {
      f.rotation = add3(f.rotation, f.rotationVel);
    }
    
    // Color handling
    if(f.isFireParticle) {
      // Fire particles fade from bright orange to dark red
      let intensity = Math.floor((f.life / 50) * 15);
      f.color = `#f${intensity.toString(16)}0`;
    } else {
      // Normal fragments fade to black
      let fade = f.life / (f.life > 30 ? 90 : 15);
      let c = Math.floor(255 * fade).toString(16).padStart(2, '0');
      f.color = "#" + c + c + c;
    }
  }
}

function removeObject(o){
  let idx = sceneObjects.indexOf(o);
  if(idx>=0) sceneObjects.splice(idx,1);
}

function getCameraMatrix(){
  let offsetRotated = rotateY(cameraOffset, player.rotation.y);
  let targetCamPos = add3(player.position, offsetRotated);
  
  cameraPos.x += (targetCamPos.x - cameraPos.x)*cameraLerpFactor;
  cameraPos.y += (targetCamPos.y - cameraPos.y)*cameraLerpFactor;
  cameraPos.z += (targetCamPos.z - cameraPos.z)*cameraLerpFactor;
  
  cameraYaw += (player.rotation.y - cameraYaw)*cameraLerpFactor;
  
  return {pos:cameraPos, yaw:cameraYaw};
}

function transformVertex(v, pos, rot, cam){
  let vWorld = rotateY(v, rot.y);
  vWorld = add3(vWorld, pos);
  
  vWorld = sub3(vWorld, cam.pos);
  vWorld = rotateY(vWorld, -cam.yaw);
  
  vWorld = rotateX(vWorld, cameraTilt);
  
  return vWorld;
}

function drawBackground(ctx, w, h){
  let grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,"#001");
  grad.addColorStop(0.5,"#003");
  grad.addColorStop(1,"#000");
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);
}

function gameLoop() {
    if(!player.isDead) {
        updateEnemies();
        updatePlayer();
        updateProjectiles();
        updateFragments();
        drawScene();
        requestAnimationFrame(gameLoop);
    } else {
        updateEnemies();
        updateProjectiles();
        updateFragments();
        drawScene();
        requestAnimationFrame(gameLoop);
        // Draw game over screen
        let ctx = canvas.getContext("2d");
        ctx.fillStyle = "#f00";
        ctx.font = "48px Arial";
        ctx.fillText("GAME OVER", canvas.width/2 - 100, canvas.height/2);
    }
}

gameLoop();
