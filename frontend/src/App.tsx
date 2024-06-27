import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dev } from './pages/Dev';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dev />} />
      </Routes>
    </Router>
  );
}

export default App;