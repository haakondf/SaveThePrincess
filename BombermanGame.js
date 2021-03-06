/// creating defaults for first level! Maybe create a BombermanGame just with its level as input?

function BombermanGame(bombListener, fieldSize, boardMatrix, enemies = enemies1, bomberman = new Bomberman()) {
  var tileSize = fieldSize / boardMatrix.length;
  this.field = new FieldMatrix(boardMatrix, tileSize);
  this.field.tileSize = tileSize;
  this.bomberman = bomberman; // stores the bomberman, here only for first round!
  this.enemies = enemies; // array which stores the enemies that exist in this round
  this.bombs = [];
  this.bomberman.size = tileSize;
  this.bomberman.x = tileSize;
  this.bomberman.y = tileSize;
  this.bomberman.speed = 5;
  this.bomberman.tileSize = tileSize;
  for (var i = 0; i < this.enemies.length; i++) {
    var enemy = this.enemies[i];
    enemy.size = tileSize;
    enemy.x = enemy.x * tileSize;
    enemy.y = enemy.y * tileSize;
    enemy.tileSize = tileSize;
  }
  this.bombListener = bombListener;
}

/////////// Functions to control bomberman //////////////

BombermanGame.prototype.setBombermanDirection = function(direction) {
  this.bomberman.changeDirection(direction);
};

BombermanGame.prototype.stopMovingBomberman = function() {
  this.bomberman.isMoving = false;
};

BombermanGame.prototype.startMovingBomberman = function() {
  this.bomberman.isMoving = true;
};

BombermanGame.prototype.moveBomberman = function() {
  if (this.canMove(this.bomberman, this.bomberman.currentDirection)) {
    this.bomberman.move();
  } else if (!this.isAtBorder(this.bomberman)) {
    this.moveToNextBorder(this.bomberman);
  }
};

BombermanGame.prototype.moveEnemy = function(enemy) {
  if (this.canMove(enemy, enemy.currentDirection)) {
    enemy.move();
    if (this.isCollisionOfCharacters(enemy, this.bomberman)) {
      this.bomberman.isAlive = false;
    }
  } else if (this.isAtBorder(enemy)) {
    enemy.changeDirection();
  } else {
    this.moveToNextBorder(enemy);
  }
};

//////////// Check if moving in selected direction is possible ////////////

// TODO: does not work for too slow enemies! They get stuck in Nort or West direction!
BombermanGame.prototype.isAtBorder = function(character) {
  if (character.currentDirection === DIRECTION_ENUM.NORTH || character.currentDirection === DIRECTION_ENUM.SOUTH) {
    return character.y % this.field.tileSize === 0;
  } else return character.x % this.field.tileSize === 0;
};

BombermanGame.prototype.moveToNextBorder = function(character) {
  switch (character.currentDirection) {
    case DIRECTION_ENUM.NORTH:
      character.y += character.y % this.field.tileSize;
      break;
    case DIRECTION_ENUM.SOUTH:
      character.y += this.field.tileSize - (character.y % this.field.tileSize);
      break;
    case DIRECTION_ENUM.EAST:
      character.x += this.field.tileSize - (character.x % this.field.tileSize);
      break;
    case DIRECTION_ENUM.WEST:
      character.x += character.x % this.field.tileSize;
      break;
  }
};

////// Functions to set and ignite a bomb

BombermanGame.prototype.igniteBomb = function() {
  if (this.bomberman.canSetBomb()) {
    var tileCoordinates = this.field.getCurrentTileIndexFromPosition(
      this.bomberman.getMidX(),
      this.bomberman.getMidY()
    );
    var coordinates = this.field.getMidCoordinatesFromTileIndizes(tileCoordinates);
    this.bomberman.igniteBomb(coordinates.x, coordinates.y, this);
    this.bombListener.onBombIgnition(tileCoordinates.x, tileCoordinates.y);
    this.field.replaceTileAt(tileCoordinates.x, tileCoordinates.y, TILE.BOMB);
  }
};

BombermanGame.prototype.removeBomb = function(bombXIndize, bombYIndize) {
  this.field.replaceTileAt(bombXIndize, bombYIndize, TILE.NO);
};

