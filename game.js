// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.myPlayerId = null;
        this.players = {};
        this.avatars = {};
        this.websocket = null;
        
        // Camera/viewport
        this.cameraX = 0;
        this.cameraY = 0;
        
        // Movement state
        this.keysPressed = new Set();
        this.isMoving = false;
        this.clickTarget = null;
        this.connectionStatus = 'connecting';
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        
        this.init();
        this.startGameLoop();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.connectToServer();
        this.setupKeyboardControls();
        this.setupMouseControls();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateCamera();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            // Image loaded, ready to draw
        };
        this.worldImage.onerror = () => {
            console.error('Failed to load world map image');
        };
        this.worldImage.src = 'world.jpg';
    }
    
    connectToServer() {
        try {
            this.websocket = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.websocket.onopen = () => {
                this.connectionStatus = 'connected';
                this.joinGame();
            };
            
            this.websocket.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };
            
            this.websocket.onclose = () => {
                this.connectionStatus = 'disconnected';
            };
            
            this.websocket.onerror = (error) => {
                this.connectionStatus = 'error';
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Biraj'
        };
        
        this.websocket.send(JSON.stringify(joinMessage));
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        document.addEventListener('keyup', (event) => this.handleKeyUp(event));
    }
    
    setupMouseControls() {
        this.canvas.addEventListener('click', (event) => this.handleCanvasClick(event));
    }
    
    handleCanvasClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Convert screen coordinates to world coordinates
        const worldX = clickX + this.cameraX;
        const worldY = clickY + this.cameraY;
        
        // Clamp to world boundaries
        const clampedX = Math.max(0, Math.min(worldX, this.worldWidth));
        const clampedY = Math.max(0, Math.min(worldY, this.worldHeight));
        
        this.clickTarget = { x: clampedX, y: clampedY };
        this.sendClickMoveCommand(clampedX, clampedY);
    }
    
    sendClickMoveCommand(x, y) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        // Store the target and start moving towards it
        this.clickTarget = { x: x, y: y };
        this.startMovingToTarget();
    }
    
    startMovingToTarget() {
        if (!this.clickTarget || !this.myPlayerId || !this.players[this.myPlayerId]) {
            return;
        }
        
        const myPlayer = this.players[this.myPlayerId];
        const deltaX = this.clickTarget.x - myPlayer.x;
        const deltaY = this.clickTarget.y - myPlayer.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // If we're close enough, stop moving
        if (distance < 20) {
            this.clickTarget = null;
            this.sendStopCommand();
            return;
        }
        
        // Determine which direction to move
        let direction = null;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left';
        } else {
            direction = deltaY > 0 ? 'down' : 'up';
        }
        
        // Send move command
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        
        this.websocket.send(JSON.stringify(moveMessage));
        this.isMoving = true;
        
        // Continue moving after a short delay
        setTimeout(() => {
            this.startMovingToTarget();
        }, 200);
    }
    
    handleKeyDown(event) {
        // Only handle arrow keys
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            return;
        }
        
        // Prevent default browser behavior (scrolling)
        event.preventDefault();
        
        // Add key to pressed keys set
        this.keysPressed.add(event.code);
        
        // Send move command
        this.sendMoveCommand();
    }
    
    handleKeyUp(event) {
        // Only handle arrow keys
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            return;
        }
        
        // Remove key from pressed keys set
        this.keysPressed.delete(event.code);
        
        // If no movement keys are pressed, send stop command
        if (this.keysPressed.size === 0) {
            this.sendStopCommand();
        }
    }
    
    sendMoveCommand() {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        // Send all pressed directions for proper diagonal movement
        const directions = [];
        
        if (this.keysPressed.has('ArrowUp')) {
            directions.push('up');
        }
        if (this.keysPressed.has('ArrowDown')) {
            directions.push('down');
        }
        if (this.keysPressed.has('ArrowLeft')) {
            directions.push('left');
        }
        if (this.keysPressed.has('ArrowRight')) {
            directions.push('right');
        }
        
        // Send move command for each direction (for diagonal movement)
        directions.forEach(direction => {
            const moveMessage = {
                action: 'move',
                direction: direction
            };
            
            this.websocket.send(JSON.stringify(moveMessage));
        });
        
        if (directions.length > 0) {
            this.isMoving = true;
        }
    }
    
    sendStopCommand() {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const stopMessage = {
            action: 'stop'
        };
        
        this.websocket.send(JSON.stringify(stopMessage));
        this.isMoving = false;
    }
    
    startGameLoop() {
        const gameLoop = (currentTime) => {
            const deltaTime = currentTime - this.lastFrameTime;
            const targetFrameTime = 1000 / this.targetFPS;
            
            if (deltaTime >= targetFrameTime) {
                this.update(deltaTime);
                this.draw();
                this.lastFrameTime = currentTime;
            }
            
            requestAnimationFrame(gameLoop);
        };
        
        requestAnimationFrame(gameLoop);
    }
    
    update(deltaTime) {
        // Update camera smoothly
        this.updateCamera();
        
        // The click target movement is now handled by startMovingToTarget()
        // No need to clear it here as it's handled in the movement function
    }
    
    handleServerMessage(message) {
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.parseAvatarImages();
                    this.updateCamera();
                } else {
                    console.error('Join game failed:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.parseAvatarImages();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                this.updateCamera();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                break;
                
            default:
                console.log('Unknown message type:', message.action);
        }
    }
    
    parseAvatarImages() {
        // Parse base64 avatar images into Image objects
        for (const avatarName in this.avatars) {
            const avatar = this.avatars[avatarName];
            
            // Initialize frames if not already done
            if (!avatar.parsedFrames) {
                avatar.parsedFrames = {
                    north: [],
                    south: [],
                    east: []
                };
                
                // Parse each direction's frames
                ['north', 'south', 'east'].forEach(direction => {
                    avatar.frames[direction].forEach((base64Data, index) => {
                        const img = new Image();
                        img.onload = () => {
                            // Avatar frame loaded
                        };
                        img.src = base64Data;
                        avatar.parsedFrames[direction][index] = img;
                    });
                });
            }
        }
    }
    
    updateCamera() {
        if (!this.myPlayerId || !this.players[this.myPlayerId]) return;
        
        const myPlayer = this.players[this.myPlayerId];
        
        // Always center camera on my player
        this.cameraX = myPlayer.x - this.canvas.width / 2;
        this.cameraY = myPlayer.y - this.canvas.height / 2;
        
        // Only clamp if the world is larger than the screen
        if (this.worldWidth > this.canvas.width) {
            this.cameraX = Math.max(0, Math.min(this.cameraX, this.worldWidth - this.canvas.width));
        }
        if (this.worldHeight > this.canvas.height) {
            this.cameraY = Math.max(0, Math.min(this.cameraY, this.worldHeight - this.canvas.height));
        }
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.cameraX,
            y: worldY - this.cameraY
        };
    }
    
    drawAvatar(player) {
        const avatar = this.avatars[player.avatar];
        if (!avatar || !avatar.parsedFrames) return;
        
        const screenPos = this.worldToScreen(player.x, player.y);
        
        // Check if avatar is visible on screen (accounting for zoom)
        if (screenPos.x < -50 || screenPos.x > this.canvas.width + 50 ||
            screenPos.y < -50 || screenPos.y > this.canvas.height + 50) {
            return;
        }
        
        // For west direction, use east frames and flip them
        const direction = player.facing === 'west' ? 'east' : player.facing;
        const frames = avatar.parsedFrames[direction];
        if (!frames || !frames[player.animationFrame]) return;
        
        const avatarImg = frames[player.animationFrame];
        
        // Calculate avatar size (preserve aspect ratio)
        const maxSize = 32;
        const aspectRatio = avatarImg.width / avatarImg.height;
        let avatarWidth, avatarHeight;
        
        if (aspectRatio > 1) {
            avatarWidth = maxSize;
            avatarHeight = maxSize / aspectRatio;
        } else {
            avatarHeight = maxSize;
            avatarWidth = maxSize * aspectRatio;
        }
        
        // Draw avatar
        this.ctx.save();
        
        // Handle west direction by flipping horizontally
        if (player.facing === 'west') {
            this.ctx.save();
            this.ctx.setTransform(-1, 0, 0, 1, screenPos.x, 0);
            this.ctx.drawImage(
                avatarImg,
                -avatarWidth / 2,
                screenPos.y - avatarHeight / 2,
                avatarWidth,
                avatarHeight
            );
            this.ctx.restore();
        } else {
            this.ctx.drawImage(
                avatarImg,
                screenPos.x - avatarWidth / 2,
                screenPos.y - avatarHeight / 2,
                avatarWidth,
                avatarHeight
            );
        }
        
        this.ctx.restore();
        
        // Draw username label
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const textY = screenPos.y - avatarHeight / 2 - 5;
        
        // Draw text outline
        this.ctx.strokeText(player.username, screenPos.x, textY);
        // Draw text fill
        this.ctx.fillText(player.username, screenPos.x, textY);
        
        this.ctx.restore();
    }
    
    draw() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map with camera offset
        this.ctx.drawImage(
            this.worldImage,
            this.cameraX, this.cameraY, this.canvas.width, this.canvas.height,
            0, 0, this.canvas.width, this.canvas.height
        );
        
        // Draw click target indicator
        if (this.clickTarget) {
            this.drawClickTarget();
        }
        
        // Draw all players
        for (const playerId in this.players) {
            this.drawAvatar(this.players[playerId]);
        }
        
        // Draw UI elements
        this.drawUI();
    }
    
    drawClickTarget() {
        const screenPos = this.worldToScreen(this.clickTarget.x, this.clickTarget.y);
        
        this.ctx.save();
        this.ctx.strokeStyle = '#00ff00';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        
        // Draw circle around target
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, 15, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Draw crosshair
        this.ctx.setLineDash([]);
        this.ctx.beginPath();
        this.ctx.moveTo(screenPos.x - 10, screenPos.y);
        this.ctx.lineTo(screenPos.x + 10, screenPos.y);
        this.ctx.moveTo(screenPos.x, screenPos.y - 10);
        this.ctx.lineTo(screenPos.x, screenPos.y + 10);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawUI() {
        // Draw connection status
        this.ctx.save();
        this.ctx.fillStyle = this.getConnectionStatusColor();
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`Connection: ${this.connectionStatus.toUpperCase()}`, 10, 25);
        
        // Draw movement indicator
        if (this.isMoving) {
            this.ctx.fillStyle = '#ffff00';
            this.ctx.fillText('Moving...', 10, 45);
        }
        
        this.ctx.restore();
    }
    
    getConnectionStatusColor() {
        switch (this.connectionStatus) {
            case 'connected': return '#00ff00';
            case 'connecting': return '#ffff00';
            case 'disconnected': return '#ff0000';
            case 'error': return '#ff0000';
            default: return '#ffffff';
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
