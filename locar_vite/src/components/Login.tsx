import React, { useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth  } from "../../firebase"; // adjust the path as needed
import { useNavigate } from "react-router-dom";

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    const provider = new GoogleAuthProvider();
    
    try {
      await signInWithPopup(auth, provider);
      alert("Login successful!");
      logined = true;
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Google login failed.");
    } finally {
      setLoading(false);
    }
  };
  if(logined) {
    const navigate = useNavigate();

    useEffect(() => {
      navigate("/dashboard"); // redirect to /dashboard
    }, [navigate]);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-2xl shadow-md w-full max-w-sm text-center">
        <h1 className="text-2xl font-semibold mb-6">Sign in to Continue</h1>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex items-center justify-center gap-3 w-full py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 active:scale-[0.98] transition-all"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-5 h-5"
          />
          <span className="font-medium text-gray-700">
            {loading ? "Signing in..." : "Continue with Google"}
          </span>
        </button>
      </div>
    </div>
  );
};

export default Login;
