import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import Stats from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/stats.module.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const MOVE_SPEED = 5; // Adjust to your preference
const ACCELERATION = 0.1;

// FirstPersonCamera.js
const KEYS = {
  'a': 65, // A
  's': 83, // S
  'w': 87, // W
  'd': 68, // D
  'shift': 16 // Shift
};
function clamp(x, a, b) {
  return Math.min(Math.max(x, a), b);
}

const showInstructions = () => {
  blocker.style.display = 'flex'; // Show instructions
};

const hideInstructions = () => {
  blocker.style.display = 'none'; // Hide instructions
};


  // Add click event to request pointer lock
  document.body.addEventListener('click', () => {
    document.body.requestPointerLock();
  });


class InputController {
  constructor(target) {
    this.target_ = target || document.body; // Set default target to body
    this.isPointerLocked = false; // Track pointer lock state
    this.forwardVelocity = 0; // Initialize forward velocity
    this.strafeVelocity = 0;  // Initialize strafe velocity
    this.initialize_();
  }

  initialize_() {
    this.current_ = {
      leftButton: false,
      rightButton: false,
      mouseXDelta: 0,
      mouseYDelta: 0,
      mouseX: 0,
      mouseY: 0,
    };
    this.previous_ = null;
    this.keys_ = {};
    this.previousKeys_ = {};

    // Add Pointer Lock event listeners
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange_(), false);
    document.addEventListener('mousemove', (e) => this.onMouseMove_(e), false);
    this.target_.addEventListener('mousedown', (e) => this.onMouseDown_(e), false);
    this.target_.addEventListener('mouseup', (e) => this.onMouseUp_(e), false);
    this.target_.addEventListener('keydown', (e) => this.onKeyDown_(e), false);
    this.target_.addEventListener('keyup', (e) => this.onKeyUp_(e), false);
  }

  requestPointerLock_() {
    if (!this.isPointerLocked) {
      if (this.target_.requestPointerLock) {
        this.target_.requestPointerLock();
      } else {
        console.warn("Pointer Lock is not supported in this browser.");
      }
    } else {
      console.log("Pointer Lock is already active.");
    }
  }

  onPointerLockChange_() {
    if (document.pointerLockElement === this.target_) {
      console.log("Pointer Lock enabled");
      this.isPointerLocked = true; // Set state to true
      hideInstructions(); // Call your function to hide instructions
    } else {
      console.log("Pointer Lock disabled");
      this.isPointerLocked = false; // Set state to false
      showInstructions(); // Call your function to show instructions
    }
  }

  onMouseMove_(e) {
    // Only update if pointer lock is enabled
    if (this.isPointerLocked) {
      this.current_.mouseXDelta = e.movementX; // Relative movement
      this.current_.mouseYDelta = e.movementY;
      console.log(`Mouse X Delta: ${this.current_.mouseXDelta}, Mouse Y Delta: ${this.current_.mouseYDelta}`);
    }
  }

  handleMouseButton_(button, state) {
    switch (button) {
      case 0:
        this.current_.leftButton = state;
        break;
      case 2:
        this.current_.rightButton = state;
        break;
    }
  }
  
  onMouseDown_(e) {
    this.handleMouseButton_(e.button, true);
  }

  onMouseUp_(e) {
    this.handleMouseButton_(e.button, false);
  }

  onKeyDown_(e) {
    this.keys_[e.keyCode] = true;
  }

  onKeyUp_(e) {
    this.keys_[e.keyCode] = false;
  }

  key(keyCode) {
    return !!this.keys_[keyCode];
  }

  update(_) {
    if (this.previous_ !== null) {
      this.previous_ = { ...this.current_ };
    }
  }
}
class FirstPersonCamera {
  constructor(camera, objects) {
    this.camera_ = camera;
    this.input_ = new InputController();
    this.rotation_ = new THREE.Quaternion();
    this.translation_ = new THREE.Vector3(0, 2, 0);

    this.phi_ = 0;
    this.phiSpeed_ = 8;
    this.theta_ = 0;
    this.thetaSpeed_ = 5;
   // Add these new properties for speeds and charge
   this.moveSpeed_ = 20; // Adjust this value for movement speed
   this.lookSpeed_ = 5;  // Adjust this value for look speed
   this.charge = 1;      // Full charge starts at 1
   this.chargeDecreaseRate = 0.1; // Rate to decrease charge when sprinting

    this.headBobActive_ = false;
    this.headBobTimer_ = 0;
    this.headBobSpeed_ = 15;
    this.headBobHeight_ = 0.01;
    this.walkSpeed_ = 10;
    this.strafeSpeed_ = 10;
    this.previousTimestamp = performance.now(); // Initialize timestamp for delta time

    this.objects_ = objects;

    this.rechargeRate = 0.05; // Rate at which the charge recovers
    this.chargeRecoverDelay = 2; // Delay before charge starts recovering after sprinting
    this.lastSprintedAt = null; // Store the last time the player sprinted
    this.isSprinting = false; // State for sprinting
    this.sprintTimeout = false; // Sprint timeout state
    this.timeoutDuration = 5; // Timeout duration in seconds
    this.lastChargeDepletedAt = null; // Timestamp when charge reaches 0
    // Jumping variables


    this.isJumping = false; // State to track if the player is jumping
    this.raycastDistance = 10; // Distance to check for landing
    this.landingRaycaster = new THREE.Raycaster(); // Initialize the raycaster here
    this.downDirection = new THREE.Vector3(0, -1, 0); // Downward direction
    this.cylinders = objects; // Assuming this is how you are passing the cylinders

    this.jumpVelocity = 0; // Vertical speed during jump
    this.velocity = new THREE.Vector3(0, 0, 0); // 3D vector for velocity

    this.gravity = -54; // Gravity constant
    this.verticalVelocity = 0; // Current vertical speed
    this.previousCameraY = this.camera_.position.y; 

    this.jumpHeight = 8; // Max height of the jump
    this.groundLevel = 2; // Y position of the ground
      // Audio listener setup
    const listener = new THREE.AudioListener();
    camera.add(listener);
    this.footstepSound_ = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();

    // Load the footstep audio
    audioLoader.load('./sounds/footstep.ogg', (buffer) => {
      this.footstepSound_.setBuffer(buffer);
      this.footstepSound_.setLoop(false); // Prevent looping
      this.footstepSound_.setVolume(0.5);
    }, undefined, (error) => {
      console.error('An error occurred while loading the audio file:', error);
    });
   
  }

