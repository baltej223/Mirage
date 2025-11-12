import React, { useCallback, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useNavigate } from "react-router-dom";

type Props = {
  size?: "sm" | "md"; // sizing control
};

/**
 * Small, production-ready logout button (Tailwind).
 * - No avatar / image — just the button anchored top-right
 * - Loading state, error display
 * - Accessible (aria-label, focus ring), keyboard friendly
 */
const LogoutButton: React.FC<Props> = ({ size = "sm" }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sizes = {
    sm: { btn: "px-7 py-2 text-sm" },
    md: { btn: "px-4 py-1.5 text-sm" },
  }[size];

  const handleSignOut = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await signOut(auth);
      navigate("/login");
    } catch (e: any) {
      console.error("Sign out error:", e);
      setError("Unable to sign out. Please try again.");
      setLoading(false);
    }
  }, [navigate]);

  return (
    <div className="fixed top-4 right-4 z-50">
      <div role="navigation" aria-label="User actions">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={loading}
          aria-label="Sign out"
          className={`inline-flex items-center rounded-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 disabled:opacity-60 ${sizes.btn}`}
        >
          {loading ? (
            <svg
              className="w-4 h-4 mr-2 animate-spin text-white"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
              <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : null}
          <span className="text-white">Logout</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="mt-2 rounded-md bg-red-600/90 text-white px-3 py-1 text-xs shadow">
          {error}
        </div>
      )}
    </div>
  );
};

export default LogoutButton;
