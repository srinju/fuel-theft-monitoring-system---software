import { BrowserRouter, Route, Routes } from "react-router-dom"
import Dashboard from "./components/Dashboard"
import FIRPage from "./components/FIRPage"

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/fir" element={<FIRPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}

export default App