  update(timeElapsedS) {
    
    // Update other functionalities
    this.updateRotation_(timeElapsedS);
    this.updateCamera_(timeElapsedS);
    this.updateTranslation_(timeElapsedS);
    this.updateHeadBob_(timeElapsedS);
    this.input_.update(timeElapsedS);
    
  }

  updateCamera_(_) {
    this.camera_.quaternion.copy(this.rotation_);
    this.camera_.position.copy(this.translation_);
    this.camera_.position.y += Math.sin(this.headBobTimer_ * this.headBobSpeed_) * this.headBobHeight_;
   // Set camera to ground level if landed
  

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.rotation_);

    const dir = forward.clone();

    forward.multiplyScalar(100);
    forward.add(this.translation_);

    let closest = forward;
    const result = new THREE.Vector3();
    const ray = new THREE.Ray(this.translation_, dir);
    for (let i = 0; i < this.objects_.length; ++i) {
      if (ray.intersectBox(this.objects_[i], result)) {
        if (result.distanceTo(ray.origin) < closest.distanceTo(ray.origin)) {
          closest = result.clone();
        }
      }
    }


    // Set camera look direction
    this.camera_.lookAt(closest);

    // Store previous camera Y position for future reference
    this.previousCameraY = this.camera_.position.y; 
}

  updateHeadBob_(timeElapsedS) {
    if (this.isJumping) {
      // Do not apply head bobbing when jumping
      this.headBobTimer_ = 0; // Optionally reset timer while jumping
      if (this.footstepSound_.isPlaying) {
          this.footstepSound_.stop(); // Stop sound if jumping
      }
      return; // Exit the method to avoid head bobbing
  }
    if (this.headBobActive_) {
      const wavelength = Math.PI;
      const nextStep = 1 + Math.floor(((this.headBobTimer_ + 0.000001) * this.headBobSpeed_) / wavelength);
      const nextStepTime = nextStep * wavelength / this.headBobSpeed_;
      this.headBobTimer_ = Math.min(this.headBobTimer_ + timeElapsedS, nextStepTime);

      // Ensure head bobbing only stops at the end of a full step
      if (this.headBobTimer_ === nextStepTime) {
        this.headBobActive_ = false;
        
        // Stop footstep sound at the end of the step
        if (this.footstepSound_.isPlaying) {
          this.footstepSound_.stop();
        }
      }
    } else if (!this.isMoving) {
      // Ensure head bobbing and sound stop immediately when not moving
      this.headBobTimer_ = 0; // Reset the timer if not moving
      if (this.footstepSound_.isPlaying) {
        this.footstepSound_.stop(); // Stop sound immediately
      }
    }
  }

  updateTranslation_(timeElapsedS) {
    const forwardVelocity = (this.input_.key(KEYS.w) ? 1 : 0) + (this.input_.key(KEYS.s) ? -1 : 0);
    const strafeVelocity = (this.input_.key(KEYS.a) ? 1 : 0) + (this.input_.key(KEYS.d) ? -1 : 0);
    // Check if the player can sprint
    const canSprint = this.charge > 0 && this.input_.key(KEYS.shift) && !this.isJumping;
    const isSprinting = canSprint; 
    // Adjust current movement speed based on sprinting
    const currentMoveSpeed = isSprinting ? this.moveSpeed_ * 2 : this.moveSpeed_;
  
     // Manage sprint charge
     if (isSprinting) {
      this.charge = clamp(this.charge - this.chargeDecreaseRate * timeElapsedS, 0, 1);
      this.updateChargeUI(this.charge);
  } else {
      // Recover charge when not sprinting
      this.charge = clamp(this.charge + (this.rechargeRate * timeElapsedS), 0, 1); // Adjust recovery rate if needed
      this.updateChargeUI(this.charge);
  }

  this.isSprinting = isSprinting; // Track sprinting state

    // Handle jumping logic
    if (this.isJumping) {
      this.translation_.y += this.jumpVelocity * timeElapsedS;  // Update Y position based on velocity
      this.jumpVelocity += this.gravity * timeElapsedS; // Apply gravity to jump velocity
      // Check if player has landed
      if (this.translation_.y <= this.groundLevel) {
        this.isJumping = false;  // Player has landed
        this.jumpVelocity = 0;   // Reset jump velocity
        console.log("Player has landed.");  // Debug log for landing
      }
    }
     // Handle jumping
     if (!this.isJumping && this.translation_.y <= this.groundLevel && this.input_.key(32)) { // Only jump if grounded
      this.isJumping = true;
      const sprintFactor = isSprinting ? 1.7 : 1; // Jump higher if sprinting
      this.jumpVelocity = Math.sqrt(2 * -this.gravity * this.jumpHeight) * sprintFactor;
      console.log("Jump initiated. Jump velocity:", this.jumpVelocity); // Debug log
    }

  
    // Handle movement and head bobbing
    this.isMoving = forwardVelocity || strafeVelocity; // Moving if any velocity
    if (this.isMoving) {
      this.headBobActive_ = true; // Activate head bobbing when moving

      // Create a quaternion for rotation based on the current phi (yaw)
      const qx = new THREE.Quaternion();
      qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);

      // Forward movement vector
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(qx);
      forward.multiplyScalar(forwardVelocity * timeElapsedS * currentMoveSpeed); // Use currentMoveSpeed

      // Strafe movement vector
      const strafe = new THREE.Vector3(-1, 0, 0);
      strafe.applyQuaternion(qx);
      strafe.multiplyScalar(strafeVelocity * timeElapsedS * this.strafeSpeed_);

      // Update camera translation
      this.translation_.add(forward).add(strafe);

      // Play footstep sound when moving
      if (!this.footstepSound_.isPlaying) {
        this.footstepSound_.play();
      }
    } else {
      // Stop footstep sound when not moving
      if (this.footstepSound_.isPlaying) {
        this.footstepSound_.stop();
      }
      this.headBobActive_ = false; // Disable head bobbing when not moving
    }

  
  }
