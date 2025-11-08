import "./App.css";
import Login from "./components/Login";
import MainScreen from "./components/MainScreen";
import { Routes, Route } from "react-router-dom";

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<MainScreen />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </>
  );
}

export default App;
