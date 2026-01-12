const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Game Constants (Matched with Client)
const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;
const PLAYER_RADIUS = 25;
const POTATO_RADIUS = 20;
const POWERUP_RADIUS = 20;
const BASE_SPEED = 250;
const POTATO_SPEED = 230;
const SLIME_RADIUS = 80;
const MIN_OBSTACLE_GAP = 80; 

// Game State Storage
const rooms = {};

// --- Helper Functions ---
function generateObstacles() {
  const obstacles = [];
  const numObstacles = 15;
  let attempts = 0;

  while (obstacles.length < numObstacles && attempts < 1000) {
    attempts++;
    const w = Math.random() * 200 + 100;
    const h = Math.random() * 200 + 100;
    const ox = Math.random() * (CANVAS_WIDTH - w);
    const oy = Math.random() * (CANVAS_HEIGHT - h);

    if (Math.abs(ox - CANVAS_WIDTH/2) < 300 && Math.abs(oy - CANVAS_HEIGHT/2) < 300) continue;

    let tooClose = false;
    for (const obs of obstacles) {
        const overlapX = (ox < obs.x + obs.width + MIN_OBSTACLE_GAP) && (ox + w > obs.x - MIN_OBSTACLE_GAP);
        const overlapY = (oy < obs.y + obs.height + MIN_OBSTACLE_GAP) && (oy + h > obs.y - MIN_OBSTACLE_GAP);
        if (overlapX && overlapY) { tooClose = true; break; }
    }

    if (!tooClose) {
        obstacles.push({ id: `obs-${obstacles.length}`, x: ox, y: oy, width: w, height: h });
    }
  }
  return obstacles;
}

function checkCollision(circle, rect) {
  const testX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const testY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const distX = circle.x - testX;
  const distY = circle.y - testY;
  return (distX*distX + distY*distY) <= (circle.radius * circle.radius);
}

class GameRoom {
  constructor(roomId, hostId, initialPotatoSpeed, maxPlayers, isPrivate) {
    this.id = roomId;
    this.hostId = hostId;
    this.initialPotatoSpeed = initialPotatoSpeed || 1.0;
    this.maxPlayers = maxPlayers || 12;
    this.isPrivate = isPrivate || false;
    this.players = {};
    this.potatoes = [{
        position: { x: 100, y: 100 }, 
        velocity: { x: 0, y: 0 },
        radius: POTATO_RADIUS,
        speed: POTATO_SPEED * this.initialPotatoSpeed,
        targetId: null,
        isFrozen: false,
        freezeEndTime: 0,
        trail: []
    }];
    this.powerups = [];
    this.obstacles = generateObstacles();
    this.slimeAreas = []; // Stores active slime puddles
    this.state = 'WAITING'; 
    this.lastUpdate = Date.now();
    this.potatoSpeedMultiplier = 1.0;
  }

  addPlayer(socketId, name, color) {
    let pos = this.findSafeSpawn();

    this.players[socketId] = {
      id: socketId,
      name: name,
      color: color,
      isBot: false,
      position: pos,
      velocity: { x: 0, y: 0 },
      radius: PLAYER_RADIUS,
      speed: BASE_SPEED,
      isDead: false,
      score: 0,
      lives: 3, 
      ping: 0, 
      dashCooldown: 0,
      shieldCooldown: 0,
      smokeCooldown: 0,
      slimeCooldown: 0,
      isShielded: false,
      isHidden: false,
      isGhost: false,
      isSilenced: false,
      isSlowed: false,
      speedBoostEndTime: 0,
      input: { x: pos.x, y: pos.y } 
    };
  }
  
  updatePlayerPing(socketId, ping) {
      if (this.players[socketId]) {
          this.players[socketId].ping = ping;
      }
  }

  findSafeSpawn() {
      let safe = false;
      let px, py;
      let attempts = 0;
      while(!safe && attempts < 50) {
          attempts++;
          px = Math.random() * (CANVAS_WIDTH - 200) + 100;
          py = Math.random() * (CANVAS_HEIGHT - 200) + 100;
          safe = true;
          for(const obs of this.obstacles) {
             if (px > obs.x && px < obs.x+obs.width && py > obs.y && py < obs.y+obs.height) safe=false;
          }
      }
      return {x: px || 500, y: py || 500};
  }

  removePlayer(socketId) {
    delete this.players[socketId];
    if (socketId === this.hostId) {
        const remainingIds = Object.keys(this.players);
        if (remainingIds.length > 0) {
            this.hostId = remainingIds[0];
            return { empty: false, newHost: this.hostId };
        }
    }
    if (Object.keys(this.players).length === 0) {
      return { empty: true };
    }
    return { empty: false };
  }