//   const cameraPosition = this.camera_.position.clone(); // Get the camera's position
//   this.landingRaycaster.set(cameraPosition, this.downDirection); // Update the raycaster's origin

//   const intersects = this.landingRaycaster.intersectObjects(this.cylinders, true); // Add true for recursive checking
  
//   const onObject = intersects.length > 0; // Check if intersected any objects

//   if (onObject) {
//     const landingObject = intersects[0].object; // The first intersected cylinder
//     const cylinderHeight = landingObject.geometry.parameters.height;
//     const cylinderTopY = landingObject.position.y + (cylinderHeight / 2);

//     // Reset vertical velocity on landing
//     this.verticalVelocity = 0;

//     // Check if the camera is above the cylinder 
//     if (cameraPosition.y > cylinderTopY && cameraPosition.y < this.previousCameraY) {
//       if (intersects[0].distance < this.raycastDistance) {
//         console.log('Landed on:', landingObject);
//         this.translation_.y = cylinderTopY; // Align with the top of the cylinder
//         console.log("Collision detected with:", intersects[0].object);

//         // Reset velocities and jump state
//         this.jumpVelocity = 0;
//         this.verticalVelocity = 0;
//         this.isJumping = false;

//         // Handle jumping logic
//         this.canJump = true; // Allow jumping again
//       }
//     }
//   } else {
//     // Apply gravity if not on an object
//     this.verticalVelocity += this.gravity * 0.016; // Assuming 60 FPS (1/60 seconds)
//     this.camera_.position.y += this.verticalVelocity; // Update camera position based on vertical velocity