BombermanGame.prototype.replaceTileIfNotInvincible = function(xIndex, yIndex) {
  var tile = this.field.getTileAt(xIndex, yIndex);
  if (!TILE.isInvincible(tile)) {
    this.field.replaceTileAt(xIndex, yIndex, TILE.explode(tile));
  }
};

BombermanGame.prototype.didCharacterDieOnBombExplosion = function(character, explosionXIndize, explosionYIndize) {
  var explosionMidCoord = this.field.getMidCoordinatesFromTileIndizesXAndY(explosionXIndize, explosionYIndize);
  return this.isCollisionWithCharacter(
    character,
    explosionMidCoord.x,
    explosionMidCoord.y,
    character.size / 2 + this.field.tileSize / 2
  );
};

BombermanGame.prototype.setCharacterDead = function(character) {
  character.isAlive = false;
};

BombermanGame.prototype.checkAndReturnDeadEnemy = function(enemy, enemyIndex, explosionXIndex, explosionYIndex) {
  if (this.didCharacterDieOnBombExplosion(enemy, explosionXIndex, explosionYIndex)) {
    this.setCharacterDead(enemy);
    return enemyIndex;
  }
  return null;
};

BombermanGame.prototype.doExplosionAtTile = function(explosionXIndex, explosionYIndex) {
  var tile = this.field.getTileAt(explosionXIndex, explosionYIndex);
  if (!TILE.isInvincible(tile)) {
    this.field.replaceTileAt(explosionXIndex, explosionYIndex, TILE.explode(tile));
    var diedEnemies = [];
    if (this.didCharacterDieOnBombExplosion(this.bomberman, explosionXIndex, explosionYIndex)) {
      this.bomberman.isAlive = false;
    }
    this.enemies.forEach((enemy, index) => {
      var diedEnemy = this.checkAndReturnDeadEnemy(enemy, index, explosionXIndex, explosionYIndex);
      if (diedEnemy !== null) diedEnemies.push(diedEnemy);
    });
    this.bombListener.onBombExplosion(explosionXIndex, explosionYIndex, diedEnemies);
  }
};

BombermanGame.prototype.onBombExplosion = function(bomb) {
  var bombExplosionTileIndizes = this.field.getCurrentTileIndexFromPosition(bomb.getMidX(), bomb.getMidY());
  var bombX = bombExplosionTileIndizes.x;
  var bombY = bombExplosionTileIndizes.y;
  this.removeBomb(bombX, bombY);
  var bombRange = bomb.bombRange;
  for (var i = -bomb.bombRange; i <= bomb.bombRange; i++) {
    this.doExplosionAtTile(bombX + i, bombY);
    this.doExplosionAtTile(bombX, bombY + i);
  }
};

// detect collision

BombermanGame.prototype.isCollision = function(x1, x2, y1, y2, minDistance) {
  return Math.abs(x1 - x2) < minDistance && Math.abs(y1 - y2) < minDistance;
};

BombermanGame.prototype.isCollisionOfCharacters = function(char1, char2) {
  var minDistance = char1.size / 2 + char2.size / 2;
  return this.isCollision(char1.getMidX(), char2.getMidX(), char1.getMidY(), char2.getMidY(), minDistance);
};

BombermanGame.prototype.isCollisionWithCharacter = function(char, midX, midY, minDistance) {
  return this.isCollision(midX, char.getMidX(), midY, char.getMidY(), minDistance);
};

// Functions to check for wall collision

BombermanGame.prototype.getDistanceToTopBorder = function(character) {
  return character.getMidY() % this.field.tileSize;
};

BombermanGame.prototype.getDistanceToLeftBorder = function(character) {
  return character.getMidX() % this.field.tileSize;
};

BombermanGame.prototype.getBlockedDistanceFromBorder = function() {
  return this.field.tileSize * 0.4;
};

BombermanGame.prototype.getCurrentCharacterTile = function(character) {
  return this.field.getCurrentTileIndexFromPosition(character.getMidX(), character.getMidY());
};

