import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import Stats from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/stats.module.js';
import { Octree } from 'three/examples/jsm/math/Octree';
import { Capsule } from 'three/examples/jsm/math/Capsule';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';

const KEYS = {
  'a': 65,
  's': 83,
  'w': 87,
  'd': 68,
  'shift': 16  
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

// Modify the global click event to check for pointer lock state
document.body.addEventListener('click', () => {
  if (!document.pointerLockElement) {
    document.body.requestPointerLock();  // Only request pointer lock if it's not active
  }
});


class InputController {
  constructor(target) { 

    this.target_ = target || document;
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

   // Add pointer lock change listener
    this.target_.addEventListener('mousedown', (e) => this.onMouseDown_(e), false);
    this.target_.addEventListener('mousemove', (e) => this.onMouseMove_(e), false);
    this.target_.addEventListener('mouseup', (e) => this.onMouseUp_(e), false);
    this.target_.addEventListener('keydown', (e) => this.onKeyDown_(e), false);
    this.target_.addEventListener('keyup', (e) => this.onKeyUp_(e), false);
  }

  onMouseMove_(e) {
  // Ignore mouse movement when not locked
    // Calculate centered mouse position
    this.current_.mouseX = e.pageX - window.innerWidth / 2;
    this.current_.mouseY = e.pageY - window.innerHeight / 2;
  
    // Initialize previous if it's the first move
    if (this.previous_ === null) {
      this.previous_ = {...this.current_};
    }
  
    // Use movement deltas directly for rotation
    this.current_.mouseXDelta = e.movementX; // Change in X position
    this.current_.mouseYDelta = e.movementY; // Change in Y position
  
    // Update previous mouse position for next move
    this.previous_.mouseX = this.current_.mouseX;
    this.previous_.mouseY = this.current_.mouseY;
  }

  onMouseDown_(e) {
    this.onMouseMove_(e);

    switch (e.button) {
      case 0: {
        this.current_.leftButton = true;
        break;
      }
      case 2: {
        this.current_.rightButton = true;
        break;
      }
    }
  }

  onMouseUp_(e) {
    this.onMouseMove_(e);

    switch (e.button) {
      case 0: {
        this.current_.leftButton = false;
        break;
      }
      case 2: {
        this.current_.rightButton = false;
        break;
      }
    }
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

  isReady() {
    return this.previous_ !== null;
  }

  update(_) {
    if (this.previous_ !== null) {
      this.current_.mouseXDelta = this.current_.mouseX - this.previous_.mouseX;
      this.current_.mouseYDelta = this.current_.mouseY - this.previous_.mouseY;

      this.previous_ = {...this.current_};
    }
  }
};

class Player {
  constructor(scene, octree, doorOctree, firstPersonCamera) { // Add firstPersonCamera
    this.scene = scene;
    this.octree = octree;
    this.doorOctree = doorOctree; // Assign doorOctree here
    this.firstPersonCamera = firstPersonCamera;  // Store the camera instance

    this.position = new THREE.Vector3(0, 2, 0); // Initial player position
    this.velocity = new THREE.Vector3(0, 0, 0); // Add velocity property
    
    this.capsule = new Capsule(
      new THREE.Vector3(0, 1, 0), // Capsule base
      new THREE.Vector3(0, 2, 0), // Capsule top
      0.5 // Capsule radius
    );
  }

  updateCapsulePosition() {
    this.capsule.start.copy(this.position);
    this.capsule.end.copy(this.position).add(new THREE.Vector3(0, 1, 0)); // Set capsule height
  
  }
  handleCollision() {
    let result = this.octree ? this.octree.capsuleIntersect(this.capsule) : null;

    // Check door collision only if the door is closed
    if (this.firstPersonCamera && !this.firstPersonCamera.checkIfDoorIsOpen() && this.doorOctree) {
        const doorResult = this.doorOctree.capsuleIntersect(this.capsule);
        if (doorResult && (!result || doorResult.depth > result.depth)) {
            result = doorResult;
            console.log("Collision detected with door.");
        }
    }

    if (result) {
        const adjustment = result.normal.clone().multiplyScalar(result.depth);
        this.position.add(adjustment);
        this.updateCapsulePosition(); // Ensure capsule follows corrected position

        if (result.normal.y > 0) { 
            this.isGrounded = true;
            this.velocity.y = 0; // Stop downward movement
        } else {
            // Reset velocity along the collision normal
            const velocityAlongNormal = this.velocity.clone().dot(result.normal);
            if (velocityAlongNormal < 0) {
                this.velocity.addScaledVector(result.normal, -velocityAlongNormal);
            }
        }
    }
}


  getPosition() {
    return this.position;
  }
}

let hasKeycard = false;

class FirstPersonCamera {
  constructor(camera, player, objects, sceneObjects, octree, doorOctree) {  // Add doorOctree here
  this.camera_ = camera;
  this.input_ = new InputController(); 
  this.octree = octree; // Use the octree
  this.doorOctree = doorOctree;
  this.player_ = player; // Now passing in the player object directly
  this.isDoorOpen = false; // Keep the boolean property name as is
  this.rotation_ = new THREE.Quaternion();
  this.baseHeight = 2; // Set the base height here (adjustable)
  this.translation_ = new THREE.Vector3(0, this.baseHeight, 0);
  this.phi_ = 0;
  this.phiSpeed_ = 8;
  this.theta_ = 0;
  this.thetaSpeed_ = 5;
  this.moveSpeed_= 7; // Adjust this value for movement speed
  this.lookSpeed_ = 5;  // Adjust this value for look speed
  this.headBobActive_ = false;
  this.headBobTimer_ = 0;
  this.headBobSpeed_ = 12;
  this.headBobHeight_ = .13;
  this.raycaster = new THREE.Raycaster(); // Store a single raycaster instance
  this.lastFootstepTime_ = 0; // Define this variable in the constructor
  this.isSprinting = false; // State for sprinting
  this.sprintTimeout = false; // Sprint timeout state
  // Jumping variables
  this.isJumping = false; // State to track if the player is jumping
  this.velocity = new THREE.Vector3(0, 0, 0); // 3D vector for velocity
  this.gravity = -64; // Gravity constant
  this.verticalVelocity = 0; // Current vertical speed
  this.jumpHeight = 2; // Max height of the jump
  this.groundLevel = this.baseHeight; // Set the ground level to the base height
  this.objects_ = objects;
  this.sceneObjects = sceneObjects || [];     // Audio listener setup

}

checkIfDoorIsOpen() { // Rename the method
  return this.isDoorOpen; // Return the property
}

initializeKeycardAndDoor(handle, door, keycard, wiggleAction, doorAction) {
  this.handle = handle;
  this.door = door;
  this.keycard = keycard;
  this.wiggleAction = wiggleAction;
  this.doorAction = doorAction;
  this.doorOpen = false; // Rename the boolean property

  // Ensure door action is non-looping and clamps at the final frame
  if (this.doorAction) {
    this.doorAction.loop = THREE.LoopOnce;
    this.doorAction.clampWhenFinished = true;
  }

  // Track the door’s open/closed state
  // Set the initial state of the door to closed
  if (this.doorAction) {
    this.doorAction.reset();
    this.doorAction.time = 0; // Set to start of animation (closed)
    this.doorAction.stop();   // Prevent it from running initially
  }

  // Keycard pickup event listener
  window.addEventListener('click', () => {
    if (!this.keycard) {
      console.warn("Keycard object not found. Check your keycard setup.");
      return;
    }

    const centerScreen = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(centerScreen, this.camera_);
    const intersects = this.raycaster.intersectObject(this.keycard, true);

    if (intersects.length > 0 && !hasKeycard) {
      hasKeycard = true;
      this.keycard.visible = false;  // Hide keycard on pickup
      console.log("Keycard collected! Door interaction enabled.");
    }
  });

  // Door interaction event listener
  window.addEventListener('click', () => {
    if (!this.handle || !this.door) {
      console.warn("Handle or door object not found. Check your setup.");
      return;
    }

    const centerScreen = new THREE.Vector2(0, 0);
    this.raycaster.setFromCamera(centerScreen, this.camera_);
    const intersects = this.raycaster.intersectObject(this.handle, true);

    if (intersects.length > 0) {
      // Trigger wiggle animation on handle click
      if (this.wiggleAction && !this.wiggleAction.isRunning()) {
        this.wiggleAction.reset();
        this.wiggleAction.play();
        console.log("Handle wiggle animation triggered.");
      }

      if (hasKeycard && this.doorAction) {
        if (!this.isDoorOpen) {
          this.doorAction.reset();
          this.doorAction.timeScale = 1;
          this.doorAction.play();
          this.isDoorOpen = true;  // Set door as open, disabling door collisions
          console.log("Door opened.");
        } else {
          this.doorAction.timeScale = -1;
          this.doorAction.paused = false;
          this.doorAction.play();
          this.isDoorOpen = false;  // Set door as closed, enabling door collisions
          console.log("Door closed.");
        }
      } else if (!hasKeycard) {
        console.log("You need the keycard to open this door!");
      }
    }
  });
}

  update(timeElapsedS) {
    this.updateRotation_(timeElapsedS);
    this.updateCamera_(timeElapsedS);
    this.updateTranslation_(timeElapsedS);
    this.updateHeadBob_(timeElapsedS);
    // You can access the player's position like this:
    // const playerPosition = this.player_.getPosition();
    // console.log("Player Position: ", playerPosition);

    this.input_.update(timeElapsedS);
  }

  updateCamera_(_) {
    this.camera_.quaternion.copy(this.rotation_);
    this.camera_.position.copy(this.translation_);
    this.camera_.position.y += Math.sin(this.headBobTimer_ * this.headBobSpeed_) * this.headBobHeight_;

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

    this.camera_.lookAt(closest);
  }

  updateHeadBob_(timeElapsedS) {
    if (this.isJumping) {
    // Do not apply head bobbing when jumping
    this.headBobTimer_ = 0; 
    }
    if (this.headBobActive_) {
      const wavelength = Math.PI;
      const nextStep = 1 + Math.floor(((this.headBobTimer_ + 0.000001) * this.headBobSpeed_) / wavelength);
      const nextStepTime = nextStep * wavelength / this.headBobSpeed_;
      this.headBobTimer_ = Math.min(this.headBobTimer_ + timeElapsedS, nextStepTime);

      if (this.headBobTimer_ == nextStepTime) {
        this.headBobActive_ = false;
      }    
      
    }
  }

  updateTranslation_(timeElapsedS) {
    const forwardVelocity = (this.input_.key(KEYS.w) ? 1 : 0) + (this.input_.key(KEYS.s) ? -1 : 0);
    const strafeVelocity = (this.input_.key(KEYS.a) ? 1 : 0) + (this.input_.key(KEYS.d) ? -1 : 0);

    // Sprint logic
    const canSprint = this.input_.key(KEYS.shift) && !this.isJumping;
    const isSprinting = canSprint;
    const currentMoveSpeed = isSprinting ? this.moveSpeed_ * 2 : this.moveSpeed_;
    const strafeSpeed = currentMoveSpeed * 0.8; // Slightly slower strafing
    this.isSprinting = isSprinting;
    // Jumping logic
    if (this.isGrounded && this.input_.key(32)) { // Space key for jump
      this.isJumping = true;
      
      // Increase jump height when sprinting
      const sprintMultiplier = this.isSprinting ? 5.0 : 1.0; // Adjust multiplier as needed
      this.velocity.y = Math.sqrt(2 * -this.gravity * this.jumpHeight * sprintMultiplier);

      this.isGrounded = false;
    }

    // Apply gravity if not grounded
    if (!this.isGrounded) {
        this.velocity.y += this.gravity * timeElapsedS;
    }

    // Break movement into multiple substeps (prevents skipping through objects)
    const numSubsteps = 5;
    for (let i = 0; i < numSubsteps; i++) {
        const stepTime = timeElapsedS / numSubsteps;

        // Calculate movement vectors
        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(qx).multiplyScalar(forwardVelocity * stepTime * currentMoveSpeed);
        const left = new THREE.Vector3(-1, 0, 0).applyQuaternion(qx).multiplyScalar(strafeVelocity * stepTime * strafeSpeed);

        // Apply movement
        this.translation_.add(forward);
        this.translation_.add(left);
        this.translation_.y += this.velocity.y * stepTime;

        // Check for collisions at each substep
        this.player_.position.copy(this.translation_);
        this.player_.updateCapsulePosition();
        this.player_.handleCollision();
        this.translation_.copy(this.player_.getPosition());
    }

    // Ensure player doesn't fall below ground level
    if (this.translation_.y < this.groundLevel) {
        this.translation_.y = this.groundLevel;
        this.velocity.y = 0;
        this.isGrounded = true;
        this.isJumping = false;
    }

    this.isMoving = forwardVelocity || strafeVelocity;
    if (this.isMoving) {
        this.headBobActive_ = true; // Activate head bobbing when moving
    }

}
  initializeHandleWiggle(handle, wiggleAction) {
    this.handle = handle;
    this.wiggleAction = wiggleAction;

    window.addEventListener('click', () => {
      const centerScreen = new THREE.Vector2(0, 0); // Center coordinates
      this.raycaster.setFromCamera(centerScreen, this.camera_);
      const intersects = this.raycaster.intersectObject(this.handle, true);

      if (intersects.length > 0 && this.wiggleAction) {
        this.wiggleAction.reset();
        this.wiggleAction.play(); // Play the wiggle animation on detection
        console.log("Handle wiggle animation triggered at center.");
      }
    });
  }
  
  updateRotation_(timeElapsedS) {
    const xh = this.input_.current_.mouseXDelta / window.innerWidth;
    const yh = this.input_.current_.mouseYDelta / window.innerHeight;

    this.phi_ += -xh * this.phiSpeed_;
    this.theta_ = clamp(this.theta_ + -yh * this.thetaSpeed_, -Math.PI / 3, Math.PI / 3);

    const qx = new THREE.Quaternion();
    qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);
    const qz = new THREE.Quaternion();
    qz.setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.theta_);

    const q = new THREE.Quaternion();
    q.multiply(qx);
    q.multiply(qz);

    this.rotation_.copy(q);
  }
}

