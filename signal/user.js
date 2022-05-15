const ROLES = require('./const/roles');

class User {
  constructor(name, socketId) {
    this.name = name;
    this.socketId = socketId;
    this.role = ROLES.WATCHER;
    this.left = null;
    this.right = null;
  }
}

module.exports = User