  startGame() {
      this.state = 'PLAYING';
      this.lastUpdate = Date.now();
      Object.keys(this.players).forEach(id => {
          this.players[id].position = this.findSafeSpawn();
          this.players[id].lives = 3;
          this.players[id].isDead = false;
          this.players[id].score = 0;
          this.players[id].slimeCooldown = 0;
          this.players[id].isSilenced = false;
      });
      this.slimeAreas = [];
  }

  update() {
    if (this.state !== 'PLAYING') return;

    const now = Date.now();
    const dt = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // Remove expired Slime Areas
    this.slimeAreas = this.slimeAreas.filter(s => now < s.spawnTime + s.duration);

    // Update Players
    Object.values(this.players).forEach(p => {
        if (p.isDead) return;

        // Ability Cooldowns
        p.dashCooldown = Math.max(0, p.dashCooldown - dt * 1000);
        p.shieldCooldown = Math.max(0, p.shieldCooldown - dt * 1000);
        p.smokeCooldown = Math.max(0, p.smokeCooldown - dt * 1000);
        p.slimeCooldown = Math.max(0, p.slimeCooldown - dt * 1000);
        
        // Default Status
        p.isShielded = (p.shieldCooldown > 17000); // 20000 - 3000 duration
        p.isHidden = (p.smokeCooldown > 7000); // 12000 - 5000 duration
        
        let moveSpeed = p.speed;
        if (now > p.speedBoostEndTime) moveSpeed = BASE_SPEED;
        
        // --- Slime Area Interaction ---
        p.isSilenced = false;
        p.isSlowed = false;

        for (const slime of this.slimeAreas) {
            // Check if player is inside the slime
            const dist = Math.hypot(p.position.x - slime.x, p.position.y - slime.y);
            // Don't affect the owner? (Optional choice: currently affects everyone except maybe tiny grace period)
            // Let's make it affect EVERYONE for maximum chaos, or everyone except owner. 
            // The prompt says "yalnızca playerları etkileyecek". Let's exclude owner to prevent instant self-griefing.
            if (dist < slime.radius && p.id !== slime.ownerId) {
                // 1. Apply Slow (-25%)
                moveSpeed = moveSpeed * 0.75;
                p.isSlowed = true;
                
                // 2. Silence Skills
                p.isSilenced = true;

                // 3. Strip Buffs (Once per frame while inside, effectively prevents them)
                p.speedBoostEndTime = 0;
                p.isShielded = false; 
                p.shieldCooldown = Math.max(p.shieldCooldown, 1000); // Put on small cooldown so it cancels
                p.isHidden = false; 
                p.smokeCooldown = Math.max(p.smokeCooldown, 1000);
                p.isGhost = false;
            }
        }
        
        p.speed = moveSpeed;
        p.score += dt * 10;
        
        // Spawn potatoes based on score
        const expectedPotatoes = 1 + Math.floor(p.score / 500);
        if (this.potatoes.length < expectedPotatoes && this.potatoes.length < 10) {
            this.potatoes.push({
                position: { x: 50, y: 50 }, velocity: { x: 0, y: 0 }, radius: POTATO_RADIUS, speed: POTATO_SPEED * 1.1,
                targetId: null, isFrozen: false, freezeEndTime: 0, trail: []
            });
        }

        // Movement Logic
        const dx = p.input.x - p.position.x;
        const dy = p.input.y - p.position.y;
        
        const dist = Math.sqrt(dx*dx + dy*dy);
        const moveStep = p.speed * dt;

        let nextX = p.position.x;
        let nextY = p.position.y;

        // Fix jitter by adding deadzone
        if (dist < 5) {
             nextX = p.position.x;
             nextY = p.position.y;
        } else if (dist < moveStep) {
            nextX = p.position.x + dx;
            nextY = p.position.y + dy;
        } else {
            const angle = Math.atan2(dy, dx);
            const vx = Math.cos(angle) * moveStep;
            const vy = Math.sin(angle) * moveStep;
            nextX += vx;
            nextY += vy;
        }

        nextX = Math.max(p.radius, Math.min(CANVAS_WIDTH - p.radius, nextX));
        nextY = Math.max(p.radius, Math.min(CANVAS_HEIGHT - p.radius, nextY));

        let collided = false;
        if (!p.isGhost) {
            for (const obs of this.obstacles) {
                if (checkCollision({x: nextX, y: nextY, radius: p.radius}, obs)) {
                    collided = true;
                    break; 
                }
            }
        }

        if (!collided) {
            p.position.x = nextX;
            p.position.y = nextY;
        }
    });

    // Update Potatoes
    this.potatoes.forEach(potato => {
        if (potato.isFrozen && now > potato.freezeEndTime) potato.isFrozen = false;
        if (potato.isFrozen) return;

        let minDst = Infinity;
        let target = null;
        Object.values(this.players).forEach(p => {
            if (!p.isDead && !p.isHidden && !p.isGhost) {
                const d = Math.hypot(p.position.x - potato.position.x, p.position.y - potato.position.y);
                if (d < minDst) { minDst = d; target = p; }
            }
        });

        potato.targetId = target ? target.id : null;

        if (target) {
            const dx = target.position.x - potato.position.x;
            const dy = target.position.y - potato.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 1) {
                const currentSpeed = potato.speed * this.potatoSpeedMultiplier;
                potato.position.x += (dx / dist) * currentSpeed * dt;
                potato.position.y += (dy / dist) * currentSpeed * dt;
            }
        }
    });
    
