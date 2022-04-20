/* eslint-disable no-lone-blocks */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import {
  useEffect, useState, useRef, useMemo, useCallback,
} from 'react';
import { v4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import socket from '../../socket';
import ACTIONS from '../../socket/actions';
import ROLES from '../../const/roles';
import styles from './Main.module.scss';
import useWebRTC from '../../hooks/useWebRTC2';

function Main() {
  const [users, setUsers] = useState([]);
  const {
    localMediaStream, localStreaming, startStreaming, provideMediaRef, stopStreaming, clients,
  } = useWebRTC();
  const [localSocketId, setLocalSocketId] = useState('');

  useEffect(() => {
    socket.emit(ACTIONS.JOIN_TO_CALL, {
      name: window.localStorage.getItem('name') || v4(),
    });

    socket.on(ACTIONS.JOIN_INFO, (({ users: newUsers, localSocketId: socketId }) => {
      window.localStorage.setItem('localSocketId', socketId);
      setLocalSocketId(socketId);
      setUsers(newUsers);
    }));

    socket.on(ACTIONS.JOIN_NEW_USER, (newUser) => setUsers((prev) => [...prev, newUser]));

    socket.on(
      ACTIONS.LEFT_USER,
      (userSocketId) => {
        setUsers((prev) => prev.filter((u) => u.socketId !== userSocketId));
      },
    );

    socket.on(ACTIONS.USER_CHANGE_PROPERTIES, (user) => {
      console.log('&&&&', user);
      setUsers((prev) => prev.map((u) => {
        if (u.socketId === user.socketId) {
          return user;
        }
        return u;
      }));
    });
  }, []);

  const getName = useCallback((peerID) => {
    const user = users.find((u) => u.socketId === peerID);
    if (!user) {
      return 'undefined';
    }
    return user.name;
  }, [users]);

  return (
    <div className={styles.root}>
      <div className={styles.videos}>
        {localStreaming && (
          <div className={styles.videoWrapper}>
            <video
              width="100%"
              height="100%"
              ref={(instance) => {
                provideMediaRef(localSocketId, instance);
              }}
              autoPlay
              playsInline
            // muted={clientID === LOCAL_VIDEO}
              muted
              className={styles.localVideo}
            />
            <span>(You)</span>
          </div>
        )}
        {clients.map((c) => (
          <div className={styles.videoWrapper} key={c.peerID}>
            <video
              width="100%"
              height="100%"
              ref={(instance) => {
                provideMediaRef(c.peerID, instance);
              }}
              autoPlay
              playsInline
            // muted={clientID === LOCAL_VIDEO}
              muted
            />
            <span>{getName(c.peerID)}</span>
          </div>
        ))}
      </div>
      <div className={styles.users}>
        {!localStreaming
          ? <button onClick={startStreaming}>Stream</button>
          : <button onClick={stopStreaming}>Stop streaming</button>}
        <button><a href="/network" target="_blank">Network</a></button>
        <h4>Users</h4>
        {users.map((u) => (
          <li key={u.socketId}>
            {u.name}
            {u.socketId === localSocketId && '(You)'}
            -
            {u.role}
          </li>
        ))}
      </div>
    </div>
  );
}

export default Main;
