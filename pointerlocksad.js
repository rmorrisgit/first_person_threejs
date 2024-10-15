import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import Stats from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/stats.module.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let objects = []; // Array to store objects for interaction
const velocity = new THREE.Vector3();
const moveSpeed = 400.0; // Normal move speed
const sprintSpeed = 800.0; // Sprint speed
let isSprinting = false; // Track sprint state
const normalJumpHeight = 350; // Normal jump strength
const sprintJumpHeight = 500; // Stronger jump when sprinting
const friction = 10.0; // Friction to slow down movement



class InputController {
  constructor() {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.canJump = false;
    this.init();
  }
  init() {
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
}

onKeyDown(event) {
  switch (event.code) {
      case 'ArrowUp':
      case 'KeyW': this.moveForward = true; break;
      case 'ArrowLeft':
      case 'KeyA': this.moveLeft = true; break;
      case 'ArrowDown':
      case 'KeyS': this.moveBackward = true; break;
      case 'ArrowRight':
      case 'KeyD': this.moveRight = true; break;
      case 'ShiftLeft': isSprinting = true; break; // Start sprinting
      case 'Space': if (this.canJump) {
          this.isJumping = true; // Set jump flag
      } break;
  }
}

onKeyUp(event) {
  switch (event.code) {
      case 'ArrowUp':
      case 'KeyW': this.moveForward = false; break;
      case 'ArrowLeft':
      case 'KeyA': this.moveLeft = false; break;
      case 'ArrowDown':
      case 'KeyS': this.moveBackward = false; break;
      case 'ArrowRight':
      case 'KeyD': this.moveRight = false; break;
      case 'ShiftLeft': isSprinting = false; break; // Stop sprinting
      case 'Space': this.isJumping = false; break; // Reset jump flag

  }
}
update() {
  // You could add additional input logic here if needed
}
}
class FirstPersonCamera {
  constructor(camera, controls, scene, renderer) {
    this.camera = camera;
    this.controls = controls;
    this.scene = scene;
    this.renderer = renderer;
    this.input = new InputController(); // Initialize input handler
    this.velocity = new THREE.Vector3(); // Movement velocity
    this.raycaster = new THREE.Raycaster(); // Make raycaster a class property
    this.isSprinting = false; // Track sprint state

  }

  update(deltaTime) {
    this.updateMovement(deltaTime);  // Update movement based on input
    this.input.update();
  }

  updateMovement(deltaTime) {
    const direction = new THREE.Vector3();

    // Movement direction based on input
    direction.z = Number(this.input.moveForward) - Number(this.input.moveBackward);
    direction.x = Number(this.input.moveLeft) - Number(this.input.moveRight);
    direction.normalize();

    const currentMoveSpeed = isSprinting ? sprintSpeed : moveSpeed;

    // Apply movement based on input and speed
    if (this.input.moveForward || this.input.moveBackward) {
      this.velocity.z -= direction.z * currentMoveSpeed * deltaTime;
    }
    if (this.input.moveLeft || this.input.moveRight) {
      this.velocity.x -= direction.x * currentMoveSpeed * deltaTime;
    }


        // Apply friction to gradually stop the player when no input is provided
        this.velocity.x -= this.velocity.x * friction * deltaTime;
        this.velocity.z -= this.velocity.z * friction * deltaTime;


    // Handle collisions and jumping logic using raycaster
    this.raycaster.ray.origin.copy(this.controls.object.position);
    this.raycaster.ray.origin.y -= 10;
    const intersections = this.raycaster.intersectObjects(objects, false);
    const onObject = intersections.length > 0;

    if (onObject) {
      this.velocity.y = Math.max(0, this.velocity.y);
      this.input.canJump = true;
    }

   // Apply jump when spacebar is pressed
    if (this.input.isJumping && this.input.canJump) {
      this.velocity.y += isSprinting ? sprintJumpHeight : normalJumpHeight;
      this.input.canJump = false; // Disable jumping until grounded
    }
    // Apply velocity to control movement
    this.controls.moveRight(-this.velocity.x * deltaTime);
    this.controls.moveForward(-this.velocity.z * deltaTime);

    // Apply gravity
    this.velocity.y -= 9.8 * 100.0 * deltaTime;

    // Update vertical position
    this.controls.object.position.y += this.velocity.y * deltaTime;
    if (this.controls.object.position.y < 10) {
      this.velocity.y = 0;
      this.controls.object.position.y = 10;
      this.input.canJump = true;
    }
  }
}
class FirstPersonCameraDemo {
  constructor() {
    
    this.previousRAF = null;
    this.stats = new Stats();
    document.body.appendChild(this.stats.dom);
    this.init();
    this.animate();
  }
  init() {
    // Initialize Renderer, Scene, Camera, and Controls
    this.initRenderer();
    this.initializeLights_(); 
    this.initScene();
    this.initPointerLock();
    this.initializeDemo_()
    }
  initPointerLock() {
    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');
    // Pointer lock event handlers
    document.addEventListener('click', () => {
      this.controls.lock(); // Lock on click
    });

    this.controls.addEventListener('lock', () => {
      console.log("Pointer locked");
      // Additional logic if needed on lock
      blocker.style.display = 'none'; // Hide blocker when pointer is locked
    });
    this.controls.addEventListener('unlock', () => {
      console.log("Pointer unlocked");
      // Additional logic if needed on unlock
      blocker.style.display = 'flex'; // Show blocker when pointer is unlocked
    });
  }

