import * as THREE from "three";
import * as LocAR from "locar";
import { queryWithinRadius } from "../services/firestoreGeoQuery";
import type { NearbyMirage } from "../services/firestoreGeoQuery";
import type { User } from "firebase/auth";

const QUERY_THROTTLE_MS = 5000;

export class MirageARManager {
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private locar!: LocAR.LocationBased;
  private cam!: LocAR.Webcam;
  private deviceOrientationControls!: LocAR.DeviceOrientationControls;
  private activeCubes: Map<string, THREE.Mesh> = new Map(); // Track by doc ID
  private lastQueryTime = 0;
  private currentUserPos: { lat: number; lng: number } | null = null;
  private container: HTMLElement;
  private raycaster = new THREE.Raycaster();
  private clickVector = new THREE.Vector2();
  private onCubeClick?: (cubeData: NearbyMirage, ev:any) => void;
  private user: User | null;
  public ev: any;

  constructor(container: HTMLElement, onCubeClick?: (cubeData: NearbyMirage, ev:any) => void, user: User | null = null) {
    this.container = container;
    this.onCubeClick = onCubeClick;
    this.user = user;
    console.log((this.user?.uid));
    this.initAR();
  }

  private initAR() {

    // Camera (your code)
    this.camera = new THREE.PerspectiveCamera(
      80,
      window.innerWidth / window.innerHeight,
      0.001,
      1000
    );

    // Renderer (mount to container instead of body)
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener("touchstart", (event) => {
      this.handleClick(event.touches[0]);
    });


    // Scene & LocAR
    this.scene = new THREE.Scene();
    this.locar = new LocAR.LocationBased(this.scene, this.camera)

    // Webcam (no explicit start; events trigger auto-init)
    this.cam = new LocAR.Webcam({ video: { facingMode: "environment" } });
    this.cam.on("webcamstarted", (ev) => {
      this.scene.background = ev.texture;
    });
    this.cam.on("webcamerror", (error) => {
      console.error("Webcam error:", error);
    });
    // Removed this.cam.start(); - auto-handled by LocAR

    // Resize
    const handleResize = () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    // Device Orientation
    this.deviceOrientationControls = new LocAR.DeviceOrientationControls(
      this.camera
    );
    this.deviceOrientationControls.on("deviceorientationgranted", (ev) => {
      ev.target.connect();
    });
    this.deviceOrientationControls.on("deviceorientationerror", (error) => {
      console.error("Orientation error:", error);
    });
    this.deviceOrientationControls.init();

    // GPS Events
    this.locar.on("gpserror", (error) => {
      alert("Turn on location services, Error: " + error);
    });
    this.locar.on("gpsupdate", (ev) => {
      console.log(ev);
      this.ev = ev;
      this.handleGpsUpdate(ev);
    });
    this.locar.startGps();

    // Animation Loop
    const animate = () => {
      this.deviceOrientationControls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.renderer.setAnimationLoop(animate);

  }

  private async handleGpsUpdate(ev: any) {
    console.log("UODA")
    const now = Date.now();
    if (now - this.lastQueryTime < QUERY_THROTTLE_MS) return;

    this.currentUserPos = {
      lat: ev.position.coords.latitude,
      lng: ev.position.coords.longitude,
    };

    this.clearCubes();

    if (!this.currentUserPos) return;
    console.log(this.user?.uid);
    const nearby = await queryWithinRadius({
      center: this.currentUserPos,
      // teamId: "baltej_idhar_teamId_dal",
      userId: this.user?.uid || "user-is-useless",
      useMockData: false
    });

    const geom = new THREE.BoxGeometry(3, 3, 3); 
    for (const loc of nearby) {
      const material = new THREE.MeshBasicMaterial({ color: Math.random() * 0xffffff });
      const mesh = new THREE.Mesh(geom, material);
      mesh.userData = loc;
      this.locar.add(mesh, loc.lng, loc.lat);
      this.activeCubes.set(loc.id, mesh);
    }

    this.lastQueryTime = Date.now();
  }

  private handleClick(event: MouseEvent | Touch) {
    const rect = this.renderer.domElement.getBoundingClientRect();

    this.clickVector.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.clickVector.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.clickVector, this.camera);

    const meshes = Array.from(this.activeCubes.values());
    const intersects = this.raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;

      const clicked = [...this.activeCubes.entries()].find(([_, m]) => m === mesh);
      if (clicked) {
        const [id] = clicked;
        this.onCubeClicked(id, mesh);
      }
    }
  }

  private onCubeClicked(id: string, mesh: THREE.Mesh) {
    console.log("Cube clicked:", id);
    const cubeData = mesh.userData as NearbyMirage;
    // console.log(JSON.stringify(cubeData));
    this.onCubeClick?.(cubeData, this.ev);
  }

  private clearCubes() {
    this.activeCubes.forEach((mesh) => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.activeCubes.clear();
  }

  destroy() {
    this.clearCubes();
    this.locar.stopGps?.();
    this.deviceOrientationControls.disconnect?.();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  getRenderer() {
    return this.renderer;
  }
}
