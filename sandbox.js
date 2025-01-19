import * as THREE from "../three.js-master/build/three.module.js";
import { PointerLockControls } from "../three.js-master/examples/jsm/controls/PointerLockControls.js";

//create renderer
const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
});
renderer.shadowMap.enabled = true;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//create camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  100,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

//add light
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.y = 15;
dirLight.position.z = 5;
dirLight.castShadow = true;
scene.add(dirLight);

const ambLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambLight);

const clock = new THREE.Clock();

const controls = new PointerLockControls(camera, document.body);

//event listener for pointer lock
document.addEventListener(
  "click",
  () => {
    controls.lock();
  },
  false
);

//handle pointer lock state changes
controls.addEventListener("lock", () => {
  console.log("pointer locked");
});

controls.addEventListener("unlock", () => {
  console.log("pointer unlocked");
});

//console.Log(ground.top);
//console.log(cube.bottom);

class Box extends THREE.Mesh {
  constructor({
    width,
    height,
    depth,
    color = "#00ff00",
    velocity = { x: 0, y: 0, z: 0 },
    position = { x: 0, y: 0, z: 0 },
    speed = 0.08,
    points = 40,
    isZombie = false,
  }) {
    super(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color })
    );

    this.castShadow = true;

    this.height = height;
    this.width = width;
    this.depth = depth;

    this.position.set(position.x, position.y, position.z);

    this.right = this.position.x + this.width / 2;
    this.left = this.position.x - this.width / 2;

    this.bottom = this.position.y - this.height / 2;
    this.top = this.position.y + this.height / 2;

    this.front = this.position.z + this.depth / 2;
    this.back = this.position.z - this.depth / 2;

    this.velocity = velocity;
    this.gravity = -0.002;

    this.isZombie = isZombie;
    this.zombieSpeed = speed;
    this.zombiePoints = points;

    this.updateSides();
  }

  updateSides() {
    this.bottom = this.position.y - this.height / 2;
    this.top = this.position.y + this.height / 2;

    this.right = this.position.x + this.width / 2;
    this.left = this.position.x - this.width / 2;

    this.front = this.position.z + this.depth / 2;
    this.back = this.position.z - this.depth / 2;
  }

  update(ground) {
    this.updateSides();

    this.position.x += this.velocity.x;
    this.position.z += this.velocity.z;

    //this is the ground collision
    this.applyGravity(ground);
  }

  applyGravity(ground) {
    this.velocity.y += this.gravity;

    if (boxCollision({ box1: this, box2: ground })) {
      this.velocity.y *= 0.8;
      this.velocity.y = -this.velocity.y;
    } else this.position.y += this.velocity.y;
  }
}

function boxCollision({ box1, box2 }) {
  //detect collision
  const xCollision = box1.right >= box2.left && box1.left <= box2.right;
  const yCollision =
    box1.bottom + box1.velocity.y <= box2.top && box1.top >= box2.bottom;
  const zCollision = box1.front >= box2.back && box1.back <= box2.front;

  return xCollision && yCollision && zCollision;
}

//add cube
const cube = new Box({
  width: 1,
  height: 1,
  depth: 1,
  velocity: { x: 0, y: -0.01, z: 0 },
  position: { x: 0, y: 0, z: 5 },
});

//add ground
const ground = new Box({
  width: 100,
  height: 0.5,
  depth: 100,
  color: "#792bff",
  position: { x: 0, y: -2, z: 0 },
});

ground.receiveShadow = true;
scene.add(ground);

//setup controls

const keys = {
  a: {
    pressed: false,
  },
  d: {
    pressed: false,
  },
  w: {
    pressed: false,
  },
  s: {
    pressed: false,
  },
};

window.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "KeyW":
      keys.w.pressed = true;
      break;
    case "KeyS":
      keys.s.pressed = true;
      break;
    case "KeyA":
      keys.a.pressed = true;
      break;
    case "KeyD":
      keys.d.pressed = true;
      break;
    case "Space":
      cube.velocity.y = 0.1;
      break;
    case "Escape":
      controls.unlock();
      break;
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyW":
      keys.w.pressed = false;
      break;
    case "KeyS":
      keys.s.pressed = false;
      break;
    case "KeyA":
      keys.a.pressed = false;
      break;
    case "KeyD":
      keys.d.pressed = false;
      break;
    case "Escape":
      controls.unlock();
      break;
  }
});

//player health
let playerHealth = 4;
let isGameOver = false;

let playerScore = 0;

const scoreDisplay = document.createElement("div");
scoreDisplay.id = "scoreboard";
scoreDisplay.style.position = "fixed";
scoreDisplay.style.top = "10px";
scoreDisplay.style.left = "10px";
scoreDisplay.style.color = "white";
scoreDisplay.style.fontFamily = "Arial, sans-serif";
scoreDisplay.style.fontSize = "20px";
scoreDisplay.style.zIndex = "999";
scoreDisplay.innerText = `Score: ${playerScore}`;
document.body.appendChild(scoreDisplay);

