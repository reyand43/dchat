/* eslint-disable consistent-return */
/* eslint-disable no-undef */
import freeice from 'freeice';
import {
  useEffect, useRef, useState, useCallback,
} from 'react';
import socket from '../socket';
import ACTIONS from '../socket/actions';
import useStateWithCallback from './useStateWithCallback';

export default function useWebRTC() {
  const localMediaStream = useRef(null);
  const [localStreaming, setLocalStreaming] = useState(false);
  const peerMediaElements = useRef({});
  const peerConnections = useRef({});
  const [clients, updateClients] = useStateWithCallback([]);

  useEffect(() => {
    console.log('clients', clients);
  }, [clients]);

  const addNewClient = useCallback((newClient, cb) => {
    if (!clients.map((c) => c.peerID).includes(newClient)) {
      updateClients((list) => [...list, newClient], cb);
    }
  }, [clients, updateClients]);

  async function startStreaming() {
    localMediaStream.current = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: {
        width: 1280,
        height: 720,
      },
    });
    setLocalStreaming(true);
    socket.emit(ACTIONS.START_STREAMING);
  }

  async function stopStreaming() {
    setLocalStreaming(false);
    localMediaStream.current.getTracks().forEach((track) => {
      track.stop();
    });
    localMediaStream.current = null;
    socket.emit(ACTIONS.STOP_STREAMING);
  }

  useEffect(() => {
    if (localStreaming && localMediaStream.current) {
      const localVideoElement = peerMediaElements.current[window.localStorage.getItem('localSocketId')];
      if (localVideoElement) {
        localVideoElement.volume = 0;
        localVideoElement.srcObject = localMediaStream.current;
      }
    }
  }, [localStreaming]);

  useEffect(() => {
    async function startStreamingafterWatching({ peerID }) {
      if (localMediaStream.current) {
        localMediaStream.current.getTracks().forEach((track) => {
          peerConnections.current[peerID].addTrack(track, localMediaStream.current);
        });
      }
    }

    async function handleNewPeer({ peerID, createOffer }) {
      // Если юзер уже добавлен, то не добавляем
      if (peerID in peerConnections.current) {
        // peerConnections.current[peerID] = null;
        if (createOffer) {
          startStreamingafterWatching({ peerID });
          // return console.warn(`Already connected to ${peerID}`);
        }
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
        if (tracksNumber === 2 && !peerMediaElements.current[peerID]) {
          // Когда получили и микрофон и видео установили стрим в src видео
          console.log('add new client', clients);
          addNewClient({
            peerID,
          }, () => {
            peerMediaElements.current[peerID].srcObject = remoteStream;
          });
        }
      };

      // С локального ???
      if (localMediaStream.current) {
        localMediaStream.current.getTracks().forEach((track) => {
          peerConnections.current[peerID].addTrack(track, localMediaStream.current);
        });
      }

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

    async function addIceCandidate({ peerID, iceCandidate }) {
      peerConnections.current[peerID].addIceCandidate(
        new RTCIceCandidate(iceCandidate),
      );
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

    async function removePeer({ peerID }) {
      updateClients((prev) => prev.filter((c) => c.peerID !== peerID));
      peerMediaElements.current[peerID] = null;
    }

    async function handleUserLeft(peerID) {
      updateClients((prev) => prev.filter((c) => c.peerID !== peerID));
      peerMediaElements.current[peerID] = null;
      peerConnections.current[peerID] = null;
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer);

    // Прислали SDP
    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia);

    // Прислали ICE_CANDIDATES
    socket.on(ACTIONS.ICE_CANDIDATE, addIceCandidate);

    socket.on(ACTIONS.REMOVE_PEER, removePeer);

    socket.on(ACTIONS.LEFT_USER, handleUserLeft);
  }, []);

  const provideMediaRef = useCallback((id, node) => {
    peerMediaElements.current[id] = node;
  }, []);

  return {
    startStreaming, localMediaStream, localStreaming, provideMediaRef, stopStreaming, clients,
  };
}
