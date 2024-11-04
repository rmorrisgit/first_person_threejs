import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import Stats from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/stats.module.js';
import { EXRLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/EXRLoader.js';
import { Octree } from 'three/examples/jsm/math/Octree';
import { Capsule } from 'three/examples/jsm/math/Capsule';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/GLTFLoader.js';



import { DecalGeometry } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/geometries/DecalGeometry.js';

import { RectAreaLight } from 'three';
import { RectAreaLightHelper } from 'three/examples/jsm/helpers/RectAreaLightHelper.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
RectAreaLightUniformsLib.init();


const KEYS = {
  'a': 65,
  's': 83,
  'w': 87,
  'd': 68,
  'shift': 16  // Add this line to define the Shift key

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
    // Add Pointer Lock event listeners

    this.target_.addEventListener('mousedown', (e) => this.onMouseDown_(e), false);
    this.target_.addEventListener('mousemove', (e) => this.onMouseMove_(e), false);
    this.target_.addEventListener('mouseup', (e) => this.onMouseUp_(e), false);
    this.target_.addEventListener('keydown', (e) => this.onKeyDown_(e), false);
    this.target_.addEventListener('keyup', (e) => this.onKeyUp_(e), false);
  }


  onMouseMove_(e) {
  // Ignore mouse movement when not locked
  //comment
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
  constructor(scene, octree) {
    this.scene = scene;
    this.octree = octree;
    this.position = new THREE.Vector3(0, 2, 0); // Initial player position
    this.groundLevel = this.position.y; // Set default ground level

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

  handleCollision(velocity) {
    const result = this.octree.capsuleIntersect(this.capsule);

    if (result) {
        const normalComponent = result.normal.dot(velocity);
        if (normalComponent < 0) {
            velocity.addScaledVector(result.normal, -normalComponent);
        }

        this.position.add(result.normal.multiplyScalar(result.depth + 0.01));
        this.updateCapsulePosition();

        // Temporarily update ground level on any collision
        this.groundLevel = this.position.y;
        this.isGrounded = true;
        this.isJumping = false;
        velocity.y = 0;
    } else {
        this.isGrounded = false;
    }

    console.log("Collision Result:", result ? "Collided" : "No Collision", 
                "Surface Normal:", result ? result.normal.y : "N/A", 
                "Is Grounded:", this.isGrounded, 
                "Ground Level:", this.groundLevel);
}


  /*  if (result) {
    // Detect if the collision is mostly with the ground
    const isGroundCollision = result.normal.y > 0.5;  // Ground collision if the normal is pointing mostly upwards
    const isWallCollision = Math.abs(result.normal.y) < 0.5; // Treat near-horizontal normals as walls

    if (isGroundCollision) {
      // Collision with the ground or top of an object
      this.isGrounded = true;
      this.isJumping = false;
      velocity.y = 0; // Stop vertical velocity
      this.position.y += result.depth; // Snap player to the ground/object top
    } else if (isWallCollision) {
      // Handle wall collision
      const normalComponent = result.normal.dot(velocity);
      if (normalComponent < 0) {
        // Only push the player away if they are colliding with a wall
        velocity.addScaledVector(result.normal, -normalComponent); // Push the player out of the wall
      }
      this.position.add(result.normal.multiplyScalar(result.depth + 0.01)); // Small offset to prevent clipping
    }

    // Update capsule position after collision
    this.updateCapsulePosition();
  } else {
    this.isGrounded = false; // No collision means not grounded
  }
}*/
  
  getPosition() {
    return this.position;
    
  }
}

let hasKeycard = false;

class FirstPersonCamera {
  constructor(camera, player, objects, sceneObjects, scene, octree) {
  this.camera_ = camera;
  this.input_ = new InputController(); 
  this.octree = octree; // Use the octree
  this.player_ = player; // Now passing in the player object directly

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
  this.scene_ = scene;  // Store the scene for use in addDecal_
  // const listener = new THREE.AudioListener();
  // camera.add(listener);
  // this.footstepSound_ = new THREE.Audio(listener);
  // const audioLoader = new THREE.AudioLoader();
  // // Load the footstep audio
  // audioLoader.load('./sounds/footstep.ogg', (buffer) => {
  //   this.footstepSound_.setBuffer(buffer);
  //   this.footstepSound_.setLoop(false); // Prevent looping
  //   this.footstepSound_.setVolume(0.5);
  // }, undefined, (error) => {
  //   console.error('An error occurred while loading the audio file:', error);
  // });
}

  update(timeElapsedS) {
    this.updateRotation_(timeElapsedS);
    this.updateCamera_(timeElapsedS);
    this.updateTranslation_(timeElapsedS);
    this.updateHeadBob_(timeElapsedS);
    this.addDecal_();        // Check and add decals on mouse click

    // You can access the player's position like this:
    // const playerPosition = this.player_.getPosition();
    // console.log("Player Position: ", playerPosition);

    this.input_.update(timeElapsedS);
  }
  addDecal_() {
    if (this.input_.current_.leftButton && !this.input_.previous_.leftButton) {
      const centerScreen = new THREE.Vector2(0, 0);
      this.raycaster.setFromCamera(centerScreen, this.camera_);
      const hits = this.raycaster.intersectObjects(this.sceneObjects);
  
      if (hits.length > 0) {
        // Only trigger if animation is not already playing
        if (this.wiggleAction && !this.wiggleAction.isRunning) {
          this.wiggleAction.reset();
          this.wiggleAction.play();
        }
      }
    }}
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
    this.headBobTimer_ = 0; // Optionally reset timer while jumping
    // if (this.footstepSound_.isPlaying) {
    //     this.footstepSound_.stop(); // Stop sound if jumping
    // }
    return; // Exit the method to avoid head bobbing
    }
    if (this.headBobActive_) {
      const wavelength = Math.PI;
      const nextStep = 1 + Math.floor(((this.headBobTimer_ + 0.000001) * this.headBobSpeed_) / wavelength);
      const nextStepTime = nextStep * wavelength / this.headBobSpeed_;
      this.headBobTimer_ = Math.min(this.headBobTimer_ + timeElapsedS, nextStepTime);

      if (this.headBobTimer_ == nextStepTime) {
        this.headBobActive_ = false;
      }    
      //     if (this.footstepSound_.isPlaying) {
      //       this.footstepSound_.stop();
      //     }
      //   }
      // } else if (!this.isMoving) {
      //   // Ensure head bobbing and sound stop immediately when not moving
      //   this.headBobTimer_ = 0; // Reset the timer if not moving
      //   if (this.footstepSound_.isPlaying) {
      //     this.footstepSound_.stop(); // Stop sound immediately
      //   }
    }
  }

  updateTranslation_(timeElapsedS) {
    const forwardVelocity = (this.input_.key(KEYS.w) ? 1 : 0) + (this.input_.key(KEYS.s) ? -1 : 0)
    const strafeVelocity = (this.input_.key(KEYS.a) ? 1 : 0) + (this.input_.key(KEYS.d) ? -1 : 0)

    // Check if the player can sprint
    const canSprint =  this.input_.key(KEYS.shift) && !this.isJumping;
    const isSprinting = canSprint;
    const currentMoveSpeed = isSprinting ? this.moveSpeed_ * 2 : this.moveSpeed_;
    const strafeSpeed = isSprinting ? currentMoveSpeed * 0.8 : currentMoveSpeed * 0.8;  
    this.isSprinting = isSprinting; 
      // Jump initiation
    if (this.isGrounded && this.input_.key(32)) { // Space key for jump
        this.isJumping = true;
        const sprintFactor = isSprinting ? 1.7 : 1;
        this.velocity.y = Math.sqrt(2 * -this.gravity * this.jumpHeight) * sprintFactor;
        this.isGrounded = false;
    }
    // Apply gravity if not grounded
    if (!this.isGrounded) {
        this.velocity.y += this.gravity * timeElapsedS;
    }
    // Apply vertical movement
    this.translation_.y += this.velocity.y * timeElapsedS;
      // Check if the player is below ground level
    if (this.translation_.y < this.groundLevel) {
      this.translation_.y = this.groundLevel; // Snap to ground level
      this.velocity.y = 0;  // Stop downward velocity
      this.isGrounded = true; // Mark as grounded
      this.isJumping = false;
    }
    // Handle movement
    this.isMoving = forwardVelocity || strafeVelocity;
    if (this.isMoving) {
      const qx = new THREE.Quaternion();
      qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);

      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(qx);
      forward.multiplyScalar(forwardVelocity * timeElapsedS * currentMoveSpeed);

      const left = new THREE.Vector3(-1, 0, 0);
      left.applyQuaternion(qx);
      left.multiplyScalar(strafeVelocity * timeElapsedS * strafeSpeed);

      this.translation_.add(forward);
      this.translation_.add(left);
    }
    // Update player's capsule position
    this.player_.position.copy(this.translation_);
    this.player_.updateCapsulePosition();
    // Handle collisions
    this.player_.handleCollision(this.velocity);
    // After handling collisions, update translation again
    this.translation_.copy(this.player_.getPosition());
    // If grounded (confirmed by collision), snap to ground level
    if (this.isGrounded) {
      this.translation_.y = this.groundLevel; // Snap to ground level only when confirmed grounded
      this.velocity.y = 0;
    }
    //   // Play footstep sound when moving
    //   if (!this.footstepSound_.isPlaying) {
    //     this.footstepSound_.play();
    //   }
    // } else {
    //   // Stop footstep sound when not moving
    //   if (this.footstepSound_.isPlaying) {
    //     this.footstepSound_.stop();
    //   }
    //   this.headBobActive_ = false; // Disable head bobbing when not moving

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
    this.segmentSize = 50;  // Size of each ground segment
    this.groundSegments = new Map();  // Track existing ground segments
    this.cubeTextureLoader = new THREE.CubeTextureLoader();
    this.skyboxTexture = this.cubeTextureLoader.load([
      './resources/skybox/posx.jpg',
      './resources/skybox/negx.jpg',
      './resources/skybox/posy.jpg',
      './resources/skybox/negy.jpg',
      './resources/skybox/posz.jpg',
      './resources/skybox/negz.jpg',
    ]);
   this.skyboxTexture.encoding = THREE.sRGBEncoding;
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
    this.createSecondaryScenes_();  // Create secondary scenes and cameras first
    this.initializeScene_();
    // this.initializeLights_();

    this.player_ = new Player(this.scene_, this.octree); // Make sure this is created first

    this.inputController = new InputController(document.body);

    this.fpsCamera_ = new FirstPersonCamera(this.camera_,  this.player_, this.objects_, this.sceneObjects, this.scene_, this.octree);

    this.initStats();
 
    this.previousRAF_ = null;
    this.raf_();
    this.onWindowResize_();

  }


  onPointerLockChange_() {
    if (document.pointerLockElement === document.body) {
      console.log("Pointer Lock enabled");
      hideInstructions();  // Hide instructions when locked
    } else {
      console.log("Pointer Lock disabled");
      showInstructions();  // Show instructions when pointer lock is disabled
    }
  }
  initializeScene_() {
    this.sharedSceneDirectionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.sharedSceneDirectionalLight.position.set(10, 20, 10);
    this.sharedSceneDirectionalLight.castShadow = true;
    this.sharedScene.add(this.sharedSceneDirectionalLight);

    // Octree must be initialized before adding objects to it
    if (!this.octree) {
    console.error("Octree is not initialized!");
    return;
    }
    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        'resources/skybox/Cold_Sunset__Cam_2_Left+X.png',   // Left (-X)
        'resources/skybox/Cold_Sunset__Cam_3_Right-X.png',  // Right (+X)
        'resources/skybox/Cold_Sunset__Cam_4_Up+Y.png',     // Top (+Y)
        'resources/skybox/Cold_Sunset__Cam_5_Down-Y.png',   // Bottom (-Y)
        'resources/skybox/Cold_Sunset__Cam_0_Front+Z.png',  // Front (+Z)
        'resources/skybox/Cold_Sunset__Cam_1_Back-Z.png'    // Back (-Z)
    ]);
    texture.encoding = THREE.sRGBEncoding;
    this.scene_.background = texture;