    this.updatePowerups(now);
    this.checkCollisions(now);
  }

  updatePowerups(now) {
    if (Math.random() < 0.005 && this.powerups.length < 5) {
       const r = Math.random();
       let type = 'SPEED';
       if (r < 0.05) type = 'FREEZE';
       else if (r < 0.20) type = 'DOUBLE_POINTS';
       else if (r < 0.40) type = 'SPEED';
       else if (r < 0.60) type = 'COOLDOWN_RESET';
       else if (r < 0.80) type = 'GHOST';
       else type = 'MAGNET';

       let px, py, safe=false;
       let attempts = 0;
       while(!safe && attempts < 20) {
           attempts++;
           px = Math.random() * (CANVAS_WIDTH - 200) + 100;
           py = Math.random() * (CANVAS_HEIGHT - 200) + 100;
           safe = true;
           for(const obs of this.obstacles) {
               if(px > obs.x && px < obs.x+obs.width && py > obs.y && py < obs.y+obs.height) safe=false;
           }
       }
       if(safe) {
         this.powerups.push({ 
             id: Math.random().toString(), 
             type: type, 
             position: { x: px, y: py }, 
             spawnTime: now, 
             radius: POWERUP_RADIUS 
         });
       }
    }
  }

  checkCollisions(now) {
      this.potatoes.forEach(potato => {
        Object.values(this.players).forEach(p => {
            if (p.isDead) return;
            const dist = Math.hypot(p.position.x - potato.position.x, p.position.y - potato.position.y);
            if (dist < p.radius + potato.radius) {
                if (p.isShielded) {
                    if (!potato.isFrozen) {
                        potato.isFrozen = true;
                        potato.freezeEndTime = now + 1000;
                    }
                } 
                else if (!potato.isFrozen && !p.isGhost) {
                    p.lives--;
                    if (p.lives <= 0) {
                        p.isDead = true;
                        this.potatoSpeedMultiplier += 0.1;
                    } else {
                        p.position = this.findSafeSpawn();
                        p.shieldCooldown = 20000;
                    }
                }
            }
        });
      });

      this.powerups = this.powerups.filter(pu => {
          let collected = false;
          Object.values(this.players).forEach(p => {
              if (p.isDead) return;
              const dist = Math.hypot(p.position.x - pu.position.x, p.position.y - pu.position.y);
              if (dist < p.radius + pu.radius) {
                  collected = true;
                  p.score += 50;
                  switch(pu.type) {
                      case 'SPEED': p.speedBoostEndTime = now + 8000; p.speed = BASE_SPEED * 1.5; break;
                      case 'COOLDOWN_RESET': p.dashCooldown = 0; p.shieldCooldown = 0; p.smokeCooldown = 0; p.slimeCooldown = 0; break;
                      case 'FREEZE': this.potatoes.forEach(pot => { pot.isFrozen = true; pot.freezeEndTime = now + 3000; }); break;
                      case 'GHOST': p.isGhost = true; setTimeout(() => { if(this.players[p.id]) p.isGhost = false; }, 5000); break;
                  }
              }
          });
          return !collected;
      });
  }

  handleInput(socketId, inputData) {
    if (this.players[socketId]) {
        this.players[socketId].input.x = inputData.x;
        this.players[socketId].input.y = inputData.y;
        
        if (inputData.key) {
            const p = this.players[socketId];
            
            // Cannot use abilities if Silenced!
            if (p.isSilenced) return;

            const now = Date.now();
            
            if (inputData.key === 'q' && p.dashCooldown <= 0) {
                p.dashCooldown = 8000;
                p.speedBoostEndTime = now + 300;
                p.speed = BASE_SPEED * 2.5;
            }
            if (inputData.key === 'w' && p.shieldCooldown <= 0) p.shieldCooldown = 20000;
            if (inputData.key === 'e' && p.smokeCooldown <= 0) p.smokeCooldown = 12000;
            if (inputData.key === 'r' && p.slimeCooldown <= 0) {
                p.slimeCooldown = 15000;
                // Create Slime Area
                this.slimeAreas.push({
                    id: Math.random().toString(),
                    ownerId: socketId,
                    x: p.position.x,
                    y: p.position.y,
                    radius: SLIME_RADIUS,
                    spawnTime: now,
                    duration: 3000
                });
            }
        }
    }
  }
}

