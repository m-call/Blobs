const socket = io();
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

socket.on("connect", () => {
  console.log("Connected to server as", socket.id);
});

const WORLD_WIDTH = 15000;
const WORLD_HEIGHT = 15000;

let playerName = "";

window.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("nameOverlay");
  const input = document.getElementById("playerName");
  const btn = document.getElementById("startGameBtn");

  function startGame() {
    playerName = input.value.trim();
    overlay.style.display = "none";
    // Optionally: send playerName to server here
  }

  btn.addEventListener("click", startGame);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") startGame();
  });
});

// Replace the player object with an array of blobs
let players = [{
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  radius: 30,
  color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'), // random color
  speed: 3,
  splitTime: 0,
  splitRadius: 30,
  vx: 0,
  vy: 0,
  splitBoost: 0
}];

let score = 30;

function randomFood() {
  return {
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    radius: 10,
    color: ["green", "red", "yellow", "purple", "orange"][
      Math.floor(Math.random() * 5)
    ],
  };
}

// Spawn initial food
const FOOD_COUNT = 100;
const foods = [];
for (let i = 0; i < FOOD_COUNT; i++) {
  foods.push(randomFood());
}

// Spawn spikes
const SPIKE_COUNT = 30;
const SPIKE_RADIUS = 80; // Increased from 60 to 80
const spikes = [];
for (let i = 0; i < SPIKE_COUNT; i++) {
  spikes.push({
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    radius: SPIKE_RADIUS
  });
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

    // --- Duplicate zoom logic from draw() ---
    const bounds = getPlayerBounds();
    const blobsWidth = bounds.maxX - bounds.minX;
    const blobsHeight = bounds.maxY - bounds.minY;
    const padding = 200;
    const scaleX = canvas.width / (blobsWidth + padding);
    const scaleY = canvas.height / (blobsHeight + padding);
    const scale = Math.min(scaleX, scaleY, 1);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const offsetX = centerX - canvas.width / (2 * scale);
    const offsetY = centerY - canvas.height / (2 * scale);
    // ----------------------------------------

    let newBlobs = [];
    for (let blob of players) {
      if (blob.radius > 60) {
        // Calculate angle from blob to mouse in world coordinates
        const mouseWorldX = mouse.x / scale + offsetX;
        const mouseWorldY = mouse.y / scale + offsetY;
        const dx = mouseWorldX - blob.x;
        const dy = mouseWorldY - blob.y;
        const angle = Math.atan2(dy, dx);

        let offset = blob.radius;
        let r = blob.radius / 2;
        let now = Date.now();
        let boost = 100; // how far the split blob will travel
        let boostDuration = 80; // frames

        // Split one blob in the direction of the mouse (with velocity)
        newBlobs.push({
          x: blob.x + Math.cos(angle) * offset,
          y: blob.y + Math.sin(angle) * offset,
          radius: r,
          color: blob.color,
          speed: 3,
          splitTime: now,
          splitRadius: r,
          vx: Math.cos(angle) * boost,
          vy: Math.sin(angle) * boost,
          splitBoost: boostDuration
        });
        // The other stays in place
        newBlobs.push({
          x: blob.x,
          y: blob.y,
          radius: r,
          color: blob.color,
          speed: 3,
          splitTime: now,
          splitRadius: r,
          vx: 0,
          vy: 0,
          splitBoost: 0
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

  // --- Get camera and scale info from draw() ---
  const bounds = getPlayerBounds();
  const blobsWidth = bounds.maxX - bounds.minX;
  const blobsHeight = bounds.maxY - bounds.minY;
  const padding = 200;
  const scaleX = canvas.width / (blobsWidth + padding);
  const scaleY = canvas.height / (blobsHeight + padding);
  const scale = Math.min(scaleX, scaleY, 1);
  const camCenterX = (bounds.minX + bounds.maxX) / 2;
  const camCenterY = (bounds.minY + bounds.maxY) / 2;
  const offsetX = camCenterX - canvas.width / (2 * scale);
  const offsetY = camCenterY - canvas.height / (2 * scale);

  // Convert mouse position to world coordinates
  let mouseWorldX = mouse.x / scale + offsetX;
  let mouseWorldY = mouse.y / scale + offsetY;

  // If mouse is near the center, use the WORLD center as the target
  const mouseDist = Math.sqrt(
    Math.pow(mouse.x - centerX, 2) + Math.pow(mouse.y - centerY, 2)
  );
  let target;
  if (mouseDist < 10) {
    target = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
  } else {
    target = { x: mouseWorldX, y: mouseWorldY };
  }

  for (let blob of players) {
    if (blob.splitBoost && blob.splitBoost > 0) {
      blob.x += blob.vx;
      blob.y += blob.vy;
      blob.vx *= 0.75;
      blob.vy *= 0.75;
      blob.splitBoost--;
    } else {
      const dx = target.x - blob.x;
      const dy = target.y - blob.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (blob.radius > 100) {
        blob.speed = Math.max(0.8, 25 / blob.radius); // slower for big blobs
      } else {
        blob.speed = Math.max(2, 120 / blob.radius); // much faster for small blobs
      }

      if (dist > 1) {
        blob.x += (dx / dist) * blob.speed;
        blob.y += (dy / dist) * blob.speed;
      }
    }
    blob.x = Math.max(blob.radius, Math.min(WORLD_WIDTH - blob.radius, blob.x));
    blob.y = Math.max(blob.radius, Math.min(WORLD_HEIGHT - blob.radius, blob.y));
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
        blob.radius += 0.2; // or any value you want for growth
        score += 3;         // Increase score by 3
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
  players.sort((a, b) => b.radius - a.radius);

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];

      // Use splitRadius for merge delay
      const mergeDelayA = Math.max(1000, (a.splitRadius || a.radius) * 1000); // ms
      const mergeDelayB = Math.max(1000, (b.splitRadius || b.radius) * 1000); // ms
      if (
        now - a.splitTime > mergeDelayA &&
        now - b.splitTime > mergeDelayB
      ) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= a.radius + b.radius) {
          // Merge b into a
          a.radius += b.radius;
          a.splitTime = 0;
          a.splitRadius = a.radius;
          players.splice(j, 1);
          i = -1;
          break;
        }
      }
    }
  }
}