  initializeDemo_() {
    this.fpsCamera = new FirstPersonCamera(this.camera, this.controls, this.scene, this.renderer);
  }
  initRenderer()  {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.physicallyCorrectLights = true;
    this.renderer.shadowMap.enabled = false; // Temporarily disable shadows

    this.renderer.outputEncoding = THREE.sRGBEncoding;
    // this.renderer.shadowMap.enabled = true; 
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: Change shadow map type for softer shadows
    document.body.appendChild(this.renderer.domElement);
  
    // window.addEventListener('resize', this.onWindowResize_.bind(this), false);
    window.addEventListener('resize', () => {
      this.onWindowResize();
    }, false);
  
    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, 10, 10); // Set initial camera position (x, y, z)

    this.scene = new THREE.Scene();
    // this.uiCamera_ = new THREE.OrthographicCamera(
    //     -1, 1, 1 * aspect, -1 * aspect, 1, 1000);
    // this.uiScene_ = new THREE.Scene();

    // Initialize PointerLockControls
    this.controls = new PointerLockControls(this.camera, document.body);
    this.scene.add(this.controls.object); // Add the controls object to the scene
}
 
onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

loadMaterial_(name, tiling) {
  const mapLoader = new THREE.TextureLoader();
  const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

  const metalMap = mapLoader.load('resources/freepbr/' + name + 'metallic.png');
  metalMap.anisotropy = maxAnisotropy;
  metalMap.wrapS = THREE.RepeatWrapping;
  metalMap.wrapT = THREE.RepeatWrapping;
  metalMap.repeat.set(tiling, tiling);
  const albedo = mapLoader.load('resources/freepbr/' + name + 'albedo.png');
  albedo.anisotropy = maxAnisotropy;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(tiling, tiling);
  albedo.encoding = THREE.sRGBEncoding;
  const normalMap = mapLoader.load('resources/freepbr/' + name + 'normal.png');
  normalMap.anisotropy = maxAnisotropy;
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(tiling, tiling);
  const roughnessMap = mapLoader.load('resources/freepbr/' + name + 'roughness.png');
  roughnessMap.anisotropy = maxAnisotropy;
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(tiling, tiling);

  const material = new THREE.MeshStandardMaterial({
    metalnessMap: metalMap,
    map: albedo,
    normalMap: normalMap,
    roughnessMap: roughnessMap,
  });

  return material;
} 

  update() {
    // this.handleFallingCubes(); 
    this.stats.update(); // Update stats
    requestAnimationFrame(this.update.bind(this)); // Loop the update
  }
