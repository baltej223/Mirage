// components/MirageARView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { MirageARManager } from './MirageARManager.ts';
import LogoutButton from './LogoutButton.tsx';
import QuestionBox from "./QuestionBox.tsx";
import { checkAnswer } from '../services/firestoreGeoQuery';
import type { NearbyMirage } from '../services/firestoreGeoQuery';
import { useAuth } from '../context/AuthContext';
// import type { User } from "firebase/auth";

const MirageARView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<MirageARManager | null>(null);
  const [selectedCube, setSelectedCube] = useState<NearbyMirage | null>(null);
  const [isQuestionBoxOpen, setIsQuestionBoxOpen] = useState(false);
  const { user } = useAuth();

  const handleCubeClick = (cubeData: NearbyMirage) => {
    setSelectedCube(cubeData);
    setIsQuestionBoxOpen(true);
  };

  useEffect(() => {
    if (containerRef.current) {
      managerRef.current = new MirageARManager(containerRef.current, handleCubeClick, user);
    }

    return () => {
      managerRef.current?.destroy();
    };
  }, [user]);

  const handleQuestionBoxClose = async (questionId?: string, answer?: string) => {
    if (questionId == undefined || answer == undefined) return;
    console.log('Answer:'+ answer + " " + user);
    console.log('Question ID:'+ questionId);
    let reply = await checkAnswer({
      questionId,
      answer,
      userId: user?.uid ?? "user-key-mkc",
      lat: managerRef.current?.ev.position.coords.latitude,
      lng: managerRef.current?.ev.position.coords.longitude,
    })
    setIsQuestionBoxOpen(false);
    setSelectedCube(null);
    alert(reply?.nextHint);
  };

  return (
    <>
      {isQuestionBoxOpen && selectedCube && (
        <QuestionBox
          open={isQuestionBoxOpen}
          setopen={setIsQuestionBoxOpen}
          question={selectedCube.question}
          onClose={handleQuestionBoxClose}
          id={selectedCube.id}
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

