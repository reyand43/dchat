/* eslint-disable no-undef */
/* eslint-disable jsx-a11y/media-has-caption */
import { useMemo, useEffect } from 'react';
import ROLES from '../../const/roles';
import useWebRTC2 from '../../hooks/useWebRTC2';
import styles from './Call.module.scss';

function Call() {
  const {
    clients, changeRole, localClient,
  } = useWebRTC2();
  const handleWatch = () => {
    changeRole(ROLES.WATCHER);
  };

  const handleStream = () => {
    changeRole(ROLES.STREAMER);
  };

  const allClients = useMemo(() => {
    if (localClient) {
      return [localClient, ...clients];
    }
    return clients;
  }, [clients, localClient]);

  useEffect(() => {
    console.log('!!!', allClients);
  }, [allClients]);

  return (
    <div className={styles.videos}>
      {allClients.map((client) => (
        client.role === ROLES.STREAMER && (
        <div key={client.peerID} className={styles.videoWrapper}>
          <video
            width="100%"
            height="100%"
            // ref={(instance) => {
            //   provideMediaRef(peerID, instance);
            // }}
            autoPlay
            playsInline
            // muted={clientID === LOCAL_VIDEO}
            muted
          />
          <div className={styles.videoCaption}>
            <span>{client.peerID === window.localStorage.getItem('peerID') ? 'You' : client.name}</span>
            {client.audio && <span>&nbsp;Mic&nbsp;</span>}
            {client.video && <span>&nbsp;Vid&nbsp;</span>}
            <span>{client.role}</span>
          </div>
        </div>
        )
      ))}
      <button style={{ top: 0, left: 0, position: 'absolute' }} onClick={handleStream}>Stream</button>
      <button style={{ top: 0, left: '100px', position: 'absolute' }} onClick={handleWatch}>Watch</button>
      <ul className={styles.users}>
        {allClients.map((client) => (
          <li key={client.peerID}>
            {client.peerID === window.localStorage.getItem('peerID') ? 'You' : client.name}
            &nbsp;
            {client.role}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Call;
