
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

export default InputController;
