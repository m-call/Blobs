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

// Add a targetRadius property to the player
const player = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  radius: 30,
  targetRadius: 30, // New property for smooth transition
  color: "blue",
  speed: 3,
};

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

let mouse = { x: canvas.width / 2, y: canvas.height / 2 };

canvas.addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

function movePlayerTowardMouse() {
  // Calculate mouse position in world coordinates
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const dx = mouse.x - centerX;
  const dy = mouse.y - centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Speed decreases more sharply as player gets bigger
  player.speed = Math.max(1, 100 / player.radius);

  if (dist > 1) {
    player.x += (dx / dist) * player.speed;
    player.y += (dy / dist) * player.speed;
    // Clamp player to world bounds
    player.x = Math.max(
      player.radius,
      Math.min(WORLD_WIDTH - player.radius, player.x)
    );
    player.y = Math.max(
      player.radius,
      Math.min(WORLD_HEIGHT - player.radius, player.y)
    );
  }
}

// Smoothly interpolate the player's radius
function interpolatePlayerRadius() {
  const smoothingFactor = 0.1; // Adjust for smoother or faster transitions
  player.radius += (player.targetRadius - player.radius) * smoothingFactor;
}

function checkEatFood() {
  for (let i = foods.length - 1; i >= 0; i--) {
    const food = foods[i];
    const dx = player.x - food.x;
    const dy = player.y - food.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < player.radius + food.radius) {
      // Eat the food
      foods.splice(i, 1);
      player.targetRadius += 0.5; // Update targetRadius instead of radius
      // Spawn new food to keep the count up
      foods.push(randomFood());
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

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Calculate camera offset to keep player centered
  const offsetX = player.x - canvas.width / 2;
  const offsetY = player.y - canvas.height / 2;

  ctx.save();
  ctx.translate(-offsetX, -offsetY);

  // Draw grid
  drawGrid(50);

  // Draw world border
  ctx.strokeStyle = "#ccc";
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Draw foods
  foods.forEach(drawBlob);

  // Draw player
  drawBlob(player);

  ctx.restore();

  movePlayerTowardMouse();
  checkEatFood();
  interpolatePlayerRadius(); // Smoothly update the player's radius

  // --- Ensure food count stays high ---
  const FOOD_COUNT = 5000;
  while (foods.length < FOOD_COUNT) {
    foods.push(randomFood());
  }
  // ------------------------------------

  requestAnimationFrame(draw);
}

draw();