class FirstPersonCameraDemo {
  constructor() {    

 
   this.initializeRenderer_(); // Ensure this is called early

   this.initialize_(); 
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange_(), false);

    document.body.addEventListener('click', () => {
      if (!document.pointerLockElement) {
        document.body.requestPointerLock();
      }
    });

  }

  initialize_() {
    this.octree = new Octree();  // Initialize the octree here
    this.doorOctree = new Octree(); // Separate octree for the door

    this.createSecondaryScenes_();  // Create secondary scenes and cameras first
    this.initializeScene_();
    // this.initializeLights_();
    this.inputController = new InputController(document.body);
    this.player_ = new Player(this.scene_, this.octree, this.doorOctree, this.fpsCamera_);

    this.fpsCamera_ = new FirstPersonCamera(this.camera_, this.player_, this.objects_, this.sceneObjects, this.scene_, this.octree, this.doorOctree);

    // Now assign fpsCamera_ to player explicitly
    this.player_.firstPersonCamera = this.fpsCamera_;
    this.initStats();
 
    this.previousRAF_ = null;
    this.raf_();
    this.onWindowResize_();

    // Load models after fpsCamera_ is set up
    this.loadModels_();
}

loadModels_() {
  // Load the door model
  const loader2 = new GLTFLoader();
  loader2.load('resources/GreyDoor.glb', (gltf) => {
    const model = gltf.scene;
    model.scale.set(2, 1.9, 2);
    model.position.set(5.5, -0.2, -5.9);
    this.scene_.add(model);
    // Add each child mesh of the door to the separate door octree
    // Ensures door collisions are separate
    model.traverse((child) => {
      if (child.isMesh) {
          this.doorOctree.fromGraphNode(child);  
      }
  });

    console.log("Door added to the octree for collision detection.");
    this.mixer = new THREE.AnimationMixer(model);

    // Get handle and door animations
    const handle = model.getObjectByName('handle');
    const wiggleAnimationIndex = 3;
    const openAnimationIndex = 8;

    const wiggleAction = gltf.animations[wiggleAnimationIndex] ? this.mixer.clipAction(gltf.animations[wiggleAnimationIndex]) : null;
    const doorAction = gltf.animations[openAnimationIndex] ? this.mixer.clipAction(gltf.animations[openAnimationIndex]) : null;

    if (wiggleAction) wiggleAction.loop = THREE.LoopOnce;
    if (doorAction) doorAction.loop = THREE.LoopOnce;

    // Add handle to sceneObjects for detection
    if (handle) {
      this.sceneObjects.push(handle);
      console.log("Handle added to sceneObjects for detection.");
    } else {
      console.error("Handle not found in the model.");
    }

    // Load the keycard model after the door is loaded
    const loader = new GLTFLoader();
    loader.load('resources/democamz11.glb', (gltf) => {
      const monmonModel = gltf.scene;
      this.scene_.add(monmonModel);

      const keycardObject = monmonModel.getObjectByName('RootNode');
      if (keycardObject) {
        if (this.fpsCamera_) {
          this.fpsCamera_.initializeKeycardAndDoor(handle, model, keycardObject, wiggleAction, doorAction);
          console.log("Keycard initialized:", keycardObject);
        } else {
          console.error("fpsCamera_ is not initialized when trying to call initializeKeycardAndDoor.");
        }
      } else {
        console.error("Keycard object 'RootNode' not found in monmon33.");
      }
    });
  });
}

