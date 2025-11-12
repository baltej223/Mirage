import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type QuestionBoxProps = {
  open: boolean;
  setopen: (open: boolean) => void;
  onClose: (questionId?: string, answer?: string) => void;
  initialAnswer?: string;
  question: string;
  id: string;
};

const QuestionBox: React.FC<QuestionBoxProps> = ({
  open,
  onClose,
  setopen,
  initialAnswer = "",
  question = "",
  id,
}) => {
  const [answer, setAnswer] = useState<string>(initialAnswer || "");

  const handleSubmit = () => {
    onClose(id, answer);
    setopen(false);
    setAnswer("");
  };

  const handleCancel = () => {
    onClose();
    setopen(false);
    setAnswer("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[100]"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative w-[360px] bg-white/20 backdrop-blur-xl border border-white/30 shadow-2xl rounded-2xl p-6 text-gray-800"
          >
            <h3 className="text-lg font-semibold text-center mb-3 text-gray-900">
              {question}
            </h3>

            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full text-gray-900 bg-white/50 border border-gray-200 rounded-xl px-3 py-2 mb-5 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400 transition-all"
              placeholder="Type your answer..."
            />

            <div className="flex gap-3">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-2 rounded-xl font-medium shadow-md hover:shadow-lg hover:from-blue-600 hover:to-indigo-600 transition-all"
              >
                Submit
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-xl font-medium hover:bg-gray-300 transition-all"
              >
                Cancel
              </button>
            </div>

            {/* Subtle close indicator */}
            <button
              onClick={handleCancel}
              className="absolute top-2 right-3 text-gray-500 hover:text-gray-700 text-xl font-semibold"
            >
              ×
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QuestionBox;
