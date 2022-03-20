/* eslint-disable no-unused-vars */
import { useEffect, useState, useRef } from 'react';
import { v4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import socket from '../../socket';
import ACTIONS from '../../socket/actions';

function Main() {
  const navigate = useNavigate();
  const [rooms, updateRooms] = useState([]);
  const rootNode = useRef();

  useEffect(() => {
    socket.on(ACTIONS.SHARE_ROOMS, ({ rooms: newRooms = [] } = {}) => {
      console.log(newRooms);
      if (rootNode.current) {
        updateRooms(newRooms);
      }
    });
  }, []);

  const handleCreate = () => {
    navigate(`/room/${v4()}`);
  };

  return (
    <div ref={rootNode}>
      <h1>Available rooms</h1>
      <ul>
        {rooms.map((roomId) => (
          <li key={roomId}>
            {roomId}
            <button onClick={() => navigate(`/room/${roomId}`)}>Join room</button>
          </li>
        ))}
      </ul>
      <button onClick={handleCreate}>Create new room</button>

    </div>
  );
}

export default Main;
