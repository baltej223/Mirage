import { useEffect, useRef } from "react";
import renderer from "./glscene";
import LogoutButton from "./LogoutButton";
import { useAuth } from "../context/AuthContext";
import QuestionBox from "./QuestionBox";

export default function MainScreen() {

  // Camera and WebGL renderer setup
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    console.log(user); // ✅ log user in console

    const container = containerRef.current;
    if (!container) return;

    if (
      renderer.domElement &&
      renderer.domElement.parentElement !== container
    ) {
      container.appendChild(renderer.domElement);
    }

    return () => {
      if (
        renderer.domElement &&
        renderer.domElement.parentElement === container
      ) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <>
      <QuestionBox />
      <LogoutButton />
      <div id="glscene" ref={containerRef} />
    </>
  );
}