//     // Prevent falling below the ground
//     if (this.camera_.position.y < 10) {
//       this.verticalVelocity = 0; // Reset vertical velocity
//       this.camera_.position.y = 10; // Reset to ground level
//       this.canJump = true; // Allow jumping again
//     }
//   }

//   // Update previous camera Y position for the next frame
//   this.previousCameraY = this.camera_.position.y;
// }


  updateChargeUI(charge) {
    const chargeDisplay = document.getElementById('charge-bar');
    const chargeText = document.getElementById('charge-text');
    
    if (chargeDisplay) {
      // Clamp the charge value between 0 and 1
      charge = Math.max(0, Math.min(1, charge));
      chargeDisplay.style.width = `${charge * 100}%`; // Update the width of the UI element
      chargeText.textContent = `${Math.round(charge * 100)}%`; // Display charge percentage
    }
  }

updateRotation_(timeElapsedS) {
  const xh = this.input_.current_.mouseXDelta / window.innerWidth;
  const yh = this.input_.current_.mouseYDelta / window.innerHeight;

  this.phi_ += -xh * this.lookSpeed_;  // Use lookSpeed_ here
  this.theta_ = clamp(this.theta_ + -yh * this.lookSpeed_, -Math.PI / 3, Math.PI / 3);

  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.theta_);

  this.rotation_.copy(qx.multiply(qz));

  // Reset mouse deltas after applying the rotation
  this.input_.current_.mouseXDelta = 0;
  this.input_.current_.mouseYDelta = 0;
}
}


const START_HEIGHT = 10; // Height from which the cubes start falling
const CYLINDER_SIZE = 2;
const SPACING = CYLINDER_SIZE * 2.5;  // Adjust the spacing between cylinders (2.5x cylinder size)
const objects = [];

class FirstPersonCameraDemo {
  constructor() {

    this.landingRaycaster = new THREE.Raycaster();

    this.camera = null; // Ensure this is initialized correctly
    this.controls = null; // Ensure this is initialized correctly
    this.inputController = null; // Declare the input controller
    this.scene = new THREE.Scene(); // Make sure this line exists
    this.objects_ = [];
    this.slotSize = 3; // Change this if your cube size is different
    this.gridSize = 10; // Desired grid size (10x10)
    this.grid = this.createGrid(this.gridSize);
    this.cylinders = [];
    // Initialize and add cubes
    this.initializeRenderer_(); // Ensure this is called early
    this.initialize_();
    this.fps = 0;  // Initialize fps variable
    this.frameCount = 0; // Frame count for FPS calculation
    this.lastTime = performance.now(); // Store the last time for FPS calculation
    this.initStats();
    this.update(); // Start the update loop
    // Start the animation loop
    this.previousRAF_ = null;
    this.raf_();
    this.onWindowResize_();
  }
  // Initialize FPS stats
  initStats() {
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: memory
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.top = '10px';
    this.stats.dom.style.left = '10px';
    this.stats.dom.style.opacity = '0.9';
    this.stats.dom.style.zIndex = '10000';
    const canvas = this.stats.dom.children[0]; // Access the canvas element directly
    canvas.style.width = '200px';  // Set desired width
    canvas.style.height = '100px'; // Set desired height
    document.body.appendChild(this.stats.dom);
  }
 