function checkSpikeCollision() {
  let newBlobs = [];
  for (let blob of players) {
    let hitSpike = false;
    for (let spike of spikes) {
      // Only blobs 10% larger than spike can be split
      if (blob.radius > spike.radius * 1.1) {
        const dx = blob.x - spike.x;
        const dy = blob.y - spike.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // If 65% of the blob's area overlaps the spike
        if (dist < (blob.radius - spike.radius * 0.65)) {
          hitSpike = true;
          break;
        }
      }
    }
    if (hitSpike) {
      // Split blob into smaller blobs (8 pieces)
      let pieces = 8;
      // Calculate new radius so total area is preserved
      let originalArea = Math.PI * blob.radius * blob.radius;
      let newRadius = Math.sqrt(originalArea / (pieces * Math.PI));
      let now = Date.now();
      for (let i = 0; i < pieces; i++) {
        // Random angle for each piece
        let angle = Math.random() * 2 * Math.PI;
        newBlobs.push({
          x: blob.x + Math.cos(angle) * newRadius * 2,
          y: blob.y + Math.sin(angle) * newRadius * 2,
          radius: newRadius,
          color: blob.color,
          speed: 3,
          splitTime: now,
          splitRadius: newRadius,
          vx: Math.cos(angle) * 30,
          vy: Math.sin(angle) * 30,
          splitBoost: 20
        });
      }
    } else {
      newBlobs.push(blob);
    }
  }
  players = newBlobs;
}

function drawBlob(blob) {
  ctx.beginPath();
  ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
  ctx.fillStyle = blob.color;
  ctx.fill();
  ctx.closePath();

  // Draw player name above the blob (only for your blobs)
  if (playerName) {
    ctx.save();
    ctx.font = `${Math.max(16, blob.radius / 1.5)}px Arial`;
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(playerName, blob.x, blob.y - blob.radius - 5);
    ctx.restore();
  }
}

function drawSpike(spike) {
  ctx.save();
  ctx.beginPath();
  const points = 18; // Number of spikes
  const innerRadius = spike.radius * 0.75;
  const outerRadius = spike.radius;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = spike.x + Math.cos(angle) * r;
    const y = spike.y + Math.sin(angle) * r;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = "green";
  ctx.shadowColor = "darkgreen";
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();
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

  // Draw all foods first
  foods.forEach(drawFood);

  // Draw all blobs that are NOT hiding under a spike (drawn below spikes)
  players.forEach(blob => {
    let hiding = false;
    for (let spike of spikes) {
      const dx = blob.x - spike.x;
      const dy = blob.y - spike.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (
        dist < spike.radius &&
        blob.radius < spike.radius
      ) {
        hiding = true;
        break;
      }
    }
    if (!hiding) {
      drawBlob(blob);
    }
  });

  // Draw all spikes (these will cover the hiding blobs)
  spikes.forEach(drawSpike);

  // Draw score (fixed, not based on radius)
  ctx.font = `${24 / scale}px Arial`;
  ctx.fillStyle = "black";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(`Score: ${score}`, offsetX + 20, offsetY + canvas.height / scale - 20);

  ctx.restore();

  movePlayerTowardMouse();
  checkEatFood();
  checkSpikeCollision();

  resolveBlobCollisions();
  tryMergeBlobs();

  const FOOD_COUNT = 30000;
  while (foods.length < FOOD_COUNT) {
    foods.push(randomFood());
  }

  requestAnimationFrame(draw);
}

draw();

function drawFood(food) {
  ctx.beginPath();
  ctx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
  ctx.fillStyle = food.color;
  ctx.fill();
  ctx.closePath();
}
