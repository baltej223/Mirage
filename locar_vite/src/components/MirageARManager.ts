// @ts-ignore
import * as THREE from 'three';
import * as LocAR from 'locar'; // Or CDN import as before
import { queryWithinRadius } from '../services/firestoreGeoQuery';

const COLLECTION_NAME = 'mirage-locations';
const QUERY_RADIUS = 25; // meters
const QUERY_THROTTLE_MS = 0; // Re-query every 5s on GPS updates

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

  constructor(container: HTMLElement) {
    this.container = container;
    this.initAR();
  }

  private initAR() {
    // Camera (your code)
    this.camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.001, 1000);

    // Renderer (mount to container instead of body)
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    // Scene & LocAR
    this.scene = new THREE.Scene();
    this.locar = new LocAR.LocationBased(this.scene, this.camera);

    // Webcam (no explicit start; events trigger auto-init)
    this.cam = new LocAR.Webcam({ video: { facingMode: 'environment' } });
    this.cam.on('webcamstarted', (ev) => { this.scene.background = ev.texture; });
    this.cam.on('webcamerror', (error) => { console.error('Webcam error:', error); });
    // Removed this.cam.start(); - auto-handled by LocAR

    // Resize
    const handleResize = () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    // Device Orientation
    this.deviceOrientationControls = new LocAR.DeviceOrientationControls(this.camera);
    this.deviceOrientationControls.on('deviceorientationgranted', (ev) => { ev.target.connect(); });
    this.deviceOrientationControls.on('deviceorientationerror', (error) => { console.error('Orientation error:', error); });
    this.deviceOrientationControls.init();

    // GPS Events
    this.locar.on('gpserror', (error) => { console.error('GPS error:', error); });
    this.locar.on('gpsupdate', (ev) => { this.handleGpsUpdate(ev); });
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

    // Query nearby
    const nearby = await queryWithinRadius({
      collectionName: COLLECTION_NAME,
      center: this.currentUserPos,
      radiusMeters: QUERY_RADIUS,
    });

    // Add cubes for each
    const geom = new THREE.BoxGeometry(10, 10, 10); // Shared for perf
    for (const loc of nearby) {
      const material = new THREE.MeshBasicMaterial({ color: loc.color });
      const mesh = new THREE.Mesh(geom, material);
      this.locar.add(mesh, loc.lng, loc.lat); // Absolute coords
      this.activeCubes.set(loc.id, mesh);
    }

    console.log(`Loaded ${nearby.length} mirages within ${QUERY_RADIUS}m`);
    this.lastQueryTime = now;
  }

  private clearCubes() {
    this.activeCubes.forEach((mesh) => {  // Fixed: forEach avoids iteration TS error
      this.scene.remove(mesh);  // Fixed: Manual scene remove (no locar.remove)
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
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
    this.locar.stopGps?.();  // Optional chaining for safety
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