// Show /  Hide instructions when locked
  onPointerLockChange_() {
    if (document.pointerLockElement === document.body) {
      console.log("Pointer Lock enabled");
      hideInstructions();  //
    } else {
      console.log("Pointer Lock disabled");
      showInstructions();  
    }
  }
  initializeScene_() {

    // Octree must be initialized before adding objects to it

    if (!this.octree) {
    console.error("Octree is not initialized!");
    return;
    }

    // const loader = new THREE.CubeTextureLoader();
    // const texture = loader.load([
    //     'resources/skybox/Cold_Sunset__Cam_2_Left+X.png',   // Left (-X)
    //     'resources/skybox/Cold_Sunset__Cam_3_Right-X.png',  // Right (+X)
    //     'resources/skybox/Cold_Sunset__Cam_4_Up+Y.png',     // Top (+Y)
    //     'resources/skybox/Cold_Sunset__Cam_5_Down-Y.png',   // Bottom (-Y)
    //     'resources/skybox/Cold_Sunset__Cam_0_Front+Z.png',  // Front (+Z)
    //     'resources/skybox/Cold_Sunset__Cam_1_Back-Z.png'    // Back (-Z)
    // ]);
    // texture.encoding = THREE.sRGBEncoding;
    // this.scene_.background = texture;
    // const loader = new THREE.CubeTextureLoader();
    // const texture = loader.load([

    //     'resources/skybox/space-posx.jpg',   // Left (-X)
    //     'resources/skybox/space-negx.jpg',  // Right (+X)
    //     'resources/skybox/space-posy.jpg', 
    //     'resources/skybox/space-negy.jpg',
    //     'resources/skybox/space-posz.jpg',    // Back (-Z)
    //     'resources/skybox/space-negz.jpg'    // Back (-Z)
    // ]);
    // texture.encoding = THREE.sRGBEncoding;
    // this.scene_.background = texture;

    // Ceiling Light Setup with RectAreaLight (for broader ceiling lighting)
const xOffset = -3; // Horizontal offset to position the light across the X-axis
const yOffset = 3;  // Additional vertical offset to position it near the ceiling
const zOffset = -4; // Offset to move the light along the Z-axis

// const pointLight = new THREE.PointLight(0xffffff, 3, 50);
// pointLight.position.set(xOffset, 1 + yOffset, zOffset);
// this.scene_.add(pointLight);
// const pointLightHelper = new THREE.PointLightHelper(pointLight, 0.5);
// this.scene_.add(pointLightHelper);

// Light 3
const light3 = new THREE.PointLight(0xffffff, 20, 20); // Blue color
light3.position.set(xOffset + 44, yOffset + 3, zOffset + 1);
this.scene_.add(light3);
const lightHelper3 = new THREE.PointLightHelper(light3, 0.5);
this.scene_.add(lightHelper3);


// Light 1
const light1 = new THREE.PointLight(0xff0000, 13, 20); // Red color, adjust intensity and distance
light1.position.set(xOffset + 25, yOffset + 2, zOffset + -23);
this.scene_.add(light1);
const lightHelper1 = new THREE.PointLightHelper(light1, 0.5);
this.scene_.add(lightHelper1);

const mapLoader = new THREE.TextureLoader();
const maxAnisotropy = this.threejs_.capabilities.getMaxAnisotropy();


const movingLight = new THREE.PointLight(0xff0000, 2, 100); // Start with red color
this.scene_.add(movingLight);

// PointLightHelper
const lightHelper = new THREE.PointLightHelper(movingLight, 0.5);
this.scene_.add(lightHelper);

// Store the movingLight and helper for later reference
this.movingLight = movingLight;
this.lightHelper = lightHelper;

// Create a second moving light with initial color blue
const movingLight2 = new THREE.PointLight(0x0000ff, 2, 100);
this.scene_.add(movingLight2);

// PointLightHelper
const lightHelper2 = new THREE.PointLightHelper(movingLight2, 0.5);
this.scene_.add(lightHelper2);

// Store for later use in the render loop
this.movingLight2 = movingLight2;
this.lightHelper2 = lightHelper2;

const torusKnotGeometry = new THREE.TorusKnotGeometry(1, 0.3, 100, 16);
const torusKnotMaterial = new THREE.MeshStandardMaterial({ color: 0x3eb489});
const torusKnot = new THREE.Mesh(torusKnotGeometry, torusKnotMaterial);

// Set exact position manually
torusKnot.position.set(18, 3, -20);  // Replace with your desired x, y, z coordinates
torusKnot.scale.set(2, 2, 2); // Scale it up further

// Add the torus knot to the main scene
this.scene_.add(torusKnot);

// Animation function for the torus knot rotation
const animateTorusKnot = () => {
    requestAnimationFrame(animateTorusKnot);
    torusKnot.rotation.x += 0.01; // Adjust values for desired rotation speed
    torusKnot.rotation.y += 0.01;
};

// Call the animation function to start rotating the torus knot
animateTorusKnot();


const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
this.scene_.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x555555, 0.2);
this.scene_.add(hemiLight);


