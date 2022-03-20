import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Call from './pages/Call/Call';
import Main from './pages/Main/Main';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route exact path="/room/:id" element={<Call />} />
        <Route exact path="/" element={<Main />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
