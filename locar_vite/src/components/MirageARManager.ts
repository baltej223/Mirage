import * as THREE from "three";
import * as LocAR from "locar"; // Or CDN import as before
import { queryWithinRadius } from "../services/firestoreGeoQuery";
import type { NearbyMirage } from "../services/firestoreGeoQuery";

//const COLLECTION_NAME = "mirage-locations";
const QUERY_RADIUS = 25; // meters
const QUERY_THROTTLE_MS = 5000; // Re-query every 5s on GPS updates

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
  private onCubeClick?: (cubeData: NearbyMirage) => void;

  constructor(container: HTMLElement, onCubeClick?: (cubeData: NearbyMirage) => void) {
    this.container = container;
    this.onCubeClick = onCubeClick;
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
    this.locar = new LocAR.LocationBased(this.scene, this.camera);

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
    const now = Date.now();
    if (now - this.lastQueryTime < QUERY_THROTTLE_MS) return; // Throttle

    this.currentUserPos = {
      lat: ev.position.coords.latitude,
      lng: ev.position.coords.longitude,
    };

    // Clear old cubes
    this.clearCubes();

    if (!this.currentUserPos) return;

    /*
insteaderface MirageQueryOptions {
  center: GeoPoint;
  radiusMeters: number;
  teamId: string;
  userId: string;
  endpoint?: string; // e.g. "https://your-api.com/api/mirages"
  useMockData?: boolean; // true → returns MOCK_MIRAGES (offline testing)
}
    */
    // Query nearby
    const nearby = await queryWithinRadius({
      //collectionName: COLLECTION_NAME,
      center: this.currentUserPos,
      radiusMeters: QUERY_RADIUS,
      teamId: "somerandomOne",
      userId: "SomesomerandomOneone",
      endpoint: "/api/arugh", 
    });

    // Add cubes for each
    const geom = new THREE.BoxGeometry(3, 3, 3); // Shared for perf
    for (const loc of nearby) {
      const material = new THREE.MeshBasicMaterial({ color: loc.color });
      const mesh = new THREE.Mesh(geom, material);
      mesh.userData = loc; // Store full cube data
      this.locar.add(mesh, loc.lng, loc.lat); // Absolute coords
      this.activeCubes.set(loc.id, mesh);
    }

    // console.log(`Loaded ${nearby.length} mirages within ${QUERY_RADIUS}m`);
    this.lastQueryTime = now;
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
    console.log(JSON.stringify(cubeData));
    this.onCubeClick?.(cubeData);
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

  // Cleanup (call on unmount)
  destroy() {
    this.clearCubes();
    // Removed window.removeEventListener - anonymous func; re-add named if needed
    this.locar.stopGps?.(); // Optional chaining for safety
    // Removed this.cam.stop?.(); - no method
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