function updateScore() {
  scoreDisplay.innerText = `Score: ${playerScore}`;
}

//enemies (zombies)
const enemies = [];

let frames = 0;
let spawnRate = 200;

//raycaster for htiscan shooting
const raycaster = new THREE.Raycaster();
const shootDirection = new THREE.Vector3();

//shoot event (left mouse click while locked)
document.addEventListener("mousedown", () => {
  if (controls.isLocked && !isGameOver) {
    shootRay();
  }
});

function shootRay() {
  //set ray starting from camera and going forward
  camera.getWorldDirection(shootDirection);
  raycaster.set(camera.position, shootDirection);

  //intersect with enemies
  const intersects = raycaster.intersectObjects(enemies, true);

  if (intersects.length > 0) {
    const hitEnemy = intersects[0].object;

    playerScore += hitEnemy.zombiePoints;
    updateScore();

    scene.remove(hitEnemy);

    const index = enemies.indexOf(hitEnemy);
    if (index > -1) {
      enemies.splice(index, 1);
    }
  }
}

function spawnZombie() {
  const zombieTypes = [
    { color: "red", speed: 0.4, points: 40 },
    { color: "yellow", speed: 0.1, points: 20 },
    { color: "purple", speed: 0.8, points: 80 },
  ];

  const chosenType =
    zombieTypes[Math.floor(Math.random() * zombieTypes.length)];

  const spawnDistance = 40;
  const angle = Math.random() * Math.PI * 2;
  const x = cube.position.x + Math.cos(angle) * spawnDistance;
  const z = cube.position.z + Math.sin(angle) * spawnDistance;

  const enemy = new Box({
    width: 1,
    height: 2,
    depth: 1,
    position: { x: x, y: 0, z: z },
    velocity: { x: 0, y: 0, z: 0 },
    color: chosenType.color,
    speed: chosenType.speed,
    points: chosenType.points,
    isZombie: true,
  });

  scene.add(enemy);
  enemies.push(enemy);
}
//add animation
function animate() {
  if (isGameOver) return;

  requestAnimationFrame(animate);

  const eyeHeight = 1.7;
  camera.position.set(
    cube.position.x,
    cube.position.y + eyeHeight,
    cube.position.z
  );

  const cameraDirection = new THREE.Vector3();

  camera.getWorldDirection(cameraDirection);

  //movement settings
  let playerSpeed = 0.1;
  cube.velocity.x = 0;
  cube.velocity.z = 0;

  if (keys.w.pressed) {
    cube.velocity.z += playerSpeed * cameraDirection.z;
    cube.velocity.x += playerSpeed * cameraDirection.x;
  }
  if (keys.s.pressed) {
    cube.velocity.z -= playerSpeed * cameraDirection.z;
    cube.velocity.x -= playerSpeed * cameraDirection.x;
  }

  if (keys.a.pressed) {
    const strafeDir = cameraDirection
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    cube.velocity.x += playerSpeed * strafeDir.x;
    cube.velocity.z += playerSpeed * strafeDir.z;
  }
  if (keys.d.pressed) {
    const strafeDir = cameraDirection
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
    cube.velocity.x += playerSpeed * strafeDir.x;
    cube.velocity.z += playerSpeed * strafeDir.z;
  }

  cube.update(ground);

  //ground and enemy collison with player
  enemies.forEach((enemy) => {
    const directionToPlayer = new THREE.Vector3(
      cube.position.x - enemy.position.x,
      0,
      cube.position.z - enemy.position.z
    );

    if (directionToPlayer.length() > 0.01) {
      directionToPlayer.normalize();

      const zombieSpeed = 0.01;
      enemy.velocity.x = directionToPlayer.x * zombieSpeed;
      enemy.velocity.z = directionToPlayer.z * zombieSpeed;
    }

    enemy.update(ground);

    if (boxCollision({ box1: cube, box2: enemy })) {
      playerHealth -= 1;
      console.log(`Zombie hit player! Health: ${playerHealth}`);

      //push enemy away when they hit player
      enemy.position.x -= directionToPlayer.x * 0.5;
      enemy.position.z -= directionToPlayer.z * 0.5;

      //player death
      if (playerHealth <= 0) {
        isGameOver = true;
        console.log("Player is dead. Game Over!");
        return;
      }
    }
  });

  //spawn enemies
  if (frames % spawnRate === 0) {
    if (spawnRate > 20) spawnRate -= 10;

    spawnZombie();
  }
  frames++;

  renderer.render(scene, camera);
}

animate();

//window resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.updateProjectionMatrix();
});
