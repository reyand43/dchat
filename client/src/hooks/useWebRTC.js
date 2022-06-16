/* eslint-disable no-undef */
import { useEffect, useRef, useState } from 'react';
import freeice from 'freeice';
import socket from '../socket';
import ACTIONS from '../socket/actions';
import useStateWithCallback from './useStateWithCallback';
import ROLES from '../const/roles';

export default function useWebRTC() {
  const mediaStream = useRef(null);
  const [mediaStreamState, updateMediaStreamState] = useStateWithCallback(null);
  const [localStreaming, setLocalStreaming] = useState(false);
  const peerMediaElement = useRef(null);
  const peerConnections = useRef({});
  const [clients, setClients] = useState([]);

  async function startStreaming() {
    mediaStream.current = {
      peerID: window.localStorage.getItem('localSocketId'),
      stream: await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: 1280,
          height: 720,
        },
      }),
    };
    setLocalStreaming(true);
    updateMediaStreamState({
      peerID: window.localStorage.getItem('localSocketId'),
      stream: await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: 1280,
          height: 720,
        },
      }),
    });
    socket.emit(ACTIONS.START_STREAMING);
  }

  async function stopStreaming() {
    setLocalStreaming(false);
    mediaStream.current.stream.getTracks().forEach((track) => {
      track.stop();
    });
    updateMediaStreamState(null, mediaStream.current = null);
    socket.emit(ACTIONS.STOP_STREAMING);
  }

  useEffect(() => {
    async function handleNewPeer({ peerID, createOffer }) {
      peerConnections.current[peerID] = new RTCPeerConnection({
        iceServers: freeice(),
      });
      setClients((prev) => [...prev, peerID]);
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
        // if (tracksNumber === 1 && !peerMediaElement.current) {
        if (tracksNumber === 1) {
          // Когда получили и микрофон и видео установили стрим в src видео
          mediaStream.current = {
            stream: remoteStream,
            peerID,
          };
          updateMediaStreamState({
            stream: remoteStream,
            peerID,
          });
          [...Object.keys(peerConnections.current)]
            .filter((pc) => pc !== peerID)
            .forEach((currentPeerID) => {
              mediaStream.current.stream.getTracks().forEach((track) => {
                peerConnections.current[currentPeerID].addTrack(track, mediaStream.current.stream);
              });
            });
          [...Object.keys(peerConnections.current)]
            .filter((pc) => pc !== peerID)
            .forEach((pc) => {
              socket.emit(ACTIONS.RECONNECT, pc);
            });
        }
      };

      // С локального
      if (mediaStream.current) {
        mediaStream.current.stream.getTracks().forEach((track) => {
          peerConnections.current[peerID].addTrack(track, mediaStream.current.stream);
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
      if (mediaStream.current?.peerID === peerID && !localStreaming) {
        mediaStream.current = null;
        updateMediaStreamState(null);
      }
      setClients((prev) => prev.filter((p) => p !== peerID));
      peerConnections.current[peerID] = null;
      delete peerConnections.current[peerID];
    }

    async function removeStreamerVideo(peerID) {
      if (mediaStream.current) {
        mediaStream.current = null;
        updateMediaStreamState(null);
      }
      if (peerConnections.current[peerID]) {
        peerConnections.current[user.socketId].close();
        peerConnections.current[peerID] = null;
        delete peerConnections.current[peerID];
      }
    }

    socket.on(ACTIONS.ADD_PEER, handleNewPeer);

    // Прислали SDP
    socket.on(ACTIONS.SESSION_DESCRIPTION, setRemoteMedia);

    // Прислали ICE_CANDIDATES
    socket.on(ACTIONS.ICE_CANDIDATE, addIceCandidate);

    socket.on(ACTIONS.REMOVE_PEER, removePeer);

    socket.on(ACTIONS.STREAMER_LEFT, removeStreamerVideo);

    socket.on(ACTIONS.USER_CHANGE_PROPERTIES, (user) => {
      if (user.role === ROLES.WATCHER) {
        if (mediaStream.current) {
          mediaStream.current = null;
          updateMediaStreamState(null);
        }
        if (peerConnections.current[user.socketId]) {
          peerConnections.current[user.socketId].close();
          peerConnections.current[user.socketId] = null;
          delete peerConnections.current[user.socketId];
        }
      }
    });
  }, []);

  const provideMediaRef = (node) => {
    if (!node) return;
    peerMediaElement.current = node;
    peerMediaElement.current.srcObject = mediaStream.current.stream;
  };

  return {
    mediaStream,
    startStreaming,
    localStreaming,
    provideMediaRef,
    stopStreaming,
    mediaStreamState,
    updateMediaStreamState,
    clients,
  };
}
