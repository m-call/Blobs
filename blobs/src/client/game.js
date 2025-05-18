const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

socket.on('connect', () => {
  console.log('Connected to server as', socket.id);
});

const WORLD_WIDTH = 15000;
const WORLD_HEIGHT = 15000;

// Replace the player object with an array of blobs
let players = [{
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  radius: 30,
  color: 'blue',
  speed: 3,
  splitTime: 0
}];

function randomFood() {
  return {
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    radius: 10,
    color: ['green', 'red', 'yellow', 'purple', 'orange'][Math.floor(Math.random() * 5)]
  };
}

// Spawn initial food
const FOOD_COUNT = 100;
const foods = [];
for (let i = 0; i < FOOD_COUNT; i++) {
  foods.push(randomFood());
}

// Update mouse event to store mouse position
let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
canvas.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Splitting logic
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    // Only allow splitting if total blobs will not exceed 16
    if (players.length * 2 > 16) return;

    let newBlobs = [];
    for (let blob of players) {
      if (blob.radius > 60) {
        // Split into two blobs of half radius
        let angle = Math.random() * Math.PI * 2;
        let offset = blob.radius;
        let r = blob.radius / 2;
        let now = Date.now();
        newBlobs.push({
          x: blob.x + Math.cos(angle) * offset,
          y: blob.y + Math.sin(angle) * offset,
          radius: r,
          color: blob.color,
          speed: 3,
          splitTime: now
        });
        newBlobs.push({
          x: blob.x - Math.cos(angle) * offset,
          y: blob.y - Math.sin(angle) * offset,
          radius: r,
          color: blob.color,
          speed: 3,
          splitTime: now
        });
      } else {
        newBlobs.push(blob); // Don't split if too small
      }
    }
    players = newBlobs;
  }
});

// Update movement logic for all blobs
function movePlayerTowardMouse() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  for (let blob of players) {
    const dx = mouse.x - centerX;
    const dy = mouse.y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    blob.speed = Math.max(1, 100 / blob.radius);
    if (dist > 1) {
      blob.x += (dx / dist) * blob.speed;
      blob.y += (dy / dist) * blob.speed;
      blob.x = Math.max(blob.radius, Math.min(WORLD_WIDTH - blob.radius, blob.x));
      blob.y = Math.max(blob.radius, Math.min(WORLD_HEIGHT - blob.radius, blob.y));
    }
  }
}

// Update eating logic for all blobs
function checkEatFood() {
  for (let blob of players) {
    for (let i = foods.length - 1; i >= 0; i--) {
      const food = foods[i];
      const dx = blob.x - food.x;
      const dy = blob.y - food.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < blob.radius + food.radius) {
        foods.splice(i, 1);
        blob.radius += 0.5;
        foods.push(randomFood());
      }
    }
  }
}

function resolveBlobCollisions() {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = a.radius + b.radius;
      if (dist < minDist && dist > 0) {
        // Calculate overlap
        const overlap = minDist - dist;
        // Push each blob away from the other by half the overlap
        const pushX = (dx / dist) * (overlap / 2);
        const pushY = (dy / dist) * (overlap / 2);
        a.x -= pushX;
        a.y -= pushY;
        b.x += pushX;
        b.y += pushY;
      }
    }
  }
}

function tryMergeBlobs() {
  const now = Date.now();
  // Sort blobs by radius (optional, helps with merging order)
  players.sort((a, b) => b.radius - a.radius);

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];

      // Only merge if both blobs are ready
      const mergeDelayA = Math.max(1000, a.radius * 500); // ms
      const mergeDelayB = Math.max(1000, b.radius * 500); // ms
      if (
        now - a.splitTime > mergeDelayA &&
        now - b.splitTime > mergeDelayB
      ) {
        // Check if blobs are close enough to merge (touching or overlapping)
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= a.radius + b.radius) {
          // Merge b into a
          a.radius += b.radius;
          a.splitTime = 0; // Reset splitTime after merging
          players.splice(j, 1);
          i = -1; // Restart outer loop since array changed
          break;
        }
      }
    }
  }
}

function drawBlob(blob) {
  ctx.beginPath();
  ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
  ctx.fillStyle = blob.color;
  ctx.fill();
  ctx.closePath();
}

function drawGrid(spacing = 50) {
  ctx.save();
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 1;

  // Vertical lines
  for (let x = 0; x <= WORLD_WIDTH; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD_HEIGHT);
    ctx.stroke();
  }

  // Horizontal lines
  for (let y = 0; y <= WORLD_HEIGHT; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }

  ctx.restore();
}

function getPlayerBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const blob of players) {
    minX = Math.min(minX, blob.x - blob.radius);
    minY = Math.min(minY, blob.y - blob.radius);
    maxX = Math.max(maxX, blob.x + blob.radius);
    maxY = Math.max(maxY, blob.y + blob.radius);
  }
  return { minX, minY, maxX, maxY };
}

// Update drawing logic for all blobs
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // --- Zoom logic ---
  const bounds = getPlayerBounds();
  const blobsWidth = bounds.maxX - bounds.minX;
  const blobsHeight = bounds.maxY - bounds.minY;
  const padding = 200; // Extra space around blobs

  // Calculate scale to fit all blobs in view
  const scaleX = canvas.width / (blobsWidth + padding);
  const scaleY = canvas.height / (blobsHeight + padding);
  const scale = Math.min(scaleX, scaleY, 1); // Never zoom in past 1x

  // Center on the average position of all blobs
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const offsetX = centerX - canvas.width / (2 * scale);
  const offsetY = centerY - canvas.height / (2 * scale);

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-offsetX, -offsetY);

  drawGrid(50);
  ctx.strokeStyle = '#ccc';
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  foods.forEach(drawBlob);
  players.forEach(drawBlob);

  // Draw score (sum of all blob radii)
  const totalScore = players.reduce((sum, b) => sum + b.radius, 0);
  ctx.font = `${24 / scale}px Arial`;
  ctx.fillStyle = "black";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`Score: ${Math.floor(totalScore)}`, offsetX + 20, offsetY + canvas.height / scale - 20);

  ctx.restore();

  movePlayerTowardMouse();
  checkEatFood();
  resolveBlobCollisions();
  tryMergeBlobs();

  const FOOD_COUNT = 15000;
  while (foods.length < FOOD_COUNT) {
    foods.push(randomFood());
  }

  requestAnimationFrame(draw);
}

draw();