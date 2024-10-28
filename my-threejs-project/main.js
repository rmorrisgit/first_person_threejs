import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import Stats from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/stats.module.js';
import { EXRLoader } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/loaders/EXRLoader.js';
import { DecalGeometry } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/geometries/DecalGeometry.js';
import { Octree } from 'three/examples/jsm/math/Octree';
import { OctreeHelper } from 'three/examples/jsm/helpers/OctreeHelper.js';
import { Capsule } from 'three/examples/jsm/math/Capsule';

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
  this.moveSpeed_ = 20; // Adjust this value for movement speed
  this.lookSpeed_ = 5;  // Adjust this value for look speed
  this.headBobActive_ = false;
  this.headBobTimer_ = 0;
  this.headBobSpeed_ = 12;
  this.headBobHeight_ = .13;

  this.charge = 1;      // Full charge starts at 1
  this.chargeDecreaseRate = 0.1; 
  this.rechargeRate = 0.05; // Rate at which the charge recovers
  this.chargeRecoverDelay = 2; // Delay before charge starts recovering after sprinting
  this.lastSprintedAt = null; // Store the last time the player sprinted
  this.isSprinting = false; // State for sprinting
  this.sprintTimeout = false; // Sprint timeout state
  this.timeoutDuration = 5; // Timeout duration in seconds
  this.lastChargeDepletedAt = null; // Timestamp when charge reaches 0
  // Jumping variables
  this.isJumping = false; // State to track if the player is jumping
  this.velocity = new THREE.Vector3(0, 0, 0); // 3D vector for velocity
  this.gravity = -64; // Gravity constant
  this.verticalVelocity = 0; // Current vertical speed
  this.jumpHeight = 6; // Max height of the jump
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

    // You can access the player's position like this:
    // const playerPosition = this.player_.getPosition();
    // console.log("Player Position: ", playerPosition);

    this.addDecal_();        // Check and add decals on mouse click
    this.input_.update(timeElapsedS);
  }

  addDecal_() {
    if (this.input_.current_.leftButton && !this.input_.previous_.leftButton) {  // On mouse click
      const raycaster = new THREE.Raycaster();
      const pos = {x:0, y:0};
  
      raycaster.setFromCamera(pos, this.camera_);
      const hits = raycaster.intersectObjects(this.sceneObjects);
  
      console.log("Scene objects: ", this.sceneObjects);  // Debug: Check scene objects
      console.log("Intersects: ", hits);  // Debug: Check raycast intersections
  
      if (!hits.length) {
        return;
      }
      
        const decalPosition = hits[0].point.clone();
        const eye = decalPosition.clone();
        eye.add(hits[0].face.normal)
        console.log("Decal Position: ", decalPosition);
        console.log("Decal Normal: ", eye);

        const rotation = new THREE.Matrix4();
        rotation.lookAt(eye, decalPosition, THREE.Object3D.DefaultUp);
        const euler = new THREE.Euler();
        euler.setFromRotationMatrix(rotation);
  
        const decalSize = new THREE.Vector3(1, 1, 1);  // Try a smaller size
        const decalGeometry = new DecalGeometry(
                    hits[0].object, hits[0].point, euler, decalSize);
        const decalMaterial = new THREE.MeshStandardMaterial({
          color: 0xFFFFFF,  // Simple white decal
          depthTest: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -5
        });
  
        const decalMesh = new THREE.Mesh(decalGeometry, decalMaterial);
        decalMesh.receiveShadow = true;
        this.scene_.add(decalMesh);
              // Debug with a test object
      const testBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({color: 0xFFff00}));
      testBox.position.copy(decalPosition);  // Position the test object where the decal should be
      this.scene_.add(testBox);
      }
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
 const canSprint = this.charge > 0 && this.input_.key(KEYS.shift) && !this.isJumping;
 const isSprinting = canSprint;

 // Adjust current movement speed based on sprinting
 const currentMoveSpeed = isSprinting ? this.moveSpeed_ * 2 : this.moveSpeed_;
 const strafeSpeed = isSprinting ? currentMoveSpeed * 0.8 : currentMoveSpeed * 0.8;  // Strafe speed for both cases
 // Manage sprint charge
 if (isSprinting) {
     this.charge = clamp(this.charge - this.chargeDecreaseRate * timeElapsedS, 0, 1);
     this.updateChargeUI(this.charge);
 } else {
     // Recover charge when not sprinting
     this.charge = clamp(this.charge + (this.rechargeRate * timeElapsedS), 0, 1);
     this.updateChargeUI(this.charge);
 }
 this.isSprinting = isSprinting; // Track sprinting state
 
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

 // Handle movement and head bobbing

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
updateChargeUI(charge) {
  const chargeDisplay = document.getElementById('charge-bar');
  const chargeText = document.getElementById('charge-text');
  
  if (chargeDisplay) {
    // Clamp the charge value between 0 and 1
    charge = Math.max(0, Math.min(1, charge));
    chargeDisplay.style.width = `${charge * 100}%`; // Corrected with backticks
    chargeText.textContent = `${Math.round(charge * 100)}%`; // Corrected with backticks
  }
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

    this.initializeLights_();
    this.initializeScene_();

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
  
  initializeRenderer_() {
    this.threejs_ = new THREE.WebGLRenderer({
      antialias: false,
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

  initializeLights_() {
    const distance = 50.0;
    const angle = Math.PI / 4.0;
    const penumbra = 0.5;
    const decay = 1.0;

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
       // Octree must be initialized before adding objects to it
       if (!this.octree) {
        console.error("Octree is not initialized!");
        return;
      }
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
    // const checkerboard = mapLoader.load('resources/checkerboard.png');
    // checkerboard.anisotropy = maxAnisotropy;
    // checkerboard.wrapS = THREE.RepeatWrapping;
    // checkerboard.wrapT = THREE.RepeatWrapping;
    // checkerboard.repeat.set(32, 32);
    // checkerboard.encoding = THREE.sRGBEncoding;

    // const plane = new THREE.Mesh(
    //     new THREE.PlaneGeometry(100, 100, 10, 10),
    //     new THREE.MeshStandardMaterial({map: checkerboard}));
    // plane.castShadow = false;
    // plane.receiveShadow = true;
    // plane.rotation.x = -Math.PI / 2;
    // this.scene_.add(plane);

      // Load the textures
      // Load the textures
      // Load the textures
      // Load the textures
      const diffuseMap = mapLoader.load('resources/asphalt_01_diff_2k.jpg');
      const displacementMap = mapLoader.load('resources/asphalt_01_disp_2k.png');

      // Load the .exr files for the normal and roughness maps
      const normalMap = new EXRLoader().load('resources/asphalt_01_nor_gl_2k.exr');
      const roughnessMap = new EXRLoader().load('resources/asphalt_01_rough_2k.exr');

      // Set texture properties (like wrapping for large surfaces)
      diffuseMap.wrapS = THREE.RepeatWrapping;
      diffuseMap.wrapT = THREE.RepeatWrapping;
      normalMap.wrapS = THREE.RepeatWrapping;
      normalMap.wrapT = THREE.RepeatWrapping;
      roughnessMap.wrapS = THREE.RepeatWrapping;
      roughnessMap.wrapT = THREE.RepeatWrapping;
      displacementMap.wrapS = THREE.RepeatWrapping;
      displacementMap.wrapT = THREE.RepeatWrapping;

      // Adjust the repeat settings to control tiling (change these based on your visual needs)
      diffuseMap.repeat.set(8, 8);  // Adjust tiling if necessary
      normalMap.repeat.set(8, 8); 
      roughnessMap.repeat.set(8, 8); 
      displacementMap.repeat.set(8, 8); 

      // Create the material using the loaded textures
      const asphaltMaterial = new THREE.MeshStandardMaterial({
        map: diffuseMap,               // Diffuse map for base color
        normalMap: normalMap,           // EXR normal map for surface details
        roughnessMap: roughnessMap,     // EXR roughness map for reflections
        displacementMap: displacementMap,  // Displacement map for geometry depth
        displacementScale: 0.05         // Adjust based on the depth you want
      });

      // Apply the material to a plane geometry
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100, 100, 100),  // More segments for displacement
        asphaltMaterial
      );

      // Set shadow and position properties
      plane.castShadow = false;
      plane.receiveShadow = true;
      plane.rotation.x = -Math.PI / 2;

      this.scene_.add(plane);

      // Add plane to octree
      this.octree.fromGraphNode(plane);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 4),
      this.loadMaterial_('vintage-tile1_', 0.2));
    box.position.set(10, 2, 0);
    box.castShadow = true;
    box.receiveShadow = true;
    this.scene_.add(box);
  // Add box to octree
  this.octree.fromGraphNode(box);
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

        // Create a ramp with a tilted plane
        const rampMaterial = new THREE.MeshStandardMaterial({
          color: 0x808080, // Simple gray material
          roughness: 0.8,
          metalness: 0.2,
      });
    const rampGeometry = new THREE.PlaneGeometry(10, 20); // A long ramp
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.rotation.x = -Math.PI / 6; // Tilt the ramp at 30 degrees
    ramp.position.set(0, 2, 10); // Adjust the position of the ramp




    ramp.castShadow = true;
    ramp.receiveShadow = true;
    this.scene_.add(ramp);

    // Add the ramp to the octree for collision detection
    this.octree.fromGraphNode(ramp);





    // Create Box3 for each mesh in the scene so that we can
    // do some easy intersection tests.
    const meshes = [
      plane, box, wall1, wall2, wall3, wall4];
  
    this.objects_ = [];
    this.octree.fromGraphNode(wall1);
    this.octree.fromGraphNode(wall2);
    this.octree.fromGraphNode(wall3);
    this.octree.fromGraphNode(wall4);
    const octreeHelper = new OctreeHelper(this.octree);
    this.scene_.add(octreeHelper);
    // You can still create bounding boxes if needed, but don't pass them to raycasting
    const boundingBoxes = meshes.map(mesh => {
    const b = new THREE.Box3();
    b.setFromObject(mesh);
    return b;
    });

    this.sceneObjects = [plane, box, wall1, wall2, wall3, wall4];

    this.sceneObjects.push(ramp);

    // Crosshair
    const crosshair = mapLoader.load('resources/crosshair.png');
    crosshair.anisotropy = maxAnisotropy;

    this.sprite_ = new THREE.Sprite(
      new THREE.SpriteMaterial({map: crosshair, color: 0xffffff, fog: false, depthTest: false, depthWrite: false}));
    this.sprite_.scale.set(0.15, 0.15 * this.camera_.aspect, 1)
    this.sprite_.position.set(0, 0, -10);

    this.uiScene_.add(this.sprite_);
  }



  raf_() {
    requestAnimationFrame((t) => {
      if (this.previousRAF_ === null) {
        this.previousRAF_ = t;
      }

      this.step_(t - this.previousRAF_);
      this.stats.begin(); 
      this.threejs_.autoClear = true;
      this.threejs_.render(this.scene_, this.camera_);
      
      this.threejs_.autoClear = false;
      this.threejs_.render(this.uiScene_, this.uiCamera_);
            this.stats.end(); // Stop measuring
      this.previousRAF_ = t;
         this.raf_();
    });
  }

  step_(timeElapsed) {
    const timeElapsedS = timeElapsed * 0.001;

    // this.controls_.update(timeElapsedS);
    this.fpsCamera_.update(timeElapsedS);
  }
}


let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new FirstPersonCameraDemo();
});