// Ceiling Light Setup with RectAreaLight (for broader ceiling lighting)
const xOffset = -3; // Horizontal offset to position the light across the X-axis
const yOffset = 3;  // Additional vertical offset to position it near the ceiling
const zOffset = -4; // Offset to move the light along the Z-axis

// Point Light Setup
const pointLight = new THREE.PointLight(0xffffff, 3, 50);
pointLight.position.set(xOffset, 1 + yOffset, zOffset);
this.scene_.add(pointLight);
const pointLightHelper = new THREE.PointLightHelper(pointLight, 0.5);
this.scene_.add(pointLightHelper);


// Define specific offsets to adjust RectAreaLight positions independently for each window
// Define specific offsets to adjust RectAreaLight positions independently for each window
    // Load the door model with animations
  // Load the door model with animations
  // Load the door model with animations
 // Load the door model with animations
// Load the door model with animations
// Load the door model with animations
// Load the door model with animations
const loader2 = new GLTFLoader();
loader2.load('resources/GreyDoor.glb', (gltf) => {
  const model = gltf.scene;

  model.scale.set(4, 1.9, 2); // Adjust values as needed for your scale
  model.position.set(5.5, -.2, -5.9); // Adjust values as needed for your scale
  this.scene_.add(model);


    // Add each child mesh of the door to the octree for collision detection
  model.traverse((child) => {
    if (child.isMesh) {
      this.octree.fromGraphNode(child);
    }
  });


// Create a bounding box and compute its size
const boundingBox = new THREE.Box3().setFromObject(model);
const doorSize = new THREE.Vector3();
boundingBox.getSize(doorSize);

console.log("Door dimensions (width x height x depth):", doorSize.x, doorSize.y, doorSize.z);
  // Set up Animation Mixer and locate handle
  this.mixer = new THREE.AnimationMixer(model);
  const handle = model.getObjectByName('handle');
  const wiggleAnimationIndex = 3;

  if (gltf.animations[wiggleAnimationIndex]) {
    const wiggleAction = this.mixer.clipAction(gltf.animations[wiggleAnimationIndex]);
    wiggleAction.loop = THREE.LoopOnce;
    this.fpsCamera_.initializeHandleWiggle(handle, wiggleAction);
  } else {
    console.error("Wiggle animation not found.");
  }

  // Add the handle to sceneObjects for raycasting
  if (handle) {
    this.sceneObjects.push(handle);  // Ensures handle is part of raycasting checks
    console.log("Handle added to sceneObjects for detection.");
  }
});


