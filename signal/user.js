const ROLES = require('./const/roles');

class User {
  constructor(name, socketId) {
    this.name = name;
    this.socketId = socketId;
    this.role = ROLES.WATCHER;
    this.watchers = [];
  }

  get userInfo() {
    return {
      name: this.name,
      socketId: this.socketId,
      role: this.role,
    }
  }

  addWatcher(socketId) {
    this.watchers.push(socketId)
  }

}

module.exports = User