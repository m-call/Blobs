const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

socket.on('connect', () => {
  console.log('Connected to server as', socket.id);
});

const player = {
  x: 400,
  y: 300,
  radius: 30,
  color: 'blue',
  speed: 3
};

const foods = [
  { x: 200, y: 150, radius: 10, color: 'green' },
  { x: 600, y: 400, radius: 10, color: 'red' },
  { x: 350, y: 500, radius: 10, color: 'yellow' }
];

let mouse = { x: player.x, y: player.y };

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

function movePlayerTowardMouse() {
  const dx = mouse.x - player.x;
  const dy = mouse.y - player.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > 1) {
    player.x += (dx / dist) * player.speed;
    player.y += (dy / dist) * player.speed;
  }
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
      player.radius += 2; // Grow player
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

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  movePlayerTowardMouse();
  checkEatFood();

  foods.forEach(drawBlob);
  
  drawBlob(player);

  requestAnimationFrame(draw);
}

draw();