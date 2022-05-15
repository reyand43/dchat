import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Main from './pages/Main/Main';
import Network from './pages/Network/Network';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route exact path="/" element={<Main />} />
        <Route exact path="/network" element={<Network />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
