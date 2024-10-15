import * as THREE from 'https://cdn.skypack.dev/three@0.136';
import Stats from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/stats.module.js';


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


  // Add click event to request pointer lock
  document.body.addEventListener('click', () => {
    document.body.requestPointerLock();
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

    document.addEventListener('pointerlockchange', () => this.onPointerLockChange_(), false);
    this.target_.addEventListener('mousedown', (e) => this.onMouseDown_(e), false);
    this.target_.addEventListener('mousemove', (e) => this.onMouseMove_(e), false);
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
      // Add mouse move listener only when pointer is locked
      document.addEventListener('mousemove', (e) => this.onMouseMove_(e), false);
    } else {
      console.log("Pointer Lock disabled");
      this.isPointerLocked = false; // Set state to false
      showInstructions(); // Call your function to show instructions
      // Remove mouse move listener when pointer is not locked
      document.removeEventListener('mousemove', (e) => this.onMouseMove_(e), false);
    }}

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
    this.moveSpeed_ = 12; // Adjust this value for movement speed
    this.lookSpeed_ = 5;  // Adjust this value for look speed
  
    this.charge = 1;      // Full charge starts at 1
    this.chargeDecreaseRate = 0.1; 
    this.headBobActive_ = false;
    this.headBobTimer_ = 0;
    this.headBobSpeed_ = 10;
    this.headBobHeight_ = .1;
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
  this.groundLevel = 2; 
     // Audio listener setup
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
 if (!this.isJumping && this.translation_.y <= this.groundLevel && this.input_.key(32)) {
     // Only jump if grounded
     this.isJumping = true;
     const sprintFactor = isSprinting ? 1.7 : 1; // Jump higher if sprinting
     this.jumpVelocity = Math.sqrt(2 * -this.gravity * this.jumpHeight) * sprintFactor;
     console.log("Jump initiated. Jump velocity:", this.jumpVelocity); // Debug log
 }

 // Handle movement and head bobbing
 this.isMoving = forwardVelocity || strafeVelocity; // Moving if any velocity
 if (this.isMoving) {
     this.headBobActive_ = true; //     qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);
     const qx = new THREE.Quaternion();
     qx.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.phi_);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(qx);
    forward.multiplyScalar(forwardVelocity * timeElapsedS * currentMoveSpeed); // Use currentMoveSpeed here

    const left = new THREE.Vector3(-1, 0, 0);
    left.applyQuaternion(qx);
    left.multiplyScalar(strafeVelocity * timeElapsedS * currentMoveSpeed); // Use currentMoveSpeed here

    this.translation_.add(forward);
    this.translation_.add(left);


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
  }

  initialize_() {
    this.initializeLights_();
    this.initializeScene_();
    this.initializeDemo_();
    this.initStats();
 
    this.previousRAF_ = null;
    this.raf_();
    this.onWindowResize_();
    this.inputController = new InputController(document.body);

  }

  initializeDemo_() {
   

    this.fpsCamera_ = new FirstPersonCamera(this.camera_, this.objects_);
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

    // Create Box3 for each mesh in the scene so that we can
    // do some easy intersection tests.
    const meshes = [
      plane, box, wall1, wall2, wall3, wall4];

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
      new THREE.SpriteMaterial({map: crosshair, color: 0xffffff, fog: false, depthTest: false, depthWrite: false}));
    this.sprite_.scale.set(0.15, 0.15 * this.camera_.aspect, 1)
    this.sprite_.position.set(0, 0, -10);

    this.uiScene_.add(this.sprite_);
  }

 

  onWindowResize_() {
    this.camera_.aspect = window.innerWidth / window.innerHeight;
    this.camera_.updateProjectionMatrix();

    this.uiCamera_.left = -this.camera_.aspect;
    this.uiCamera_.right = this.camera_.aspect;
    this.uiCamera_.updateProjectionMatrix();

    this.threejs_.setSize(window.innerWidth, window.innerHeight);
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