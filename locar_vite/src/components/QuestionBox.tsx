import React, { useEffect, useState } from "react";

type QuestionBoxProps = {
  open: boolean;
  setopen: (open: boolean) => void;
  onClose: (answer?: string) => void;
  initialAnswer?: string;
  question:string;
};

const QuestionBox: React.FC<QuestionBoxProps> = ({
  open,
  onClose,
  setopen,
  initialAnswer = "",
  question=""

}) => {
  const [answer, setAnswer] = useState(initialAnswer);

  useEffect(() => {
    setAnswer(initialAnswer);
  }, [initialAnswer, open]);

  const handleSubmit = () => {
    onClose(answer);
    setopen(false);
    setAnswer("");
  };

  const handleCancel = () => {
    onClose(undefined);
    setopen(false);
    setAnswer("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-100">
      <div className="bg-white p-5 rounded-2xl shadow-2xl w-[350px] border border-gray-200">
        <h3 className="font-semibold text-lg mb-2 text-center">{question}</h3>

        {/* <p className="text-sm text-gray-600 mb-4 text-center">What is your answer?</p> */}

        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 outline-none focus:ring focus:ring-blue-300"
          placeholder="Type your answer..."
        />

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            className="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition"
          >
            Submit
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-md hover:bg-gray-400 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionBox;
