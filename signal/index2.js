const path = require('path');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server)
const ACTIONS = require('./const/actions');
const User = require('./user');
const PORT = process.env.PORT || 3001;

const ROLES = {
  STREAMER: "streamer",
  WATCHER: "watcher",
}

const users = new Map();
const availableParents = new Map();

io.on("connection", socket => {
  socket.on(ACTIONS.JOIN_TO_CALL, (({ name }) => {
    users.set(socket.id, new User(name, socket.id))
    console.log(users)
    socket.emit(ACTIONS.JOIN_INFO, {
      users: [...users.values()].map((u) => u.userInfo),
      localSocketId: socket.id,
    })
    socket.broadcast.emit(ACTIONS.JOIN_NEW_USER, users.get(socket.id).userInfo)
    const streamers = [...users.values()].filter((userInfo) => 
      userInfo.role === ROLES.STREAMER
    )
    console.log("STREAMERS", [...users.values()])
    streamers.forEach((streamer) => {
      io.to(streamer.socketId).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        createOffer: true,
      });
      streamer.addWatcher(socket.id)

      socket.emit(ACTIONS.ADD_PEER, {
        peerID: streamer.socketId,
        createOffer: false,
      });
    })
    emitGraph()
  }))

  socket.on(ACTIONS.START_STREAMING, () => {
    console.log(ACTIONS.START_STREAMING)
    const streamer = users.get(socket.id)
    streamer.role = ROLES.STREAMER
    const watchers = [...users.keys()].filter((socketId) => socketId !== socket.id)
    watchers.forEach((watcher) => {
      streamer.addWatcher(watcher);
    })
    io.emit(ACTIONS.USER_CHANGE_PROPERTIES, streamer)
    // ТУТ НАЧИНАЕМ УСТАНАВЛИВАТЬ СОЕДИНЕНИЕ С КЕМ НУЖНО
    
    watchers.forEach((watcher) => {
      io.to(watcher).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        createOffer: false,
      });

      socket.emit(ACTIONS.ADD_PEER, {
        peerID: watcher,
        createOffer: true,
      });
    })
    emitGraph()
  })

  socket.on(ACTIONS.STOP_STREAMING, () => {
    const streamer = users.get(socket.id)
    streamer.role = ROLES.WATCHER
    const watchers = streamer.watchers
    watchers.forEach((watcher) => {
      io.to(watcher).emit(ACTIONS.REMOVE_PEER, {
        peerID: socket.id,
      });
    })
    emitGraph()
  })

  socket.on(ACTIONS.RELAY_SDP, ({ peerID, sessionDescription }) => {
    console.log(ACTIONS.RELAY_SDP, peerID)
    io.to(peerID).emit(ACTIONS.SESSION_DESCRIPTION, {
      peerID: socket.id,
      sessionDescription,
    })
  })

  socket.on(ACTIONS.RELAY_ICE, ({ peerID, iceCandidate }) => {
    console.log(ACTIONS.RELAY_ICE)
    io.to(peerID).emit(ACTIONS.ICE_CANDIDATE, {
      peerID: socket.id,
      iceCandidate,
    })
  })

  socket.on(ACTIONS.GET_GRAPH, () => {
    socket.emit(ACTIONS.USER_GRAPH_CHANGED, [...users.values()])
  }, [])

  function leave() {
    users.delete(socket.id)
    io.emit(ACTIONS.LEFT_USER, socket.id)
    emitGraph()
  }

  function emitGraph() {
    io.emit(ACTIONS.USER_GRAPH_CHANGED, [...users.values()])
  }

  socket.on('disconnecting', leave);
})

server.listen(PORT, () => {
  console.log('Signal server started on port ' + PORT)
})