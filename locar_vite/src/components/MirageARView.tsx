// components/MirageARView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { MirageARManager } from './MirageARManager.ts';
import LogoutButton from './LogoutButton.tsx';
import QuestionBox from "./QuestionBox.tsx";
import type { NearbyMirage } from '../services/firestoreGeoQuery';

const MirageARView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<MirageARManager | null>(null);
  const [selectedCube, setSelectedCube] = useState<NearbyMirage | null>(null);
  const [isQuestionBoxOpen, setIsQuestionBoxOpen] = useState(false);

  const handleCubeClick = (cubeData: NearbyMirage) => {
    setSelectedCube(cubeData);
    setIsQuestionBoxOpen(true);
  };

  useEffect(() => {
    if (containerRef.current) {
      managerRef.current = new MirageARManager(containerRef.current, handleCubeClick);
    }

    return () => {
      managerRef.current?.destroy();
    };
  }, []);

  const handleQuestionBoxClose = (answer: any) => {
    console.log('Answer:'+ answer);
    setIsQuestionBoxOpen(false);
    setSelectedCube(null);
  };

  return (
    <>
      {isQuestionBoxOpen && selectedCube && (
        <QuestionBox
          open={isQuestionBoxOpen}
          setopen={setIsQuestionBoxOpen}
          question={selectedCube.question}
          onClose={handleQuestionBoxClose}
        />
      )}
      <LogoutButton />
      <div
        ref={containerRef}
        style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, zIndex: 0 }}
      />
    </>
  );
};

export default MirageARView;

