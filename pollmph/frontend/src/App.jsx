import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PulseDashboard from './components/PulseDashboard'
import PropositionDetail from './components/PropositionDetail'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/" element={<PulseDashboard />} />
          <Route path="/proposition/:id" element={<PropositionDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App