BombermanGame.prototype.isNextTilePassable = function(tileIndizes, direction) {
  return this.isTilePassable(tileIndizes.getNextTile(direction));
};

BombermanGame.prototype.canMove = function(character, direction) {
  var characterTileIndizes = this.getCurrentCharacterTile(character);
  if (this.isNextTilePassable(characterTileIndizes, direction)) {
    return true;
  }
  var nextTileIndizes = characterTileIndizes.getNextTile(direction);
  var nextTile = this.field.getMidCoordinatesFromTileIndizes(nextTileIndizes);
  var isCollision = this.isCollision(
    character.getMidX(),
    nextTile.x,
    character.getMidY(),
    nextTile.y,
    character.speed + character.size / 2 + this.field.tileSize / 2
  );
  return !isCollision;
};

BombermanGame.prototype.isTilePassable = function(tileIndizes) {
  return this.field.getTileFromIndizesAt(tileIndizes) === TILE.NO;
};

/// LOST

BombermanGame.prototype.isLost = function() {
  return !this.bomberman.isAlive;
};

/// WON

BombermanGame.prototype.areEnemiesAlive = function() {
  var isEnemyAlive;
  this.enemies.forEach(function(enemy) {
    if (enemy.isAlive) {
      isEnemyAlive = true;
      return;
    }
  });
  return isEnemyAlive;
};

BombermanGame.prototype.isWon = function() {
  return this.bomberman.isAlive === true && !this.areEnemiesAlive();
};

//////////////////////////// GAME SETUP ///////////////////////////////////

var enemies1 = [new SimpleEnemy(4, 5), new SimpleEnemy(11, 6), new SimpleEnemy(1, 10)];

function getEnemiesAtRound(number) {
  var enemiesArray = [];
  for (var i = 0; i < coordinatesArray[number].length; i++) {
    var currentCoordinates = coordinatesArray[number][i];
    enemiesArray.push(new SimpleEnemy(currentCoordinates.x, currentCoordinates.y));
  }
  return enemiesArray;
}

/// Start display:
var emptyMatrix = [
  createBorderRow(13),
  createRow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  createSecondRow(0, 0, 0, 0, 0, 0),
  createRow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  createSecondRow(0, 0, 0, 0, 0, 0),
  createRow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  createSecondRow(0, 0, 0, 0, 0, 0),
  createRow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  createSecondRow(0, 0, 0, 0, 0, 0),
  createRow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  createSecondRow(0, 0, 0, 0, 0, 0),
  createRow(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  createBorderRow(13)
];

var coordinates1 = [new TileIndizes(4, 5), new TileIndizes(11, 6), new TileIndizes(1, 10)];
// acutal game:
var matrix1 = [
  createBorderRow(13),
  createRow(0, 1, 1, 1, 0, 0, 1, 0, 0, 1, 0),
  createSecondRow(0, 1, 0, 1, 0, 0),
  createRow(0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1),
  createSecondRow(0, 0, 1, 0, 0, 0),
  createRow(0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0),
  createSecondRow(1, 0, 0, 0, 0, 0),
  createRow(1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0),
  createSecondRow(0, 1, 0, 1, 0, 1),
  createRow(0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1),
  createSecondRow(0, 1, 0, 0, 0, 0),
  createRow(0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1),
  createBorderRow(13)
];

var coordinates2 = [new TileIndizes(9, 1), new TileIndizes(11, 2), new TileIndizes(1, 11), new TileIndizes(8, 11)];

var matrix2 = [
  createBorderRow(13),
  createRow(0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0),
  createSecondRow(0, 1, 1, 1, 0, 0),
  createRow(0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1),
  createSecondRow(0, 0, 1, 0, 1, 1),
  createRow(1, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0),
  createSecondRow(0, 0, 1, 1, 1, 1),
  createRow(1, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0),
  createSecondRow(0, 1, 1, 1, 0, 0),
  createRow(1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1),
  createSecondRow(0, 1, 1, 0, 0, 0),
  createRow(0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1),
  createBorderRow(13)
];

var boardMatrixArray = [matrix1, matrix2];

var coordinatesArray = [coordinates1, coordinates2];