// Load the Dragon model
const loader4 = new GLTFLoader();
let dragonMixer; // Animation mixer for the dragon

loader4.load('resources/Dragon.glb', (gltf) => {
    const dragonModel = gltf.scene;

    // Set initial position and scale of the dragon
    dragonModel.position.set(45, 7, -35); // Adjust x, y, z coordinates as needed
    dragonModel.scale.set(0.5, 0.5, 0.5); // Adjust the scale if needed

    // Add the dragon model to the main scene
    this.scene_.add(dragonModel);

    // Set up the animation mixer and play the flying animation
    dragonMixer = new THREE.AnimationMixer(dragonModel);
    const flyAction = dragonMixer.clipAction(gltf.animations[3]); // Assumes the flying animation is the first animation
    flyAction.play();

    // Define the animation update function and store it for use in the render loop
    this.animateDragon = (delta) => {
        if (dragonMixer) dragonMixer.update(delta);
    };
}, undefined, (error) => {
    console.error('Error loading Dragon model:', error);
});

    this.sceneObjects = [];
    this.objects_ = [];

      // Crosshair
      const crosshairMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const crosshairGeometry = new THREE.CircleGeometry(0.01, 32);
      const crosshair = new THREE.Mesh(crosshairGeometry, crosshairMaterial);
      
      // FIX: compensate for camera aspect
      crosshair.scale.set(1, this.camera_.aspect, 1);
      
      crosshair.position.set(0, 0, -10);
      this.uiScene_.add(crosshair);
      
      
      // this.createViewingPlanes_();

  }
  initializeRenderer_() {
    this.threejs_ = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.threejs_.shadowMap.enabled = true;
    this.threejs_.shadowMap.type = THREE.PCFSoftShadowMap;
    this.threejs_.setPixelRatio(window.devicePixelRatio);
    this.threejs_.setSize(window.innerWidth, window.innerHeight);
    this.threejs_.physicallyCorrectLights = true;
    this.threejs_.outputEncoding = THREE.sRGBEncoding;

    document.body.appendChild(this.threejs_.domElement);

    window.addEventListener('resize', () => {
      this.onWindowResize_();
    }, false);

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this.camera_ = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera_.position.set(0, 2, 0);

    this.scene_ = new THREE.Scene();

    this.uiCamera_ = new THREE.OrthographicCamera(
      -1, 1, 1 * aspect, -1 * aspect, 1, 1000);
  this.uiScene_ = new THREE.Scene();
  }

  // Initialize FPS stats
  initStats() {
    this.stats = new Stats();
    this.stats.showPanel(0); // 0: fps, 1: ms, 2: memory
    this.stats.dom.style.opacity = '0.9';
    this.stats.dom.style.zIndex = '10000';
    const canvas = this.stats.dom.children[0]; // Access the canvas element directly
    canvas.style.width = '100px';  // Set desired width
    canvas.style.height = '50px'; // Set desired height
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

  createSecondaryScenes_() {

    this.secondaryCameras = [];
    this.renderTargets = [];
    const cameraSettings = { fov: 45, aspect: 1, near: 0.1, far: 500 };
    // Set up secondary cameras and render targets for each screen
    for (let i = 0; i < 6; i++) {
        const camera = new THREE.PerspectiveCamera(cameraSettings.fov, cameraSettings.aspect, cameraSettings.near, cameraSettings.far);
        this.secondaryCameras.push(camera);

        // Render targets to project onto screens
        const renderTarget = new THREE.WebGLRenderTarget(256, 256);
        renderTarget.texture.minFilter = THREE.LinearFilter;
        renderTarget.texture.generateMipmaps = false;
        renderTarget.texture.encoding = THREE.sRGBEncoding;
        this.renderTargets.push(renderTarget);
    }

    const loader = new GLTFLoader();
  loader.load('resources/democamz11.glb', (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        console.log("Object:", child.name);  // This will log all object names within the model
    });


    // Look for the keycard (RootNode) within monmon33
    const keycardObject = model.getObjectByName('RootNode');
    if (keycardObject) {
      console.log("Keycard initialized:", keycardObject);
      keycardObject.visible = false;

    } else {
      console.error("Keycard object 'RootNode' not found in.");
    }

    // Define camera position mesh names
    const cameraMeshNames = [
      'NurbsPath', 'NurbsPath001', 'NurbsPath002', 
      'NurbsPath003', 'NurbsPath004', 'NurbsPath005' ];

      // Apply each camera mesh position to the corresponding secondary camera, with an offset
      const cameraOffset = 0.5; 
      cameraMeshNames.forEach((meshName, index) => {

      const mesh = model.getObjectByName(meshName);
      if (mesh && this.secondaryCameras[index]) {

          const camera = this.secondaryCameras[index];
          // Set position and apply an offset
          camera.position.copy(mesh.position);
          camera.translateZ(-cameraOffset);

      this.secondaryCameras[index].translateZ(-cameraOffset);

      if (index === 0) {
        camera.rotation.y += Math.PI / 2; 
        const downTilt = new THREE.Quaternion();
        downTilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 12); // Tilt down 10 degrees
        camera.quaternion.multiplyQuaternions(camera.quaternion, downTilt);   // Then tilt down
      } else if(index === 2) {
        camera.rotation.y += Math.PI / 2; // Rotate 90 degrees to the left
        // Tilt down along the local axis by 10 degrees
        const downTilt = new THREE.Quaternion();
        downTilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 12); // Tilt down 10 degrees
        // Combine the rotations
        camera.quaternion.multiplyQuaternions(camera.quaternion, downTilt);   // Then tilt down
      } else if (index === 4) {
          camera.rotation.y += Math.PI / 2; // Rotate 90 degrees to the left
      } else if (index === 3) {
          camera.rotation.y += Math.PI / 2; // Rcam one
      } else if (index === 5) {
        camera.rotation.y += Math.PI / 4; // Rotate 90 degrees to the left
      }
          
      this.secondaryCameras[index].updateProjectionMatrix();
          
      console.log(`Secondary camera ${index} set from ${meshName} with offset`);
      } else {
          console.warn(`Mesh ${meshName} or secondary camera ${index} not found`);
      }
    });


    // Define monitor and screen names based on the structure
    const monitorNames = [
        'computerScreen006', 'computerScreen001', 'computerScreen002',
        'computerScreen003', 'computerScreen004', 'computerScreen005'
    ];
    const screenNames = [
        'Screen1_Plane006', 'Screen1_Plane001', 'Screen1_Plane002',
        'Screen1_Plane003', 'Screen1_Plane004', 'Screen1_Plane005'
    ];

      monitorNames.forEach((monitorName, i) => {
          const monitor = model.getObjectByName(monitorName);
  
          if (monitor) {
            const screen = monitor.getObjectByName(screenNames[i]);
            if (screen) {
                // Apply the render target to the screen
                this.renderTargets[i].texture.flipY = false;


                
                // screen.material = new THREE.MeshStandardMaterial({
                //   map: this.renderTargets[i].texture,
                //   side: THREE.DoubleSide,
                //   roughness: 0.8,
                //   metalness: 0.2,
                // });
                // screen.material = new THREE.MeshStandardMaterial({
                //   map: this.renderTargets[i].texture,
                //   side: THREE.DoubleSide,
                //   roughness: 0.4,
                //   metalness: 0.0,
                // });
                screen.material = new THREE.MeshStandardMaterial({
                  map: this.renderTargets[i].texture,
                  emissiveMap: this.renderTargets[i].texture,  // <---
                  side: THREE.DoubleSide,
                  roughness: 0.4,
                  metalness: 0.0,
                  emissive: new THREE.Color(0xffffff),
                  emissiveIntensity: .5,
                });





                
                // this.renderTargets[i].texture.flipY = false;
                // screen.material = new THREE.MeshLambertMaterial({
                //   map: this.renderTargets[i].texture,
                //   side: THREE.DoubleSide,
                // });

                console.log(`Applied render target to ${screenNames[i]} on ${monitorName}`);
                // Get screen's world position
                const screenWorldPosition = new THREE.Vector3();
                screen.getWorldPosition(screenWorldPosition);

                // Define RectAreaLight size and intensity
                const lightWidth = 1.9;      //  width 
                const lightHeight = 1.2;     // height 
                const lightIntensity = 1;  //  intensity 
    
      // after you create your RectAreaLight:
const rectLight = new THREE.RectAreaLight(0xffffff, lightIntensity, lightWidth, lightHeight);
rectLight.position.copy(screenWorldPosition).add(new THREE.Vector3(0, 0, 0.30));
rectLight.lookAt(screenWorldPosition);
this.scene_.add(rectLight);

// Create a thin wireframe instead of a solid helper
// const rectFrameGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(lightWidth, lightHeight));
// const rectFrameMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
// const rectFrame = new THREE.LineSegments(rectFrameGeometry, rectFrameMaterial);

// // Move the frame exactly where the light is
// rectFrame.position.copy(rectLight.position);
// rectFrame.quaternion.copy(rectLight.quaternion);
// this.scene_.add(rectFrame);
                
              } else {
                  console.error(`Screen ${screenNames[i]} not found in ${monitorName}`);
              }
          } else {
              console.error(`${monitorName} not found in model`);
          }
      });
    
        // Add the entire model to the scene, preserving Blender's original positions
        this.scene_.add(model);

        model.traverse((child) => {
          if (child.isMesh) {
            if (child.name.includes("wall") || child.name.includes("window")) {
              this.octree.fromGraphNode(child);  // Add walls/windows to main octree
            } else if (child.name.includes("door")) {
              this.doorOctree.fromGraphNode(child); // Separate octree for door
            }
          }
        });
        
    }, undefined, (error) => {
        console.error('Error loading monitor model:', error);
    });

  }    

  raf_() {
    requestAnimationFrame((t) => {
      if (this.previousRAF_ === null) {
        this.previousRAF_ = t;
      }

      const delta = (t - this.previousRAF_) * 0.001; // Convert to seconds
      this.step_(delta);

      // Update the dragon animation if the animateDragon function is defined
      if (this.animateDragon) {
          this.animateDragon(delta);
      }

      const speedMultiplier1 = 0.5; // First light's speed
      const speedMultiplier2 = 0.8; // Second light's speed

      const time = t * 0.001;

      // First moving light animation with speed control
      const radius1 = 30;
      this.movingLight.distance = 10;
      this.movingLight.position.set(
          Math.sin(time * speedMultiplier1) * radius1, 
          8 + Math.sin(time * speedMultiplier1 * 0.5) * 2, 
          Math.cos(time * speedMultiplier1) * radius1
      );

      const color1 = new THREE.Color(`hsl(${(time * speedMultiplier1 * 50) % 360}, 100%, 50%)`);
      this.movingLight.color.set(color1);

      if (this.lightHelper) this.lightHelper.update();
      // Second moving light animation with speed control
      const radius2 = 25;
      const colorSpeed2 = 70;
      this.movingLight2.distance = 8;
      this.movingLight2.position.set(
          Math.cos(time * speedMultiplier2 * 1.1) * radius2,
          8 + Math.sin(time * speedMultiplier2 * 0.3) * 3, 
          Math.sin(time * speedMultiplier2 * 1.1) * radius2
      );

      const color2 = new THREE.Color(`hsl(${(time * speedMultiplier2 * colorSpeed2) % 360}, 100%, 50%)`);
      this.movingLight2.color.set(color2);

      if (this.lightHelper2) this.lightHelper2.update();
    
        this.step_(t - this.previousRAF_);
        this.stats.begin(); 
        this.threejs_.autoClear = true;

        this.secondaryCameras.forEach((camera, i) => {
          this.threejs_.setRenderTarget(this.renderTargets[i]);
          //new
          this.threejs_.clear(true, true, true);
          this.threejs_.toneMapping = THREE.ACESFilmicToneMapping;
          this.threejs_.toneMappingExposure = 1.0;
          this.threejs_.outputEncoding = THREE.sRGBEncoding;
          //end new      
          this.threejs_.render(this.scene_, camera);
        });
        
      this.threejs_.setRenderTarget(null); // Reset to render to screen
      this.threejs_.render(this.scene_, this.camera_);
      this.threejs_.autoClear = false;
      this.threejs_.render(this.uiScene_, this.uiCamera_);

      this.stats.end();
      this.previousRAF_ = t;
      this.raf_();
    });
  }

  step_(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;
    if (blocker.style.display === 'none') {
      this.fpsCamera_.update(timeElapsedS);
    }      // Update the mixer for animations
      if (this.mixer) {
        this.mixer.update(timeElapsedS);
    }
    const playerPos = this.fpsCamera_.player_.getPosition();
    const x = Math.floor(playerPos.x / this.segmentSize);
    const z = Math.floor(playerPos.z / this.segmentSize);
  }


}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new FirstPersonCameraDemo();
});
