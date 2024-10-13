import * as THREE from 'https://cdn.skypack.dev/three@0.136.0';
import Stats from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/stats.module.js';
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

    this.jumpVelocity = 0; // Vertical speed during jump
    this.velocity = new THREE.Vector3(0, 0, 0); // 3D vector for velocity

    this.gravity = -54; // Gravity constant
    this.verticalVelocity = 0; // Current vertical speed

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
        const isSprinting = canSprint; // Set sprinting status
  
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
     // Handle jumping
     if (!this.isJumping && this.translation_.y <= this.groundLevel && this.input_.key(32)) { // Only jump if grounded
      this.isJumping = true;
      const sprintFactor = isSprinting ? 1.7 : 1; // Jump higher if sprinting
      this.jumpVelocity = Math.sqrt(2 * -this.gravity * this.jumpHeight) * sprintFactor;
      console.log("Jump initiated. Jump velocity:", this.jumpVelocity); // Debug log
    }

    // Handle jumping logic
    if (this.isJumping) {
      this.translation_.y += this.jumpVelocity * timeElapsedS;  // Update Y position based on velocity
      this.jumpVelocity += this.gravity * timeElapsedS; // Apply gravity to jump velocity

      // Check if player has landed
      if (this.translation_.y <= this.groundLevel) {
        this.translation_.y = this.groundLevel;  // Reset to ground level
        this.isJumping = false;  // Player has landed
        this.jumpVelocity = 0;   // Reset jump velocity
        console.log("Player has landed.");  // Debug log for landing

        // Play footstep sound if moving upon landing
        if (this.isMoving && !this.footstepSound_.isPlaying) {
          this.footstepSound_.play();  // Resume footstep sounds
        }
      }
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
    if (!this.isJumping && this.translation_.y <= this.groundLevel && this.input_.key(32)) { // Only jump if grounded
      this.isJumping = true;
      const sprintFactor = isSprinting ? 1.7 : 1; // Jump higher if sprinting
      this.jumpVelocity = Math.sqrt(2 * -this.gravity * this.jumpHeight) * sprintFactor;
      console.log("Jump initiated. Jump velocity:", this.jumpVelocity); // Debug log
    }

    if (this.isJumping) {
      this.translation_.y += this.jumpVelocity * timeElapsedS;  // Update Y position based on velocity
      this.jumpVelocity += this.gravity * timeElapsedS; // Apply gravity to jump velocity


  }
  }

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


class FirstPersonCameraDemo {
  constructor() {


    this.camera = null; // Ensure this is initialized correctly
    this.controls = null; // Ensure this is initialized correctly
    this.inputController = null; // Declare the input controller
    this.scene = new THREE.Scene(); // Make sure this line exists
 
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
    this.uiCamera_ = new THREE.OrthographicCamera(
        -1, 1, 1 * aspect, -1 * aspect, 1, 1000);
    this.uiScene_ = new THREE.Scene();
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
      );
    box.position.set(10, 2, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    this.scene_.add(box);
  
    const meshes = [
      plane, box];

    this.objects_ = [];

    for (let i = 0; i < meshes.length; ++i) {
      const b = new THREE.Box3();
      b.setFromObject(meshes[i]);
      this.objects_.push(b);
    }
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

step_(timeElapsedS) {
    // Use timeElapsedS for updates
    this.fpsCamera_.update(timeElapsedS); // Example usage
    // Other updates that depend on the elapsed time can go here
}}
let _APP = null;
window.addEventListener('DOMContentLoaded', () => {
  _APP = new FirstPersonCameraDemo();
})