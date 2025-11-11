import React from "react";
import { motion } from "framer-motion";

const Loader: React.FC = () => {
  return (
    <div className="flex w-full h-screen items-center justify-center min-h-screen bg-black">
      <div className="relative w-24 h-24">
        {/* Outer rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-cyan-400 border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner pulsing ring */}
        <motion.div
          className="absolute inset-3 rounded-full border-2 border-cyan-300/50"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Glowing core */}
        <motion.div
          className="absolute inset-7 rounded-full bg-cyan-500 shadow-[0_0_20px_4px_rgba(34,211,238,0.6)]"
          animate={{
            opacity: [1, 0.6, 1],
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
};

export default Loader;
