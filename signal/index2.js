const path = require('path');
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server)
const ACTIONS = require('./const/actions');
const User = require('./user');
const BinaryTree = require('./binaryTree');
const PORT = process.env.PORT || 3001;

const ROLES = {
  STREAMER: "streamer",
  WATCHER: "watcher",
}

const users = new Map();
const availableParents = new Map();
const tree = new BinaryTree();

io.on("connection", socket => {
  socket.on(ACTIONS.JOIN_TO_CALL, (({ name }) => {
    const user = new User(name, socket.id)
    users.set(socket.id, user)
    // console.log(users)
    /// 
    const { parent } = tree.add(user)
    socket.emit(ACTIONS.JOIN_INFO, {
      users: [...users.values()].map((u) => u),
      localSocketId: socket.id,
    })
    socket.broadcast.emit(ACTIONS.JOIN_NEW_USER, users.get(socket.id))
    const streamers = [...users.values()].filter((userInfo) => 
      userInfo.role === ROLES.STREAMER
    )
    // console.log("STREAMERS", [...users.values()])
    if (parent && parent.socketId !== '0') {
      // console.log("PARENT", parent)
      io.to(parent.socketId).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        createOffer: true,
      });

      socket.emit(ACTIONS.ADD_PEER, {
        peerID: parent.socketId,
        createOffer: false,
      });
    }
    emitGraph()
    // console.log('!!!!', tree)
  }))

  socket.on(ACTIONS.START_STREAMING, () => {
    // console.log(ACTIONS.START_STREAMING)
    const streamer = users.get(socket.id)
    // console.log('STREAMER', streamer)
    streamer.role = ROLES.STREAMER
    const removeInfo = tree.remove(socket.id);
    makeReconectionAfterRemove(removeInfo);

    streamer.left = null;
    streamer.right = null;
    tree.addRoot(streamer)
    socket.broadcast.emit(ACTIONS.USER_CHANGE_PROPERTIES, streamer)
    // ТУТ НАЧИНАЕМ УСТАНАВЛИВАТЬ СОЕДИНЕНИЕ С КЕМ НУЖНО
    const children = [streamer.left, streamer.right]
    children.forEach((c) => {
      if (c) {
        io.to(c.socketId).emit(ACTIONS.ADD_PEER, {
          peerID: socket.id,
          createOffer: false,
        });
  
        socket.emit(ACTIONS.ADD_PEER, {
          peerID: c.socketId,
          createOffer: true,
        });
      }
    })
    // console.log('!!!!', tree)
    
    emitGraph()
  })

  socket.on(ACTIONS.RECONNECT, (peerID) => {
    console.log('ACTIONS.RECONNECT', peerID)
    io.to(peerID).emit(ACTIONS.REMOVE_PEER, {
      peerID: socket.id,
    });
    socket.emit(ACTIONS.REMOVE_PEER, {
      peerID,
    });
    socket.emit(ACTIONS.ADD_PEER, {
      peerID,
      createOffer: true,
    });
    io.to(peerID).emit(ACTIONS.ADD_PEER, {
      peerID: socket.id,
      createOffer: false,
    });
  })

  socket.on(ACTIONS.STOP_STREAMING, () => {
    const streamer = users.get(socket.id);
    // const chidren = [streamer.left, streamer.right]
    streamer.role = ROLES.WATCHER
    const removeInfo = tree.remove(socket.id)
    makeReconectionAfterRemove(removeInfo)
    const { parent } = tree.add(streamer)
    if (parent && parent?.socketId !== '0') {
      io.to(parent.socketId).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        createOffer: true,
      });
      socket.emit(ACTIONS.ADD_PEER, {
        peerID: parent.socketId,
        createOffer: false,
      });
    }
    socket.broadcast.emit(ACTIONS.USER_CHANGE_PROPERTIES, streamer)
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
    socket.emit(ACTIONS.USER_GRAPH_CHANGED, tree.root)
  }, [])

  function leave() {
    const deletedUser = users.get(socket.id);
    if (deletedUser && deletedUser.role === ROLES.STREAMER) {
      socket.broadcast.emit(ACTIONS.STREAMER_LEFT, socket.id)
    }
    users.delete(socket.id)
    io.emit(ACTIONS.LEFT_USER, socket.id)
    const removeInfo = tree.remove(socket.id);
    // console.log('removeInfo', removeInfo);
    // удаляем связи у детей удаленного узла 
    makeReconectionAfterRemove(removeInfo);
    io.emit(ACTIONS.REMOVE_PEER, {
      peerID: socket.id,
    });
    emitGraph()
  }

  function makeReconectionAfterRemove(removeInfo) {
    console.log("REMOVE INFO", removeInfo);
    removeInfo?.chidren?.forEach((c) => {
      io.to(c.socketId).emit(ACTIONS.REMOVE_PEER, {
        peerID: socket.id,
      });
    })
    // удаляем связи у родителя удаленного узла 
    if (removeInfo?.parent) {
      io.to(removeInfo?.parent.socketId).emit(ACTIONS.REMOVE_PEER, {
        peerID: socket.id,
      });
    }
    if (removeInfo?.newNode && !removeInfo.newNodeParent && removeInfo?.parent) {
      io.to(removeInfo?.parent.socketId).emit(ACTIONS.ADD_PEER, {
        peerID: removeInfo?.newNode.socketId,
        createOffer: true,
      });
      console.log("SEND ADD PEER TO", removeInfo?.parent.name, 'offer true')
      io.to(removeInfo?.newNode.socketId).emit(ACTIONS.ADD_PEER, {
        peerID: removeInfo?.parent.socketId,
        createOffer: false,
      });
      console.log("SEND ADD PEER TO", removeInfo?.newNode.name, 'offer false')
      return
    }
    if (removeInfo?.newNode && removeInfo.newNodeParent) {
      // удаляем связи у нового узла и его родителя
      io.to(removeInfo?.newNode.socketId).emit(ACTIONS.REMOVE_PEER, {
        peerID: removeInfo?.newNodeParent.socketId,
      });
      io.to(removeInfo?.newNodeParent.socketId).emit(ACTIONS.REMOVE_PEER, {
        peerID: removeInfo?.newNode.socketId,
      });
      // создаем связи у нового узла с новым родителем
      if (removeInfo?.parent) {
        io.to(removeInfo?.parent.socketId).emit(ACTIONS.ADD_PEER, {
          peerID: removeInfo?.newNode.socketId,
          createOffer: true,
        });
        console.log("SEND ADD PEER TO", removeInfo?.parent.name, 'offer true')
        io.to(removeInfo?.newNode.socketId).emit(ACTIONS.ADD_PEER, {
          peerID: removeInfo?.parent.socketId,
          createOffer: false,
        });
        console.log("SEND ADD PEER TO", removeInfo?.newNode.name, 'offer false')
      }
      
      // создаем связи у нового узла с новыми детьми
      removeInfo?.chidren.forEach((c) => {
        io.to(removeInfo?.newNode.socketId).emit(ACTIONS.ADD_PEER, {
          peerID: c.socketId,
          createOffer: true,
        });
        io.to(c.socketId).emit(ACTIONS.ADD_PEER, {
          peerID: removeInfo?.newNode.socketId,
          createOffer: false,
        });
      })
    }
    console.log("TREE", tree.root)
  }

  function emitGraph() {
    io.emit(ACTIONS.USER_GRAPH_CHANGED, tree.root)
  }

  socket.on('disconnecting', leave);
})

server.listen(PORT, () => {
  console.log('Signal server started on port ' + PORT)
})

// const tree = new BinaryTree(); 

// tree.add(new User('andrey', '1'))
// tree.add(new User('bob', '2'))
// tree.add(new User('jack', '3')
// tree.add(new User('nick', '4'))
// tree.add(new User('nick5', '5'))
// tree.add(new User('nick6', '6'))
// tree.add(new User('nick7', '7'))
// tree.add(new User('nick8', '8'))
// tree.add(new User('nick9', '9'))
// tree.add(new User('nick10', '10'))



// console.log("=======")

// console.log('!!!!', tree.root)
// tree.remove('3');
// tree.remove('4');
// tree.remove('1');
// tree.remove('5');
// tree.remove('9');
// tree.remove('10');

// tree.addRoot(new User('gabe', '1'))


// console.log('!!!!', tree.root)
// // console.log(tree.search('4'));



// console.log("=======")
