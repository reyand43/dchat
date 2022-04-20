/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import { useRef, useEffect, useState } from 'react';
import vis from 'vis';
import ROLES from '../../const/roles';
import socket from '../../socket';
import ACTIONS from '../../socket/actions';
import stringToColor from '../../utils/stringToColor';
import styles from './Network.module.scss';

function Network() {
  const [users, setUsers] = useState([]);

  const ref = useRef(null);

  useEffect(() => {
    socket.emit(ACTIONS.GET_GRAPH);
    socket.on(ACTIONS.USER_GRAPH_CHANGED, setUsers);
  }, []);

  useEffect(() => {
    console.log('users', users);
    const nodes = new vis.DataSet(users.map((u) => ({
      id: u.socketId,
      label: u.name.slice(0, 3),
      color: {
        border: u.role === ROLES.WATCHER ? 'red' : 'blue',
        background: stringToColor(u.socketId),
      },
    })));
    const edgeArray = [];
    users.forEach((u) => {
      u.watchers.forEach((w) => {
        edgeArray.push({
          from: w,
          to: u.socketId,
        });
      });
    });
    const edges = new vis.DataSet(edgeArray);
    const data = {
      nodes,
      edges,
    };
    const network = new vis.Network(ref.current, data, { nodes: { borderWidth: 2 } });
  }, [users]);

  const nodes = new vis.DataSet([]);

  const edges = new vis.DataSet([]);

  // create a network
  // eslint-disable-next-line no-unused-vars
  const data = {
    nodes,
    edges,
  };
  const options = {};
  // // eslint-disable-next-line no-undef

  const createGraph = () => {
    // // eslint-disable-next-line no-unused-vars
    const network = new vis.Network(ref.current, data, options);
  };

  useEffect(() => {
    createGraph();
  }, []);

  return (
    <div>
      <span className={styles.watcher}>Watcher</span>
      <span className={styles.streamer}>Streamer</span>
      <div ref={ref} id="mynetwork" className={styles.network} />
    </div>
  );
}

export default Network;