initScene() {
  const loader = new THREE.CubeTextureLoader();
  const texture = loader.load([
    './resources/skybox/posx.jpg',
    './resources/skybox/negx.jpg',
    './resources/skybox/posy.jpg',
    './resources/skybox/negy.jpg',
    './resources/skybox/posz.jpg',
    './resources/skybox/negz.jpg',
  ]);

  texture.encoding = THREE.sRGBEncoding;
  this.scene.background = texture;

  const mapLoader = new THREE.TextureLoader();
  const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
  
  const checkerboard = mapLoader.load('resources/checkerboard.png');
  checkerboard.anisotropy = maxAnisotropy;
  checkerboard.wrapS = THREE.RepeatWrapping;
  checkerboard.wrapT = THREE.RepeatWrapping;
  checkerboard.repeat.set(32, 32);
  checkerboard.encoding = THREE.sRGBEncoding;

  const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100, 10, 10),
      new THREE.MeshStandardMaterial({map: checkerboard}));
  plane.castShadow = false;
  plane.receiveShadow = true;
  plane.rotation.x = -Math.PI / 2;
  this.scene.add(plane);

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 4),
    this.loadMaterial_('vintage-tile1_', 0.2));
  box.castShadow = true;
  box.receiveShadow = true;
  this.scene.add(box);
  const wireframe = new THREE.WireframeGeometry(box.geometry);
  const line = new THREE.LineSegments(wireframe);
  line.material.depthTest = false;
  line.renderOrder = 1; // Make sure it renders on top
  this.scene.add(line);


  const concreteMaterial = this.loadMaterial_('concrete3-', 4);
  console.log(concreteMaterial);
  const wall1 = new THREE.Mesh(
    new THREE.BoxGeometry(100, 100, 4),
    concreteMaterial);
  wall1.position.set(0, -40, -50);
  wall1.castShadow = true;
  wall1.receiveShadow = true;
  this.scene.add(wall1);

  const wall2 = new THREE.Mesh(
    new THREE.BoxGeometry(100, 100, 4),
    concreteMaterial);
  wall2.position.set(0, -40, 50);
  wall2.castShadow = true;
  wall2.receiveShadow = true;
  this.scene.add(wall2);

  const wall3 = new THREE.Mesh(
    new THREE.BoxGeometry(4, 100, 100),
    concreteMaterial);
  wall3.position.set(50, -40, 0);
  wall3.castShadow = true;
  wall3.receiveShadow = true;
  this.scene.add(wall3);

  const wall4 = new THREE.Mesh(
    new THREE.BoxGeometry(4, 100, 100),
    concreteMaterial);
  wall4.position.set(-50, -40, 0);
  wall4.castShadow = true;
  wall4.receiveShadow = true;
  this.scene.add(wall4);

}


initializeLights_() {
  const distance = 50.0;
  const angle = Math.PI / 4.0;
  const penumbra = 0.5;
  const decay = 1.0;
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Soft white light
  this.scene.add(ambientLight);
  
  let light = new THREE.SpotLight(
      0xFFFFFF, 100.0, distance, angle, penumbra, decay);
  light.castShadow = true;
  light.shadow.bias = -0.00001;
  light.shadow.mapSize.width = 4096;
  light.shadow.mapSize.height = 4096;
  light.shadow.camera.near = 1;
  light.shadow.camera.far = 100;

  light.position.set(25, 25, 0);
  light.lookAt(0, 0, 0);
  this.scene.add(light);

  const upColour = 0xFFFF80;
  const downColour = 0x808080;
  light = new THREE.HemisphereLight(upColour, downColour, 0.5);
  light.color.setHSL( 0.6, 1, 0.6 );
  light.groundColor.setHSL( 0.095, 1, 0.75 );
  light.position.set(0, 4, 0);
  this.scene.add(light);
}
 
       
  
  animate() {
    console.log("Camera Position:", this.camera.position);

    requestAnimationFrame((t) => {
      if (this.previousRAF === null) {
        this.previousRAF = t;
      }
      const deltaTime = (t - this.previousRAF) * 0.001;
      this.previousRAF = t;

      this.fpsCamera.update(deltaTime);
      this.renderer.render(this.scene, this.camera);
      this.stats.update();

      this.animate();
    });
  }
}

let _APP = null;
window.addEventListener('DOMContentLoaded', () => {
  _APP = new FirstPersonCameraDemo();
});