const mapLoader = new THREE.TextureLoader();
const maxAnisotropy = this.threejs_.capabilities.getMaxAnisotropy();



// Ambient and Hemisphere Lighting

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
this.scene_.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x555555, 0.3);
this.scene_.add(hemiLight);





    this.sceneObjects = [];

    const meshes = [
      ];
    this.objects_ = [];

    // You can still create bounding boxes if needed, but don't pass them to raycasting
    const boundingBoxes = meshes.map(mesh => {
      const b = new THREE.Box3();
      b.setFromObject(mesh);
      return b;
      });

      // Crosshair
      const crosshair = mapLoader.load('resources/ui/crosshair.png');
      crosshair.anisotropy = maxAnisotropy;
  
      this.sprite_ = new THREE.Sprite(
        new THREE.SpriteMaterial({map: crosshair, color: 0xffffff, fog: false, depthTest: false, depthWrite: false}));
      this.sprite_.scale.set(0.15, 0.15 * this.camera_.aspect, 1)
      this.sprite_.position.set(0, 0, -10);
  
      this.uiScene_.add(this.sprite_);

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



 


  createSecondaryScenes_() {
    this.sharedScene = new THREE.Scene();
    this.sharedScene.background = this.skyboxTexture;

    this.secondaryCameras = [];
    this.renderTargets = [];
    const cameraSettings = { fov: 45, aspect: 1, near: 0.1, far: 500 };

    // Set up secondary cameras and render targets for each screen
    for (let i = 0; i < 6; i++) {
        const camera = new THREE.PerspectiveCamera(cameraSettings.fov, cameraSettings.aspect, cameraSettings.near, cameraSettings.far);
        camera.position.set(0, 5, 10 * (i + 1));
        camera.lookAt(0, 0, 0);

        const renderTarget = new THREE.WebGLRenderTarget(256, 256);
        renderTarget.texture.minFilter = THREE.LinearFilter;
        renderTarget.texture.generateMipmaps = false;
        renderTarget.texture.encoding = THREE.sRGBEncoding;

        this.secondaryCameras.push(camera);
        this.renderTargets.push(renderTarget);
    }

    // Add floor and ambient light to the shared scene
    const mapLoader = new THREE.TextureLoader();
    const floorTexture = mapLoader.load('resources/concrete_floor_worn_001_rough_2k.jpg');
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(5, 5);
    const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.sharedScene.add(floor);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.sharedScene.add(ambientLight);
    const loader = new GLTFLoader();
    loader.load('resources/monmon33.glb', (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          console.log("Object:", child.name);  // This will log all object names within the model
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
                // Attempt to find the screen within each monitor
                const screen = monitor.getObjectByName(screenNames[i]);
                if (screen) {
                    // Apply the render target to the screen
                    this.renderTargets[i].texture.flipY = false;
                    screen.material = new THREE.MeshBasicMaterial({
                        map: this.renderTargets[i].texture,
                        side: THREE.DoubleSide,
                    });
                    console.log(`Applied render target to ${screenNames[i]} on ${monitorName}`);
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
      if (child.isMesh && (child.name.includes("wall") || child.name.includes("window"))) {
        this.octree.fromGraphNode(child);
          child.material.depthTest = true;

          child.castShadow = true;
          child.receiveShadow = true;
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



      
      this.step_(t - this.previousRAF_);
      this.stats.begin(); 
      this.threejs_.autoClear = true;
    // Animate the directional light in the sharedScene
    const time = new Date().getTime();
    this.sharedSceneDirectionalLight.position.x = Math.cos(time * 0.002) * 10;
    this.sharedSceneDirectionalLight.position.z = Math.sin(time * 0.002) * 10;

    // Render the secondary cameras
    this.secondaryCameras.forEach((camera, i) => {
      this.threejs_.setRenderTarget(this.renderTargets[i]);
      this.threejs_.render(this.sharedScene, camera);
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
    this.fpsCamera_.update(timeElapsedS);
      // Update the mixer for animations
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
