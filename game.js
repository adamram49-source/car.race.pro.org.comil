// ===== בסיס =====
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(50, 100, 50);
scene.add(sun);

// ===== שלבים עם רקעים שונים =====
const stageBackgrounds = [0x87ceeb, 0xffcc99, 0x99ccff, 0xff9999, 0x88ff88];
let stageIndex = 0;

let trackCurve, walls = [], finishZ;

// ===== AI =====
let aiCars = [];
const AI_COUNT = 5; // מספיק כדי להתחרות אבל אפשר לנצח

// ===== יצירת שלב עם פיצולים ברורים =====
function createStage() {
  // רקע שונה לכל שלב
  scene.background = new THREE.Color(stageBackgrounds[stageIndex % stageBackgrounds.length]);

  // מחיקת קירות ורכבי AI ישנים
  walls.forEach(w => scene.remove(w));
  walls = [];
  aiCars.forEach(ai => scene.remove(ai.mesh));
  aiCars = [];

  // יצירת מסלול בסיסי ארוך
  const points = [];
  let z = 0;
  let x = 0;
  const segments = 16 + stageIndex * 2; // כל שלב ארוך יותר

  for (let i = 0; i < segments; i++) {
    // פניות רנדומליות אך ברורות
    if (i % 4 === 0 && i < segments - 4) {
      // פיצול ברור: לפעמים שני קווים לצדדים
      if (Math.random() < 0.5) {
        points.push(new THREE.Vector3(x + 20, 0, z - 15));
        points.push(new THREE.Vector3(x - 20, 0, z - 15));
      }
    }
    x += (Math.random() - 0.5) * 20;
    z -= 20 + Math.random() * 20;
    points.push(new THREE.Vector3(x, 0, z));
  }

  trackCurve = new THREE.CatmullRomCurve3(points);

  // קירות מסלול קשיחים
  for (let i = 0; i < 200; i++) {
    const t = i / 200;
    const p = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    [-1, 1].forEach(side => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(1, 5, 8),
        new THREE.MeshStandardMaterial({ color: 0x0077ff })
      );
      wall.position.copy(p).add(normal.clone().multiplyScalar(side * 7));
      scene.add(wall);
      walls.push(wall);
    });
  }

  finishZ = points[points.length - 1].z;

  // יצירת רכבי AI
  for (let i = 0; i < AI_COUNT; i++) {
    const ai = new THREE.Mesh(
      new THREE.BoxGeometry(2, 1, 4),
      new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff })
    );
    scene.add(ai);
    aiCars.push({
      mesh: ai,
      progress: 0,
      speed: 0.001 + Math.random() * 0.001, // איטיים מהשחקן
      branch: null
    });
  }

  resetCars();
}

// ===== רכבים =====
const player = new THREE.Mesh(
  new THREE.BoxGeometry(2, 1, 4),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
scene.add(player);

let playerSpeed = 0.004; // מהיר יותר מה-AI

// ===== שליטה =====
const keys = {};
addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// ===== איפוס =====
function resetCars() {
  player.position.set(0, 1, 0);
  player.rotation.set(0, 0, 0);
  playerSpeed = 0.004;
  aiCars.forEach(ai => ai.progress = 0);
}

// ===== תנועה שחקן =====
function movePlayer() {
  let speed = playerSpeed;
  if (keys["w"]) speed *= 1.2;
  if (keys["s"]) speed *= 0.8;

  if (keys["a"]) player.rotation.y += 0.04;
  if (keys["d"]) player.rotation.y -= 0.04;

  player.position.x -= Math.sin(player.rotation.y) * speed;
  player.position.z -= Math.cos(player.rotation.y) * speed;

  // קירות קשיחים – אי אפשר לצאת מהמפה
  walls.forEach(w => {
    const dist = player.position.distanceTo(w.position);
    if (dist < 2.5) {
      const push = player.position.clone().sub(w.position).normalize();
      player.position.add(push.multiplyScalar(0.5));
    }
  });
}

// ===== תנועה AI =====
function moveAI() {
  aiCars.forEach(ai => {
    // AI בוחר לפעמים מסלול צדדי
    if (Math.random() < 0.005) ai.branch = (Math.random() < 0.5) ? -1 : 1;
    ai.progress += ai.speed;
    const p = trackCurve.getPointAt(Math.min(ai.progress,1));
    const t = trackCurve.getTangentAt(Math.min(ai.progress,1));
    let offset = 0;
    if (ai.branch) offset = ai.branch * 2; // סטייה לצד

    ai.mesh.position.set(p.x + offset, 1, p.z);
    ai.mesh.rotation.y = Math.atan2(-t.x, -t.z);
  });
}

// ===== בדיקת ניצחון =====
function checkFinish() {
  if (player.position.z < finishZ) {
    const aiWon = aiCars.some(ai => ai.progress >= 1);
    if (!aiWon) {
      stageIndex++;
      createStage(); // ניצחת → שלב הבא
    } else {
      resetCars();  // הפסדת → אותו שלב
    }
  }

  aiCars.forEach(ai => {
    if (ai.progress >= 1) resetCars();
  });
}

// ===== מצלמה =====
function updateCamera() {
  const offset = new THREE.Vector3(0, 12, 18);
  const camPos = offset.applyMatrix4(player.matrixWorld);
  camera.position.lerp(camPos, 0.1);
  camera.lookAt(player.position);
}

// ===== לולאה =====
createStage();
function animate() {
  requestAnimationFrame(animate);
  movePlayer();
  moveAI();
  checkFinish();
  updateCamera();
  renderer.render(scene, camera);
}
animate();

// ===== Resize =====
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
