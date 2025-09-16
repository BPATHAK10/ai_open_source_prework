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
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.connectToServer();
        this.setupKeyboardControls();
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
            this.draw();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
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
                console.log('Connected to game server');
                this.joinGame();
            };
            
            this.websocket.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };
            
            this.websocket.onclose = () => {
                console.log('Disconnected from game server');
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
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
    
    handleServerMessage(message) {
        console.log('Received message:', message);
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.parseAvatarImages();
                    this.updateCamera();
                    this.draw();
                } else {
                    console.error('Join game failed:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.parseAvatarImages();
                this.draw();
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                this.updateCamera();
                this.draw();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                this.draw();
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
                            this.draw(); // Redraw when new avatar loads
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
        
        // Only clamp if the world is smaller than the screen
        // This ensures avatar stays centered while preventing showing beyond map edges
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
        if (!avatar || !avatar.parsedFrames) {
            console.log('Avatar data missing for:', player.username, 'avatar:', player.avatar);
            return;
        }
        
        const screenPos = this.worldToScreen(player.x, player.y);
        
        // Check if avatar is visible on screen
        if (screenPos.x < -50 || screenPos.x > this.canvas.width + 50 ||
            screenPos.y < -50 || screenPos.y > this.canvas.height + 50) {
            return;
        }
        
        // For west direction, use east frames and flip them
        const direction = player.facing === 'west' ? 'east' : player.facing;
        const frames = avatar.parsedFrames[direction];
        if (!frames || !frames[player.animationFrame]) {
            console.log('Missing frames for player:', player.username, 'facing:', player.facing, 'frame:', player.animationFrame);
            return;
        }
        
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
            console.log('Drawing west-facing avatar for:', player.username, 'at:', screenPos);
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
        
        // Draw all players
        for (const playerId in this.players) {
            this.drawAvatar(this.players[playerId]);
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