  onWindowResize_() {
    this.camera_.aspect = window.innerWidth / window.innerHeight;
    this.camera_.updateProjectionMatrix();

    this.uiCamera_.left = -this.camera_.aspect;
    this.uiCamera_.right = this.camera_.aspect;
    this.uiCamera_.updateProjectionMatrix();
    this.threejs_.setSize(window.innerWidth, window.innerHeight);
  }

  loadMaterial_(name, tiling) {
    const mapLoader = new THREE.TextureLoader();
    const maxAnisotropy = this.threejs_.capabilities.getMaxAnisotropy();

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
  initialize_() {
    this.initializeLights_();
    this.initializeScene_();
    this.initializeDemo_();



    this.inputController = new InputController(document.body);
  }
  initializeDemo_() {
    this.fpsCamera_ = new FirstPersonCamera(this.camera_, this.objects_);
  }
  initializeRenderer_() {
    this.threejs_ = new THREE.WebGLRenderer({
      antialias: false,
    });
    this.threejs_.setPixelRatio(window.devicePixelRatio);
    this.threejs_.setSize(window.innerWidth, window.innerHeight);
    this.threejs_.physicallyCorrectLights = true;
    this.threejs_.outputEncoding = THREE.sRGBEncoding;
    this.threejs_.shadowMap.enabled = true; // Enable shadows
    this.threejs_.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: Change shadow map type for softer shadows
    document.body.appendChild(this.threejs_.domElement);
  
    window.addEventListener('resize', () => {
      this.onWindowResize_();
    }, false);
  
    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this.camera_ = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera_.position.set(0, 10, 10); // Set initial camera position (x, y, z)
    this.scene_ = new THREE.Scene();
    this.spawnCylinders(70);
    this.uiCamera_ = new THREE.OrthographicCamera(
        -1, 1, 1 * aspect, -1 * aspect, 1, 1000);
    this.uiScene_ = new THREE.Scene();
      // Initialize PointerLockControls
  this.controls = new PointerLockControls( this.camera_, document.body );
  this.scene_.add(this.controls.getObject()); // Add the controls object to the scene

  // Add event listener to lock the pointer when the user clicks
  document.body.addEventListener('click', () => {
    this.controls.lock();
  });
  }
  initializeLights_() {
    const distance = 50.0;
    const angle = Math.PI / 4.0;
    const penumbra = 0.5;
    const decay = 1.0;
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5); // Soft white light
    this.scene_.add(ambientLight);
    
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
    this.scene_.add(light);

    const upColour = 0xFFFF80;
    const downColour = 0x808080;
    light = new THREE.HemisphereLight(upColour, downColour, 0.5);
    light.color.setHSL( 0.6, 1, 0.6 );
    light.groundColor.setHSL( 0.095, 1, 0.75 );
    light.position.set(0, 4, 0);
    this.scene_.add(light);
  }

  initializeScene_() {
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
    this.scene_.background = texture;

    const mapLoader = new THREE.TextureLoader();
    const maxAnisotropy = this.threejs_.capabilities.getMaxAnisotropy();
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
    this.scene_.add(plane);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 4),
      this.loadMaterial_('vintage-tile1_', 0.2));
    box.position.set(10, 2, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    this.scene_.add(box);
    
    const concreteMaterial = this.loadMaterial_('concrete3-', 4);

    const wall1 = new THREE.Mesh(
      new THREE.BoxGeometry(100, 100, 4),
      concreteMaterial);
    wall1.position.set(0, -40, -50);
    wall1.castShadow = true;
    wall1.receiveShadow = true;
    this.scene_.add(wall1);

    const wall2 = new THREE.Mesh(
      new THREE.BoxGeometry(100, 100, 4),
      concreteMaterial);
    wall2.position.set(0, -40, 50);
    wall2.castShadow = true;
    wall2.receiveShadow = true;
    this.scene_.add(wall2);

    const wall3 = new THREE.Mesh(
      new THREE.BoxGeometry(4, 100, 100),
      concreteMaterial);
    wall3.position.set(50, -40, 0);
    wall3.castShadow = true;
    wall3.receiveShadow = true;
    this.scene_.add(wall3);

    const wall4 = new THREE.Mesh(
      new THREE.BoxGeometry(4, 100, 100),
      concreteMaterial);
    wall4.position.set(-50, -40, 0);
    wall4.castShadow = true;
    wall4.receiveShadow = true;
    this.scene_.add(wall4);

    // Crosshair
    const crosshair = mapLoader.load('resources/crosshair.png');
    crosshair.anisotropy = maxAnisotropy;

    this.sprite_ = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: crosshair, color: 0xffffff, fog: false, depthTest: false, depthWrite: false })
    );
    this.sprite_.scale.set(0.15, 0.15 * this.camera_.aspect, 1);
    this.sprite_.position.set(0, 0, -10);
    this.uiScene_.add(this.sprite_);
}

