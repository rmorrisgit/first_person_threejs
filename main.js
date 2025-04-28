/*───────────────────────────────────────────────────────────────────────────
   Imports
───────────────────────────────────────────────────────────────────────────*/
import * as THREE from 'https://unpkg.com/three@0.136.0/build/three.module.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.136/examples/jsm/postprocessing/UnrealBloomPass.js';

/*───────────────────────────────────────────────────────────────────────────
   Scene Setup
───────────────────────────────────────────────────────────────────────────*/
const scene = new THREE.Scene();

// Only one ground plane
const groundMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(5000, 5000),
  groundMat
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);


const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 10, -10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.01, 0.4, 0));
/*───────────────────────────────────────────────────────────────────────────
   Textures
───────────────────────────────────────────────────────────────────────────*/
const loader = new THREE.CubeTextureLoader();
const texture = loader.load([
  'resources/skybox/space-posx.jpg', 'resources/skybox/space-negx.jpg',
  'resources/skybox/space-posy.jpg', 'resources/skybox/space-negy.jpg',
  'resources/skybox/space-posz.jpg', 'resources/skybox/space-negz.jpg'
], () => {
  texture.encoding = THREE.sRGBEncoding;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
});
scene.background = texture;

/*───────────────────────────────────────────────────────────────────────────
   Player
───────────────────────────────────────────────────────────────────────────*/
const capsuleMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const capsule = new THREE.Group();
capsule.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 16), capsuleMat));
const top = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), capsuleMat);
const bot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), capsuleMat);
top.position.y = 0.5; bot.position.y = -0.5;
capsule.add(top); capsule.add(bot);
capsule.position.y = 1;

scene.add(capsule);

const camTarget = new THREE.Group();
scene.add(camTarget);
camera.lookAt(camTarget.position.clone().setY(1));

/*───────────────────────────────────────────────────────────────────────────
   Lights
───────────────────────────────────────────────────────────────────────────*/
scene.add(new THREE.AmbientLight(0xffffff, 0.2));
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x887766, 0.8));

/*───────────────────────────────────────────────────────────────────────────
   Orbs
───────────────────────────────────────────────────────────────────────────*/
const orbGroup = new THREE.Group();
scene.add(orbGroup);
const orbBase = new THREE.MeshStandardMaterial({ emissive: 0x00ffff, emissiveIntensity: 1, color: 0x000000, roughness: 0.5, metalness: 0.3 });
[[10, 2, 10], [-10, 2, 10], [10, 2, -10], [-10, 2, -10], [0, 2, 15], [15, 2, 0], [-15, 2, 0], [0, 2, -15]].forEach(p => {
  const m = orbBase.clone();
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), m);
  orb.position.set(...p);
  const l = new THREE.PointLight(0x00ffff, 1, 5);
  l.decay = 2;
  l.position.copy(orb.position);
  scene.add(l);
  orb.userData.light = l;
  orbGroup.add(orb);
});

/*───────────────────────────────────────────────────────────────────────────
   Click-to-Move
───────────────────────────────────────────────────────────────────────────*/
const moveSpeed = 20;
let moveTarget = null, isDown = false;
const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
const markers = [], lastMouse = { x: 0, y: 0 };

addEventListener('mousemove', e => { lastMouse.x = e.clientX; lastMouse.y = e.clientY; });
addEventListener('mousedown', e => { isDown = true; hitGround(e, true); });
addEventListener('mouseup', () => { isDown = false; });
function hitGround(ev, spawn = false) {
  mouse.x = (ev.clientX / innerWidth) * 2 - 1;
  mouse.y = -(ev.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  
  const hit = raycaster.intersectObject(ground);
  if (!hit.length) return;  // ⬅ remember intersectObject returns an array!

  moveTarget = hit[0].point.clone();
  moveTarget.y = 1; // <<< 🔥 Force it to match capsule height (always y=1)

  if (spawn) {
    const mark = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false })
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.copy(hit[0].point).setY(0.0);
    mark.userData.life = 1;
    mark.renderOrder = 10;
    scene.add(mark);
    markers.push(mark);
  }
}
/*───────────────────────────────────────────────────────────────────────────
   Animate
───────────────────────────────────────────────────────────────────────────*/
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta(), t = clock.getElapsedTime();

  markers.forEach((m, i) => { m.userData.life -= dt; m.scale.multiplyScalar(0.98); m.material.opacity *= 0.96; if (m.userData.life <= 0) { scene.remove(m); markers.splice(i, 1); } });

  if (isDown) hitGround({ clientX: lastMouse.x, clientY: lastMouse.y });
  if (moveTarget) {
    const dir = moveTarget.clone().sub(capsule.position), dist = dir.length();
    if (dist > 0.1) {
      dir.normalize();
      const moveStep = moveSpeed * dt;
      if (moveStep > dist) {
        capsule.position.copy(moveTarget);
        moveTarget = null;
      } else {
        capsule.position.addScaledVector(dir, moveStep);
      }      capsule.rotation.y = Math.atan2(dir.x, dir.z);
    } else moveTarget = null;
  }


    camTarget.position.lerp(capsule.position, 0.1);
  
    const offset = new THREE.Vector3(0, 20, -20); // More height, further back
    camera.position.copy(camTarget.position.clone().add(offset)); // 📌 Camera placed every frame
  
    camera.lookAt(camTarget.position.clone().setY(1));

  orbGroup.children.forEach((o, i) => { o.position.y = 5 + Math.sin(t + i) * 3; o.userData.light.position.y = o.position.y; });
  
  
  composer.render();
}  
animate();

/*───────────────────────────────────────────────────────────────────────────
   Resize
───────────────────────────────────────────────────────────────────────────*/
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});