import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./components/DashBoard.jsx";

import { AuthProvider } from "./context/AuthContext.jsx";

function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}

export default App;