// --- Socket.IO Handling ---
io.on('connection', (socket) => {
  // ... (Existing connection logic) ...

  // To save space in XML, assume standard join logic is here.
  // The crucial part is emitting the new state including slimeAreas in the loop below.

  console.log('User connected:', socket.id);
  socket.emit('lobbies_update', getActiveLobbies());

  socket.on('create_room', ({ name, color, potatoSpeed, maxPlayers, isPrivate }) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const room = new GameRoom(roomId, socket.id, potatoSpeed, maxPlayers, isPrivate);
    room.addPlayer(socket.id, name, color);
    rooms[roomId] = room;
    socket.join(roomId);
    socket.emit('room_joined', { roomId, isHost: true, playerId: socket.id, speedModifier: potatoSpeed, maxPlayers, isPrivate });
    io.to(roomId).emit('room_update', { players: Object.values(room.players), hostId: room.hostId });
    io.emit('lobbies_update', getActiveLobbies());
  });

  socket.on('join_room', ({ roomId, name, color }) => {
    const room = rooms[roomId];
    if (room && room.state === 'WAITING') {
        if (Object.keys(room.players).length >= room.maxPlayers) { socket.emit('error', 'Room is full!'); return; }
        room.addPlayer(socket.id, name, color);
        socket.join(roomId);
        socket.emit('room_joined', { roomId, isHost: false, playerId: socket.id, speedModifier: room.initialPotatoSpeed, maxPlayers: room.maxPlayers, isPrivate: room.isPrivate });
        io.to(roomId).emit('room_update', { players: Object.values(room.players), hostId: room.hostId });
        io.emit('lobbies_update', getActiveLobbies());
    } else { socket.emit('error', 'Room not found or game already in progress'); }
  });

  socket.on('start_game', () => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId && rooms[roomId] && rooms[roomId].hostId === socket.id) {
          rooms[roomId].startGame();
          io.to(roomId).emit('game_started');
          io.emit('lobbies_update', getActiveLobbies());
      }
  });

  socket.on('ping_check', (timestamp) => { socket.emit('pong_check', timestamp); });

  socket.on('update_ping', (ping) => {
     const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
     if (roomId && rooms[roomId]) {
        rooms[roomId].updatePlayerPing(socket.id, ping);
        if(rooms[roomId].state === 'WAITING') {
           io.to(roomId).emit('room_update', { players: Object.values(rooms[roomId].players), hostId: rooms[roomId].hostId });
        }
     }
  });

  socket.on('input', (data) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (roomId && rooms[roomId]) {
        rooms[roomId].handleInput(socket.id, data);
    }
  });

  socket.on('disconnect', () => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        const res = room.removePlayer(socket.id);
        if (res.empty) { delete rooms[roomId]; } 
        else { io.to(roomId).emit('room_update', { players: Object.values(room.players), hostId: room.hostId }); }
    }
    io.emit('lobbies_update', getActiveLobbies());
  });
});

function getActiveLobbies() {
    return Object.values(rooms).filter(r => !r.isPrivate).map(r => ({
            id: r.id,
            players: Object.keys(r.players).length,
            maxPlayers: r.maxPlayers,
            state: r.state
        }));
}

setInterval(() => {
    for (const roomId in rooms) {
        const room = rooms[roomId];
        if (room.state === 'PLAYING') {
            room.update();
            io.to(roomId).emit('game_state', {
                players: Object.values(room.players),
                potatoes: room.potatoes,
                obstacles: room.obstacles,
                powerups: room.powerups,
                slimeAreas: room.slimeAreas // Emit new state
            });
        }
    }
}, 1000 / 60);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});