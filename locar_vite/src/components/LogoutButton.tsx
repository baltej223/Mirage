import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate } from "react-router-dom";

const LogoutButton = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login"); // redirect to login
  };

  return (
    <button
      onClick={handleLogout}
      className="fixed top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg hover:bg-red-600 active:scale-95 transition"
    >
      Logout
    </button>
  );
};

export default LogoutButton;
