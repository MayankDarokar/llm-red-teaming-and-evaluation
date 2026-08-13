import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PromptLibrary from './pages/PromptLibrary';
import Evaluation from './pages/Evaluation';
import Results from './pages/Results';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="prompts" element={<PromptLibrary />} />
          <Route path="evaluation" element={<Evaluation />} />
          <Route path="results" element={<Results />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
