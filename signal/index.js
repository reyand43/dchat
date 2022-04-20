const path = require('path');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server)
const ACTIONS = require('./const/actions');
const PORT = process.env.PORT || 3001;

const ROLES = {
  STREAMER: "streamer",
  WATCHER: "watcher",
}

// {
//   name: string;
//   role: string;
//   video: Boolean;
//   audio: Boolean;
// }
const store = new Map();

function getClientRooms() {
  // const { rooms } = io.sockets.adapter;
  return [
      {
        role: ROLES.STREAMER,
        users: [...store.values()].filter(((u) => u?.role === ROLES.STREAMER))
      },
      {
        role: ROLES.WATCHER,
        users: [...store.values()].filter(((u) => u?.role === ROLES.WATCHER))
      },
    ]
}

function shareRoomsInfo() {
  console.log(getClientRooms())
  io.emit(ACTIONS.SHARE_ROOMS, {
    rooms: getClientRooms()
  })
}

io.on("connection", socket => {
  console.log("socket connected")
  shareRoomsInfo();  
  socket.emit(ACTIONS.PEER_ID, { peerID: socket.id })

  socket.on(ACTIONS.JOIN, ({ room, name }) => {
    store.set(socket.id, {
      name,
      audio: true,
      video: true,
      role: room,
    })
    // joinRoom({ room })
    setConnections({ room })
  })

  function setConnections({ room }) {
    const clients = Array.from(io.sockets.adapter.rooms.get(ROLES.STREAMER) || [])
    if (room === ROLES.STREAMER) {
      clients = clients.concat(Array.from(io.sockets.adapter.rooms.get(ROLES.WATCHER) || []));
    }

    clients.forEach((client) => {

      io.to(client).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        createOffer: false,
        socketData: store.get(socket.id)
      });

      socket.emit(ACTIONS.ADD_PEER, {
        peerID: client,
        createOffer: true,
        socketData: store.get(client)
      });
    })

    socket.join(room);
    shareRoomsInfo();
  }

  // function joinRoom({ room }) {
  //   const clients = Array.from(io.sockets.adapter.rooms.get(ROLES.STREAMER) || [])
  //     .concat(Array.from(io.sockets.adapter.rooms.get(ROLES.WATCHER) || []));
  //   console.log(Array.from(io.sockets.adapter.rooms.get(ROLES.STREAMER) || []), '||||',
  //     (Array.from(io.sockets.adapter.rooms.get(ROLES.WATCHER) || [])))

  //   clients.forEach(clientID => {
  //     io.to(clientID).emit(ACTIONS.ADD_PEER, {
  //       peerID: socket.id,
  //       createOffer: false,
  //       socketData: store.get(socket.id)
  //     });

  //     socket.emit(ACTIONS.ADD_PEER, {
  //       peerID: clientID,
  //       createOffer: true,
  //       socketData: store.get(clientID)
  //     });
  //   });
  // }

  function leaveRoom() {
    const { rooms } = socket;
    store.delete(socket.id)

    Array.from(rooms)
      .forEach(roomID => {

        const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);

        clients
          .forEach(clientID => {
          io.to(clientID).emit(ACTIONS.REMOVE_PEER, {
            peerID: socket.id,
          });

          socket.emit(ACTIONS.REMOVE_PEER, {
            peerID: clientID,
          });
        });

        socket.leave(roomID);
      });

    shareRoomsInfo();
  }

  socket.on(ACTIONS.LEAVE, leaveRoom);

  socket.on('disconnecting', leaveRoom);

  socket.on(ACTIONS.RELAY_SDP, ({ peerID, sessionDescription }) => {
    io.to(peerID).emit(ACTIONS.SESSION_DESCRIPTION, {
      peerID: socket.id,
      sessionDescription,
    })
  })

  socket.on(ACTIONS.RELAY_ICE, ({ peerID, iceCandidate }) => {
    io.to(peerID).emit(ACTIONS.ICE_CANDIDATE, {
      peerID: socket.id,
      iceCandidate,
    })
  })

  socket.on(ACTIONS.CHANGE_ROLE, ({ role }) => {
    if (role === ROLES.WATCHER) {
      socket.leave(ROLES.STREAMER)
      store.set(socket.id, {
        ...store.get(socket.id),
        role: ROLES.WATCHER,
      })
      joinRoom({ room: role })
    } else {
      socket.leave(ROLES.WATCHER)
      store.set(socket.id, {
        ...store.get(socket.id),
        role: ROLES.STREAMER,
      })
      joinRoom({ room: role })
    }
    
  })
})

server.listen(PORT, () => {
  console.log('Signal server started on port ' + PORT)
})