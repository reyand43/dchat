/* eslint-disable jsx-a11y/media-has-caption */
import { useParams } from 'react-router-dom';
import useWebRTC, { LOCAL_VIDEO } from '../../hooks/useWebRTC';

function Layout(clientNumber = 1) {
  const pairs = Array.from({ length: clientNumber })
    .reduce((acc, next, index, arr) => {
      if (index % 2 === 0) {
        acc.push(arr.slice(index, index + 2));
      }

      return acc;
    }, []);

  const rowsNumber = pairs.length;
  const height = `${100 / rowsNumber}%`;

  return pairs.map((row, index, arr) => {
    if (index === arr.length - 1 && row.length === 1) {
      return [{
        width: '100%',
        height,
      }];
    }
    return row.map(() => ({
      width: '50%',
      height,
    }));
  }).flat();
}

function Call() {
  const { id: roomID } = useParams();
  const { clients, provideMediaRef } = useWebRTC(roomID);
  const videoLayout = Layout(clients.length);

  console.log(clients);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      height: '100vh',
    }}
    >
      {clients.map((clientID, index) => (
        <div key={clientID} style={videoLayout[index]}>
          <video
            width="100%"
            height="100%"
            ref={(instance) => {
              provideMediaRef(clientID, instance);
            }}
            autoPlay
            playsInline
            muted={clientID === LOCAL_VIDEO}
          />
        </div>
      ))}
    </div>
  );
}

export default Call;
