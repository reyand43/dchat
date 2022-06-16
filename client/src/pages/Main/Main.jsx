/* eslint-disable no-lone-blocks */
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import {
  useEffect, useState, useMemo, useCallback,
} from 'react';
import Avatar from 'boring-avatars';
import EyeIcon from '@mui/icons-material/RemoveRedEye';
import VideoIcon from '@mui/icons-material/Videocam';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import humanNames from 'human-names';
import socket from '../../socket';
import ACTIONS from '../../socket/actions';
import ROLES from '../../const/roles';
import styles from './Main.module.scss';
import useWebRTC from '../../hooks/useWebRTC';

function Main() {
  const [users, setUsers] = useState([]);
  const {
    mediaStream, localStreaming, startStreaming, provideMediaRef, stopStreaming, mediaStreamState,
    clients,
  } = useWebRTC();
  const [localSocketId, setLocalSocketId] = useState('');

  const localUser = useMemo(
    () => {
      return users.find((u) => u.socketId === localSocketId);
    },
    [users, localSocketId],
  );

  const streamer = useMemo(() => users.find((u) => u.role === ROLES.STREAMER), [users]);


  const findNameById = (socketId) => {
    return `${users.find((u) => u.socketId === socketId)?.name}`;
  };

  const canStream = useMemo(
    () => !users.find((u) => u.role === ROLES.STREAMER && u.socketId !== localSocketId),
    [users, localSocketId],
  );

  useEffect(() => {
    socket.emit(ACTIONS.JOIN_TO_CALL, {
      name: humanNames.allRandom(),
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
      setUsers((prev) => prev.map((u) => {
        if (u.socketId === user.socketId) {
          return user;
        }
        return u;
      }));
    });
  }, []);

  const handleStartStreaming = () => {
    setUsers((prev) => prev.map((u) => {
      if (u.socketId === localSocketId) {
        return {
          ...u,
          role: ROLES.STREAMER,
        };
      }
      return u;
    }));
    startStreaming();
  };

  const handleStopStreaming = () => {
    setUsers((prev) => prev.map((u) => {
      if (u.socketId === localSocketId) {
        return {
          ...u,
          role: ROLES.WATCHER,
        };
      }
      return u;
    }));
    stopStreaming();
  };

  const getName = useCallback((peerID) => {
    const user = users.find((u) => u.socketId === peerID);
    if (!user) {
      return 'undefined';
    }
    return user.name;
  }, [users]);

  const getIconForRole = (role) => {
    if (role === ROLES.WATCHER) {
      return <EyeIcon className={styles.icon} fontSize="medium" />;
    }
    return <VideoIcon className={styles.icon} fontSize="medium" />;
  };

  const getIconForConnections = (socketId) => {
    if (mediaStream.current?.peerID === socketId) {
      return <ArrowDownwardIcon className={styles.icon} fontSize="medium" />;
    }
    return <ArrowUpwardIcon className={styles.icon} fontSize="medium" />;
  };


  return (
    <div className={styles.root}>
      <div className={styles.videos}>
        {(mediaStream.current || mediaStreamState) ? (
          <div className={styles.videoWrapper}>
            <video
              width="100%"
              height="100%"
              ref={(instance) => {
                provideMediaRef(instance);
              }}
              autoPlay
              playsInline
              // muted={clientID === LOCAL_VIDEO}
              muted
              className={localStreaming ? styles.video : ''}
            />
            <span className={styles.streamerName}>{streamer && getName(streamer.socketId)}</span>
          </div>
        ) : <h1 className={styles.wainting}>Waiting for streamer...</h1>}
      </div>
      <div className={styles.users}>
        <div className={styles.localUser}>
          <Avatar variant="beam" name={localUser?.name} />
          <span className={styles.name}>
            <b>{localUser?.name || ''}</b>
          </span>
          {getIconForRole(localUser?.role || '')}
        </div>
        {canStream && (
          <div style={{ width: '100%' }}>
            {!localStreaming
              ? (
                <button
                  onClick={handleStartStreaming}
                  style={{ width: '100%' }}
                  className={styles.streamButton}
                >
                  Start streaming
                </button>
              )
              : (
                <button
                  onClick={handleStopStreaming}
                  style={{ width: '100%' }}
                  className={styles.streamButton}
                >
                  Stop streaming
                </button>
              )}
          </div>
        )}
        <button className={styles.streamButton}><a href="/network" target="_blank">Network</a></button>
        {Boolean(users.length > 1) && <span className={styles.usersTitle}>Users</span>}
        <div className={styles.usersList}>
          {users.map((u) => {
            if (u.socketId === localSocketId) {
              return null;
            }
            return (
              <div key={u.socketId} className={styles.user}>
                <Avatar variant="beam" name={u.name} />
                <span className={styles.name}>
                  <b>{u.name}</b>
                  {u.socketId === localSocketId && '(You)'}
                </span>
                {getIconForRole(u?.role || '')}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Main;
