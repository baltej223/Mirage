import React from "react";
import { motion } from "framer-motion";

const Loader: React.FC = () => {
  return (
    <div className="flex items-center justify-center w-full h-screen bg-black">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Outer rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />

        {/* Centered Logo */}
        <img
          src="/Logo10.png"
          alt="Logo"
          className="w-30 h-30 object-contain"
        />
      </div>
    </div>
  );
};

export default Loader;
