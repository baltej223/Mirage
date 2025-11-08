// No Body should touch this holy peice of code, on which the rest of the app depends
import * as THREE from "three";
import * as LocAR from "locar";

const camera = new THREE.PerspectiveCamera(
  80,
  window.innerWidth / window.innerHeight,
  0.001,
  1000,
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
// document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const locar = new LocAR.LocationBased(scene, camera);

window.addEventListener("resize", (e) => {
  console.log("resize", e);
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const cam = new LocAR.Webcam({
  video: {
    facingMode: "environment",
  },
});

cam.on("webcamstarted", (ev) => {
  scene.background = ev.texture;
});

cam.on("webcamerror", (error) => {
  alert(`Webcam error: code ${error.code} message ${error.message}`);
});

let firstLocation = true;

const deviceOrientationControls = new LocAR.DeviceOrientationControls(camera);

deviceOrientationControls.on("deviceorientationgranted", (ev) => {
  ev.target.connect();
});

deviceOrientationControls.on("deviceorientationerror", (error) => {
  alert(
    `Device orientation error: code ${error.code} message ${error.message}`,
  );
});

deviceOrientationControls.init();

locar.on("gpserror", (error) => {
  alert(`GPS error: ${error.code}`);
});

locar.on("gpsupdate", (ev) => {
  if (!firstLocation) return;
  const boxProps = [
    {
      latDis: 0.0005,
      lonDis: 0,
      colour: 0xff0000,
    },
    {
      latDis: -0.0005,
      lonDis: 0,
      colour: 0xffff00,
    },
    {
      latDis: 0,
      lonDis: -0.0005,
      colour: 0x00ffff,
    },
    {
      latDis: 0,
      lonDis: 0.0005,
      colour: 0x00ff00,
    },
  ];

  const geom = new THREE.BoxGeometry(10, 10, 10);

  for (const boxProp of boxProps) {
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshBasicMaterial({ color: boxProp.colour }),
    );

    locar.add(
      mesh,
      ev.position.coords.longitude + boxProp.lonDis,
      ev.position.coords.latitude + boxProp.latDis,
    );
  }

  firstLocation = false;
});

locar.startGps();

renderer.setAnimationLoop(animate);

function animate() {
  deviceOrientationControls.update();
  renderer.render(scene, camera);
}

export default renderer;
