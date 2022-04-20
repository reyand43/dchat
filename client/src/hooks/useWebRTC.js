/* eslint-disable no-undef */
import { useCallback, useEffect, useRef } from 'react';
import freeice from 'freeice';
import socket from '../socket';
import ACTIONS from '../socket/actions';
import useStateWithCallback from './useStateWithCallback';
import ROLES from '../const/roles';

export default function useWebRTC() {
  const [clients, updateClients] = useStateWithCallback([]);
  const peerConnections = useRef({});
  const localMediaStream = useRef(null);
  const peerMediaElements = useRef({});
  const localPeerID = useRef('');

  useEffect(() => {
    console.log('clients', clients);
  }, [clients]);

  const addNewClient = useCallback((newClient, cb) => {
    if (!clients.map((c) => c.peerID).includes(newClient)) {
      updateClients((list) => [...list, newClient], cb);
    }
  }, [clients, updateClients]);

  async function handleResumeCapture() {
    localMediaStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: 1280,
        height: 720,
      },
    });
    const localVideoElement = peerMediaElements.current[localPeerID.current];
    if (localVideoElement) {
      localVideoElement.volume = 0;
      localVideoElement.srcObject = localMediaStream.current;
    }
  }

  const handleChangeProperties = ({ users }) => {
    console.log('handleChangeProperties', users);
    if (
      users.find((u) => u.peerID === localPeerID.current).role === ROLES.STREAMER
      && window.localStorage.getItem('role') === ROLES.WATCHER) {
      updateClients(users, handleResumeCapture);
      window.localStorage.setItem('role', ROLES.STREAMER);
    } else {
      updateClients(users);
      window.localStorage.setItem('role', ROLES.WATCHER);
    }
  };

  async function startCapture({ name, role }) {
    localMediaStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: 1280,
        height: 720,
      },
    });
    if (!clients.find((client) => client.peerID === localPeerID.current)) {
      addNewClient({
        peerID: localPeerID.current,
        name,
        audio: true,
        video: true,
        role,
      }, () => {
        const localVideoElement = peerMediaElements.current[localPeerID.current];
        if (localVideoElement) {
          localVideoElement.volume = 0;
          localVideoElement.srcObject = localMediaStream.current;
        }
      });
    } else {
      const localVideoElement = peerMediaElements.current[localPeerID.current];
      if (localVideoElement) {
        localVideoElement.volume = 0;
        localVideoElement.srcObject = localMediaStream.current;
      }
    }
  }

  useEffect(() => {
    // Добавляется новый юзер (в том числе мы)
    // eslint-disable-next-line consistent-return
    console.log('TRIGGER');
    async function handleNewPeer({ peerID, createOffer, socketData }) {
      console.log('socketData', peerID, createOffer, socketData);
      // Если юзер уже добавлен, то не добавляем
      if (peerID in peerConnections.current) {
        peerConnections.current[peerID] = null;
        // return console.warn(`Already connected to ${peerID}`);
      }
      // В peerConnections добавляем новое соединение с этим юзером
      peerConnections.current[peerID] = new RTCPeerConnection({
        iceServers: freeice(),
      });
      // Когда можем получить айскандидата, отправляем его
      peerConnections.current[peerID].onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit(ACTIONS.RELAY_ICE, {
            peerID,
            iceCandidate: event.candidate,
          });
        }
      };
      // Когда получаем трек добавляем его конкретному peerID
      let tracksNumber = 0;
      peerConnections.current[peerID].ontrack = ({ streams: [remoteStream] }) => {
        tracksNumber += 1;
        if (tracksNumber === 2) {
          // Когда получили и микрофон и видео установили стрим в src видео
          addNewClient({
            peerID,
            ...socketData,
          }, () => {
            peerMediaElements.current[peerID].srcObject = remoteStream;
          });
        }
      };

      // С локального ???
      localMediaStream.current.getTracks().forEach((track) => {
        peerConnections.current[peerID].addTrack(track, localMediaStream.current);
      });

      if (createOffer) {
        // Если мы подключились к уже существующим, то создаем и отправлем оффер(SDP)
        const offer = await peerConnections.current[peerID].createOffer();
        await peerConnections.current[peerID].setLocalDescription(offer);
        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: offer,
        });
      }
    }

    async function setRemoteMedia({ peerID, sessionDescription: remoteDescription }) {
      await peerConnections.current[peerID].setRemoteDescription(
        new RTCSessionDescription(remoteDescription),
      );

      if (remoteDescription.type === 'offer') {
        const answer = await peerConnections.current[peerID].createAnswer();
        await peerConnections.current[peerID].setLocalDescription(answer);

        socket.emit(ACTIONS.RELAY_SDP, {
          peerID,
          sessionDescription: answer,
        });
      }
    }

    async function addIceCandidate({ peerID, iceCandidate }) {
      peerConnections.current[peerID].addIceCandidate(
        new RTCIceCandidate(iceCandidate),
      );
    }

    const handleRemovePeer = ({ peerID }) => {
      if (peerConnections.current[peerID]) {
        peerConnections.current[peerID].close();
      }

      delete peerConnections.current[peerID];
      delete peerMediaElements.current[peerID];
      updateClients((list) => list.filter((client) => client.peerID !== peerID));
    };

    // Добавился юзер
    socket.on(ACTIONS.ADD_PEER, handleNewPeer);

    // Прислали SDP
    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia);

    // Прислали ICE_CANDIDATES
    socket.on(ACTIONS.ICE_CANDIDATE, addIceCandidate);

    // Ушел юзер
    socket.on(ACTIONS.REMOVE_PEER, handleRemovePeer);

    socket.on(ACTIONS.CHANGE_PROPERTIES, handleChangeProperties);

    socket.on(ACTIONS.PEER_ID, ({ peerID }) => {
      console.log('get peer id', peerID);
      localPeerID.current = peerID;
      window.localStorage.setItem('peerID', peerID);
    });

    if (window.localStorage.getItem('peerID')) {
      localPeerID.current = window.localStorage.getItem('peerID');
    }

    const name = window.localStorage.getItem('name') || 'Unknown';
    const role = window.localStorage.getItem('role') || ROLES.STREAMER;
    startCapture({ name, role })
      .then(() => socket.emit(ACTIONS.JOIN, { room: role, name }))
      .catch((e) => console.error('Error getting userMedia', e));

    return () => {
      localMediaStream.current.getTracks().forEach((track) => track.stop());
      socket.emit(ACTIONS.LEAVE);
    };
  }, []);

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node;
  }, []);

  const changeRole = async (role) => {
    const prevRole = window.localStorage.getItem('role');
    if (prevRole !== role) {
      const localClient = clients.find((client) => (client.peerID === localPeerID.current));
      if (role === ROLES.WATCHER) {
        localMediaStream.current.getTracks().forEach((track) => track.stop());
        localMediaStream.current = null;
        updateClients([{ ...localClient, role }]);
        socket.emit(ACTIONS.CHANGE_ROLE, { role });
      } else {
        updateClients([{
          ...localClient,
          role,
        }]);
        const name = window.localStorage.getItem('name');
        startCapture(name, role)
          .then(() => socket.emit(ACTIONS.CHANGE_ROLE, { role }))
          .catch((e) => console.error('Error getting userMedia', e));
      }

      window.localStorage.setItem('role', role);
    }
  };

  return { clients, provideMediaRef, changeRole };
}
