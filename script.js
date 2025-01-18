const container = document.getElementById("three-container");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
container.appendChild(renderer.domElement);

// Create tile-like grid texture
function createTileTexture() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 512;
  canvas.height = 512;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  for (let i = 0; i <= canvas.width; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  return texture;
}

const tileTexture = createTileTexture();

// Create rectangular box for skybox
const geometry = new THREE.BoxGeometry(20, 10, 20);
const material = new THREE.MeshBasicMaterial({
  map: tileTexture,
  side: THREE.BackSide,
});
const skybox = new THREE.Mesh(geometry, material);
scene.add(skybox);

// Drawing texture setup
let textureCanvas = document.createElement('canvas');
textureCanvas.width = 1024;
textureCanvas.height = 1024;
let textureContext = textureCanvas.getContext('2d');
textureContext.fillStyle = 'white';
textureContext.strokeStyle = '#ffffff';
textureContext.lineWidth = 2;
let modelTexture = new THREE.CanvasTexture(textureCanvas);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Variables for model interaction
let model = null;
const initialCameraDistance = camera.position.z;
const zoomRange = {
  min: initialCameraDistance * 0.08,
  max: initialCameraDistance
};
let isMouseDown = false;
let lastMouseX = 0;
let currentTool = 'pencil';
let isDrawing = false;
let lastTouchDistance = null;

// Load GLTF Model
const loader = new THREE.GLTFLoader();
loader.load(
  "https://cdn.glitch.global/ccd41c2b-7f9e-4723-ac27-7a815914ad6d/t-shirt_polo_lengan_panjang.glb?v=1733598419760",
  (gltf) => {
    model = gltf.scene;

    // Calculate bounding box
    const boundingBox = new THREE.Box3().setFromObject(model);
    const size = boundingBox.getSize(new THREE.Vector3());
    const center = boundingBox.getCenter(new THREE.Vector3());

    // Scale model
    const maxDimension = Math.max(size.x, size.y, size.z);
    const scaleFactor = 10 / maxDimension;
    model.scale.set(scaleFactor, scaleFactor, scaleFactor);

    // Center model
    model.position.set(
      -center.x * scaleFactor,
      -center.y * scaleFactor,
      -center.z * scaleFactor
    );

    // Apply drawing texture to model
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: modelTexture
        });
      }
    });

    scene.add(model);
  }
);

// Drawing functions
function getTextureCoordinates(event) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const rect = renderer.domElement.getBoundingClientRect();
  
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  
  if (intersects.length > 0 && intersects[0].uv) {
    return {
      x: intersects[0].uv.x * textureCanvas.width,
      y: (1 - intersects[0].uv.y) * textureCanvas.height
    };
  }
  return null;
}

// Mouse and touch event handlers
function onMouseWheel(event) {
  const delta = event.deltaY * 0.01;
  camera.position.z = Math.min(
    Math.max(camera.position.z + delta, zoomRange.min),
    zoomRange.max
  );
}

function onTouchMove(event) {
  if (event.touches.length === 2) {
    // Pinch zoom logic
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const currentDistance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    if (lastTouchDistance) {
      const delta = (lastTouchDistance - currentDistance) * 0.01;
      camera.position.z = Math.min(
        Math.max(camera.position.z + delta, zoomRange.min),
        zoomRange.max
      );
    }

    lastTouchDistance = currentDistance;
  } else if (event.touches.length === 1 && model) {
    // Single touch handling
    const touch = event.touches[0];
    if (isDrawing) {
      // Handle drawing
      const coords = getTextureCoordinates(touch);
      if (!coords) return;

      switch (currentTool) {
        case 'pencil':
          textureContext.lineTo(coords.x, coords.y);
          textureContext.stroke();
          break;
        case 'eraser':
          textureContext.save();
          textureContext.globalCompositeOperation = 'destination-out';
          textureContext.beginPath();
          textureContext.arc(coords.x, coords.y, 10, 0, Math.PI * 2);
          textureContext.fill();
          textureContext.restore();
          break;
      }
      modelTexture.needsUpdate = true;
    } else {
      // Handle rotation
      const deltaX = touch.clientX - lastMouseX;
      model.rotation.y += deltaX * 0.01;
    }
    lastMouseX = touch.clientX;
  }
}

function onMouseDown(event) {
  isMouseDown = true;
  lastMouseX = event.clientX;

  const coords = getTextureCoordinates(event);
  if (!coords) return;
  
  isDrawing = true;
  textureContext.beginPath();
  textureContext.moveTo(coords.x, coords.y);
}

function onMouseMove(event) {
  if (!isMouseDown || !model) return;

  const deltaX = event.clientX - lastMouseX;
  
  if (isDrawing) {
    const coords = getTextureCoordinates(event);
    if (!coords) return;

    switch (currentTool) {
      case 'pencil':
        textureContext.lineTo(coords.x, coords.y);
        textureContext.stroke();
        break;
      case 'eraser':
        textureContext.save();
        textureContext.globalCompositeOperation = 'destination-out';
        textureContext.beginPath();
        textureContext.arc(coords.x, coords.y, 10, 0, Math.PI * 2);
        textureContext.fill();
        textureContext.restore();
        break;
    }
    
    modelTexture.needsUpdate = true;
  } else {
    // Rotate model
    model.rotation.y += deltaX * 0.01;
  }

  lastMouseX = event.clientX;
}

function onMouseUp() {
  isMouseDown = false;
  isDrawing = false;
}

function onTouchStart(event) {
  if (event.touches.length === 1) {
    lastMouseX = event.touches[0].clientX;
    const touch = event.touches[0];
    const coords = getTextureCoordinates(touch);
    if (coords) {
      isDrawing = true;
      textureContext.beginPath();
      textureContext.moveTo(coords.x, coords.y);
    }
  }
}

function onTouchEnd() {
  lastTouchDistance = null;
  isDrawing = false;
}

// Tool handling
document.querySelectorAll('.tool-button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    currentTool = button.id.replace('Tool', '');
  });
});

// Color picker
document.getElementById('colorPicker').addEventListener('input', (e) => {
  textureContext.strokeStyle = e.target.value;
});

// Clear button
document.getElementById('clearButton').addEventListener('click', () => {
  textureContext.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
  modelTexture.needsUpdate = true;
});

// Event listeners
container.addEventListener("wheel", onMouseWheel);
container.addEventListener("mousedown", onMouseDown);
container.addEventListener("mousemove", onMouseMove);
container.addEventListener("mouseup", onMouseUp);
container.addEventListener("mouseleave", onMouseUp);
container.addEventListener("touchstart", onTouchStart);
container.addEventListener("touchmove", onTouchMove);
container.addEventListener("touchend", onTouchEnd);

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});