createGrid(size) {
  const grid = [];
  const totalSlots = size * size; // Should be 100 for a 10x10 grid

  const filledSlots = Math.floor(totalSlots * 0.7); // Adjust fill ratio here
  const filledIndices = new Set();

  while (filledIndices.size < filledSlots) {
    const index = Math.floor(Math.random() * totalSlots);
    filledIndices.add(index);
  }
  this.slotSize = CYLINDER_SIZE * 2.5; // Adjust this value based on desired spacing

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const index = x * size + z;
     // Only add positions for filled slots
     if (filledIndices.has(index)) {
      const position = new THREE.Vector3(
        x * this.slotSize - (size / 2 * this.slotSize), // Center the grid
        START_HEIGHT, // Start at a defined height
        z * this.slotSize - (size / 2 * this.slotSize)  // Center the grid
      );
      grid.push(position);
    }
    }
  }
  return grid;
}

createCylinder(position) {
  const CYLINDER_DATA = {
    radiusTop: CYLINDER_SIZE,
    radiusBottom: CYLINDER_SIZE,
    height: CYLINDER_SIZE * 2,
    radialSegments: 6,
    heightSegments: 1,
    openEnded: false,
    thetaStart: 0,
    thetaLength: 2 * Math.PI
  };
  // Create geometry using the defined cylinder data
  const cylinderGeometry = new THREE.CylinderGeometry(
    CYLINDER_DATA.radiusTop,
    CYLINDER_DATA.radiusBottom,
    CYLINDER_DATA.height,
    CYLINDER_DATA.radialSegments,
    CYLINDER_DATA.heightSegments,
    CYLINDER_DATA.openEnded,
    CYLINDER_DATA.thetaStart,
    CYLINDER_DATA.thetaLength
  );
  const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinderMesh.position.copy(position);
  cylinderMesh.geometry.computeBoundingBox();

  const boxHelper = new THREE.BoxHelper(cylinderMesh, 0xffff00); // Yellow bounding box for visibility
  this.scene_.add(boxHelper);
  cylinderMesh.boundingBox = new THREE.Box3().setFromObject(cylinderMesh);

  const wireframe = new THREE.LineSegments(
    new THREE.EdgesGeometry(cylinderGeometry),
    new THREE.LineBasicMaterial({ color: 0xff0000 })
  );
  wireframe.position.copy(position);

  this.scene_.add(cylinderMesh);

  this.cylinders.push(cylinderMesh); 
  this.scene_.add(wireframe);
  objects.push(cylinderMesh);

}

  createCylinders() {
    this.grid.forEach(position => {
      this.createCylinder(position); // Create cylinder at grid position
      
    });
  }
  
  spawnCylinders(count) {
    const availablePositions = this.grid.slice(); // Copy of grid positions
  
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      const position = availablePositions[randomIndex];
  
      this.createCylinder(position);
      // Remove the position from the available positions to prevent overlap
      availablePositions.splice(randomIndex, 1);
    }
  }

  detectLanding() {
    let isOnObject = false;
  
    // Use controls.getObject() to get the player object (instead of the camera)
    const playerPosition = this.controls.object.position;
  
    // Set the ray's origin to the player's current position
    this.landingRaycaster.ray.origin.copy(playerPosition);
  
    // Offset the ray downwards a little bit from the player's feet
    this.landingRaycaster.ray.origin.y -= 0.1;  // Small offset below the player's feet
    
    // Set the ray's direction to point downwards (Y-axis)
    this.landingRaycaster.ray.direction.set(0, -1, 0); // Point the ray downwards
  
    // Check for intersections with all the cylinders in the scene
    const intersects = this.landingRaycaster.intersectObjects(this.cylinders, false);
  
    if (intersects.length > 0) {
      const intersect = intersects[0]; // Get the closest intersection (the first one)
  
      // Get the cylinder that was hit
      const landingObject = intersect.object;
      
      // Calculate the top of the cylinder
      const cylinderHeight = landingObject.geometry.parameters.height;
      const cylinderTopY = landingObject.position.y + (cylinderHeight / 2);
  
      // Check if the player is close enough to the top of the cylinder to land
      if (playerPosition.y > cylinderTopY - 1 && playerPosition.y < cylinderTopY + 0.5) {
        console.log('Landed on:', landingObject);
        
        // Align the player with the top of the cylinder
        playerPosition.y = cylinderTopY;
        
        // Reset velocities and jump state
        this.verticalVelocity = 0;
        this.jumpVelocity = 0;
        this.isJumping = false;
        this.canJump = true;
        isOnObject = true;
      }
    }
  
    // Apply gravity if the player isn't standing on any object
    if (!isOnObject) {
      this.verticalVelocity += this.gravity * 0.016; // Apply gravity over time
      playerPosition.y += this.verticalVelocity; // Update player's Y position
  
      // Prevent falling below a certain ground level
      if (playerPosition.y < 100) {
        this.verticalVelocity = 0;
        playerPosition.y = 100; // Set to the minimum Y value
        this.canJump = true; // Allow jumping again
      }
    }
  
    // Update the previous Y position for the next frame
    this.previousY = playerPosition.y;
  }
  
  
  raf_() {
    requestAnimationFrame((t) => {
        // Initialize previousRAF_ on the first call
        if (this.previousRAF_ === null) {
            this.previousRAF_ = t;
        }

        const timeElapsed = t - this.previousRAF_; // Time since last frame in milliseconds
        this.previousRAF_ = t; // Update previousRAF_ for the next frame

        // Convert to seconds for better accuracy
        const timeElapsedS = timeElapsed * 0.001; // Convert milliseconds to seconds

        this.inputController.update(); // Update input states
        // Start measuring performance
        this.stats.begin(); 
        this.step_(timeElapsedS); // Update the scene with time in seconds
        // Clear the scene
        this.threejs_.autoClear = true;
        this.threejs_.render(this.scene_, this.camera_); // Render the main scene
        this.threejs_.autoClear = false; // Reset autoClear to false for UI rendering
        this.threejs_.render(this.uiScene_, this.uiCamera_); // Render the UI scene
        this.stats.end(); // Stop measuring
        const playerBoundingBox = new THREE.Box3().setFromCenterAndSize(
          this.camera_.position,
          new THREE.Vector3(2, 2, 2) // Adjust the size based on the player's size
      );
   

      for (const cylinder of this.cylinders) {
        const cylinderBox = cylinder.boundingBox;
  
        if (playerBoundingBox.intersectsBox(cylinderBox)) {
          console.log('Collision detected with cylinder!');
          cylinder.material.color.set(0xffff00); // Change color
  
        
        }
      }
  
      this.detectLanding(); // Call the detectLanding method

        // Update FPS and frame count
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastTime >= 1000) { // Update FPS once per second
            this.fps = this.frameCount; // Save the frame count for this second
            this.frameCount = 0; // Reset for the next second
            this.lastTime = currentTime; // Update last time
        }
        // Call the next frame
        this.raf_();
    });
}

jump() {
  // Ensure the player can jump only if they are on the ground
  if (!this.isJumping) {
      this.isJumping = true;
      this.verticalVelocity = this.jumpHeight; // Set vertical velocity for the jump
  }
}

step_(timeElapsedS) {
    // Use timeElapsedS for updates
    this.fpsCamera_.update(timeElapsedS); // Example usage
    // Other updates that depend on the elapsed time can go here
}}
let _APP = null;
window.addEventListener('DOMContentLoaded', () => {
  _APP = new FirstPersonCameraDemo();
})