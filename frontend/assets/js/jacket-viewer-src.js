import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * ============================================================================
 * AgentCart AI - 3D Product Mapping Catalog
 * Complete architectural audit and mapping for all 24 technical jackets.
 * ============================================================================
 */
export const PRODUCT_3D_MAPPING = {
  'cyber-shell-black': {
    name: 'CyberShell Pro Stormbreaker',
    model: 'cyber',
    baseModelUrl: 'assets/models/jacket.glb',
    defaultHex: '#0a111e',
    zipperHex: '#00d4ff',
    accentHex: '#00c8ff',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Exact match to Cyber Technical Windbreaker geometry'
  },
  'alpine-white-shell': {
    name: 'Alpine Shift Hardshell',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#f1f5f9',
    zipperHex: '#1e293b',
    accentHex: '#1e293b',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Exact match to Alpine Hardshell geometry'
  },
  'ranger-olive-tactical': {
    name: 'Ranger Exo Tactical Shell',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#4b5320',
    zipperHex: '#1a1f14',
    accentHex: '#84cc16',
    roughness: 0.84,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine hardshell silhouette with tactical olive body and cyber lime pulls'
  },
  'apex-blaze-orange': {
    name: 'Apex Signal Hi-Vis Shell',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#ea580c',
    zipperHex: '#18181b',
    accentHex: '#18181b',
    roughness: 0.80,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine hardshell silhouette with high-vis blaze orange and black contrast zips'
  },
  'neon-pulse-magenta': {
    name: 'Neon Pulse City Windcoat',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#ec4899',
    zipperHex: '#111827',
    accentHex: '#111827',
    roughness: 0.80,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine hardshell silhouette with cyber magenta body and black waterproof zips'
  },
  'shadow-camo-stealth': {
    name: 'Shadow Camo Stealth Parka',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#27272a',
    zipperHex: '#09090b',
    accentHex: '#09090b',
    roughness: 0.85,
    metalness: 0.03,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine hardshell silhouette with dark shadow charcoal fabric and matte jet zips'
  },
  'stealth-bomber-ma1': {
    name: 'AeroMA-1 Technical Bomber',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#1e293b',
    zipperHex: '#0f172a',
    accentHex: '#ea580c',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Photograph depicts a hooded technical shell in midnight navy with black hardware'
  },
  'veloce-commuter-softshell': {
    name: 'Veloce Commuter Softshell',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#334155',
    zipperHex: '#18181b',
    accentHex: '#18181b',
    roughness: 0.86,
    metalness: 0.02,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine hardshell silhouette with slate charcoal heather finish'
  },
  'arctic-expedition-down': {
    name: 'Arctic Expedition 800 Down',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#b91c1c',
    zipperHex: '#0f172a',
    accentHex: '#0f172a',
    roughness: 0.80,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Photograph depicts an alpine storm shell in crimson glacier with black contrast'
  },
  'quantum-ripstop-trench': {
    name: 'Quantum Ripstop Rain Trench',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#cbd5e1',
    zipperHex: '#1e293b',
    accentHex: '#1e293b',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine hardshell silhouette with glacier mist icy blue and black zips'
  },
  'raw-cyber-denim': {
    name: 'Raw Selvedge Cyber Denim',
    model: 'cyber',
    baseModelUrl: 'assets/models/jacket.glb',
    defaultHex: '#1e3a5f',
    zipperHex: '#00b4ff',
    accentHex: '#00e5ff',
    roughness: 0.85,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Cyber windbreaker silhouette with deep raw indigo fabric and electric blue piping'
  },
  'aerogrid-windrunner': {
    name: 'AeroGrid Ultralight Windrunner',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#a3e635',
    zipperHex: '#374151',
    accentHex: '#374151',
    roughness: 0.80,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine hardshell silhouette with cyber volt lime and graphite contrast zips'
  },
  'hyperion-mountain-shell': {
    name: 'Hyperion 3L Expedition Shell',
    model: 'cyber',
    baseModelUrl: 'assets/models/jacket.glb',
    defaultHex: '#0b172a',
    zipperHex: '#06b6d4',
    accentHex: '#22d3ee',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Cyber windbreaker silhouette with abyssal navy fabric and electric cyan accents'
  },
  'obsidian-tactical-bomber': {
    name: 'Obsidian Tactical Bomber',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#111827',
    zipperHex: '#1f2937',
    accentHex: '#1f2937',
    roughness: 0.84,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine hardshell silhouette with matte jet obsidian fabric and gunmetal zips'
  },
  'glacier-puffer-anorak': {
    name: 'Glacier Down Puffer Anorak',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#f0f9ff',
    zipperHex: '#0f172a',
    accentHex: '#7dd3fc',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine hardshell silhouette in frost glacier ice white with black zips'
  },
  'subzero-thermal-parka': {
    name: 'Sub-Zero Thermal Heavy Parka',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#475569',
    zipperHex: '#09090b',
    accentHex: '#09090b',
    roughness: 0.84,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine storm shell silhouette in gunmetal slate grey with black void zips'
  },
  'metro-minimalist-windcoat': {
    name: 'Metro Minimalist City Windcoat',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#7c3aed',
    zipperHex: '#334155',
    accentHex: '#334155',
    roughness: 0.80,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine minimalist silhouette in cyber violet purple with matte slate zips'
  },
  'cobalt-storm-shield': {
    name: 'Cobalt Storm Shield Shell',
    model: 'cyber',
    baseModelUrl: 'assets/models/jacket.glb',
    defaultHex: '#1e3a8a',
    zipperHex: '#38bdf8',
    accentHex: '#60a5fa',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Cyber windbreaker silhouette with vibrant cobalt blue fabric and electric sky piping'
  },
  'terra-hybrid-trekker': {
    name: 'Terra Hybrid Trekker Jacket',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#d97706',
    zipperHex: '#1e293b',
    accentHex: '#1e293b',
    roughness: 0.84,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine trekking silhouette in desert coyote khaki with dark contrast zips'
  },
  'carbon-denim-biker': {
    name: 'Carbon Waxed Denim Biker',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#1c1917',
    zipperHex: '#292524',
    accentHex: '#292524',
    roughness: 0.85,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine technical silhouette in waxed carbon black with dark asphalt zips'
  },
  'nimbus-packable-rain': {
    name: 'Nimbus Packable Emerald Anorak',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#059669',
    zipperHex: '#1f2937',
    accentHex: '#1f2937',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine rain silhouette in emerald tech green with charcoal black zips'
  },
  'zenith-urban-shell': {
    name: 'Zenith Amber Everyday Shell',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#d97706',
    zipperHex: '#1e293b',
    accentHex: '#1e293b',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine shell silhouette in warm amber gold with slate navy contrast zips'
  },
  'solstice-thermo-down': {
    name: 'Solstice Thermo Quilted Down',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#c2410c',
    zipperHex: '#18181b',
    accentHex: '#18181b',
    roughness: 0.82,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine shell silhouette in rust amber bronze with midnight charcoal contrast'
  },
  'vanguard-field-jacket': {
    name: 'Vanguard Combat Tech Field Jacket',
    model: 'alpine',
    baseModelUrl: 'assets/models/white-jacket.glb',
    defaultHex: '#273627',
    zipperHex: '#18181b',
    accentHex: '#18181b',
    roughness: 0.85,
    metalness: 0.04,
    suitable: true,
    requiresExtraGeometry: false,
    notes: 'Alpine combat silhouette in woodland combat green with dark stealth hardware'
  }
};

/**
 * ============================================================================
 * 1. HERO SECTION 3D JACKET VIEWER (MAIN STARTING JACKET)
 * CRITICAL: Completely preserved without modification.
 * ============================================================================
 */
export class JacketViewer {
  constructor(options = {}) {
    this.container = typeof options.container === 'string'
      ? document.querySelector(options.container)
      : options.container;

    if (!this.container) {
      console.warn('[JacketViewer] Container element not found.');
      return;
    }

    this.modelUrl = options.modelUrl || 'assets/models/jacket.glb';
    this.onLoad = options.onLoad || null;
    this.onError = options.onError || null;

    // State & Animation
    this.model = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.animId = null;
    this.isDisposed = false;

    // Rotation angles (radians)
    this.baseYaw = 0;
    this.yaw = 0;
    this.targetYaw = 0;
    this.pitch = 0;
    this.targetPitch = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.baseCameraDist = 2.05;

    // Interaction states
    this.isPointerDown = false;
    this.pointerStartX = 0;
    this.pointerStartY = 0;
    this.prevPointerX = 0;
    this.prevPointerY = 0;
    this.dragVelocityX = 0;
    this.dragVelocityY = 0;
    this.isHovering = false;
    this.lastInteractionTime = Date.now();
    this.autoRotateSpeed = 0.0035;
    this.autoRotateEnabled = true;

    // Mobile pinch zoom
    this.initialPinchDistance = null;

    // Accessibility
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.init();
  }

  init() {
    this.createDomElements();
    this.initThree();
    this.initLighting();
    this.initEvents();
    this.loadModel();
    this.animate();
  }

  createDomElements() {
    this.container.style.position = 'relative';
    this.container.classList.add('jacket-3d-active');

    // Canvas container
    this.canvasWrap = document.createElement('div');
    this.canvasWrap.className = 'jacket-3d-canvas-wrap';
    this.canvasWrap.setAttribute('role', 'region');
    this.canvasWrap.setAttribute('aria-label', 'Interactive 3D Jacket Showcase. Drag or move mouse to rotate.');

    // Loading overlay
    this.loaderEl = document.createElement('div');
    this.loaderEl.className = 'jacket-3d-loader';
    this.loaderEl.innerHTML = `
      <div class="jacket-loader-spinner"></div>
      <div class="jacket-loader-text">
        <span class="jacket-loader-title">INITIALIZING 3D SHELL</span>
        <span class="jacket-loader-sub" id="jacketLoaderProgress">LOADING ASSETS...</span>
      </div>
    `;

    // Interactive badge / hint
    this.badgeEl = document.createElement('div');
    this.badgeEl.className = 'jacket-3d-badge';
    this.badgeEl.innerHTML = `
      <svg class="jacket-3d-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      <span>360° INTERACTIVE</span>
    `;

    // Controls bar (reset view, auto-rotate toggle)
    this.controlsEl = document.createElement('div');
    this.controlsEl.className = 'jacket-3d-controls';
    this.controlsEl.innerHTML = `
      <button type="button" class="jacket-ctrl-btn" id="jacketResetViewBtn" title="Front View" aria-label="Inspect front of jacket">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        <span>FRONT</span>
      </button>
      <button type="button" class="jacket-ctrl-btn" id="jacketBackViewBtn" title="Inspect Back" aria-label="Inspect back of jacket">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
        <span>BACK</span>
      </button>
    `;

    this.container.appendChild(this.canvasWrap);
    this.container.appendChild(this.loaderEl);
    this.container.appendChild(this.badgeEl);
    this.container.appendChild(this.controlsEl);

    const resetBtn = this.controlsEl.querySelector('#jacketResetViewBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.targetYaw = 0;
        this.baseYaw = 0;
        this.targetPitch = 0;
        this.targetZoom = 1.0;
        this.dragVelocityX = 0;
        this.dragVelocityY = 0;
        this.lastInteractionTime = Date.now();
      });
    }

    const backBtn = this.controlsEl.querySelector('#jacketBackViewBtn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.targetYaw = Math.PI;
        this.baseYaw = Math.PI;
        this.targetPitch = 0;
        this.dragVelocityX = 0;
        this.dragVelocityY = 0;
        this.lastInteractionTime = Date.now();
      });
    }
  }

  initThree() {
    const width = this.canvasWrap.clientWidth || 400;
    const height = this.canvasWrap.clientHeight || 360;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    this.camera.position.set(0, 0, this.baseCameraDist);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.canvasWrap.appendChild(this.renderer.domElement);
  }

  initLighting() {
    const ambientLight = new THREE.AmbientLight(0x1a243a, 1.25);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3, 4, 3.5);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x90b8e8, 1.5);
    fillLight.position.set(-3, 2, 2.5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x00b4ff, 3.2);
    rimLight.position.set(0, 4, -3.5);
    this.scene.add(rimLight);

    const bounceLight = new THREE.DirectionalLight(0x0a3b75, 1.0);
    bounceLight.position.set(0, -3, 2);
    this.scene.add(bounceLight);

    this.createShadowDisc();
  }

  createShadowDisc() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 120);
    grad.addColorStop(0, 'rgba(10, 20, 35, 0.45)');
    grad.addColorStop(0.5, 'rgba(10, 20, 35, 0.16)');
    grad.addColorStop(1, 'rgba(10, 20, 35, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(1.4, 0.7);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85
    });

    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = -0.58;
    this.scene.add(this.shadowMesh);
  }

  loadModel() {
    const loader = new GLTFLoader();
    const progressEl = this.loaderEl.querySelector('#jacketLoaderProgress');

    loader.load(
      this.modelUrl,
      (gltf) => {
        if (this.isDisposed) return;
        this.onModelLoaded(gltf);
      },
      (xhr) => {
        if (xhr.lengthComputable && progressEl) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          progressEl.textContent = `${pct}% LOADED`;
        }
      },
      (error) => {
        console.error('[JacketViewer] Model load failed:', error);
        if (this.loaderEl) {
          this.loaderEl.innerHTML = `
            <div class="jacket-loader-error">
              <span>UNABLE TO LOAD 3D MODEL</span>
              <button type="button" class="jacket-retry-btn" id="jacketRetryBtn">RETRY</button>
            </div>
          `;
          const retryBtn = this.loaderEl.querySelector('#jacketRetryBtn');
          if (retryBtn) {
            retryBtn.addEventListener('click', () => {
              this.loaderEl.innerHTML = `
                <div class="jacket-loader-spinner"></div>
                <div class="jacket-loader-text">
                  <span class="jacket-loader-title">INITIALIZING 3D SHELL</span>
                  <span class="jacket-loader-sub" id="jacketLoaderProgress">CONNECTING...</span>
                </div>
              `;
              this.loadModel();
            });
          }
        }
        if (this.onError) this.onError(error);
      }
    );
  }

  onModelLoaded(gltf) {
    this.model = gltf.scene;

    const toRemove = [];
    this.model.traverse((child) => {
      if (child.isLight) toRemove.push(child);
    });
    toRemove.forEach((light) => light.parent && light.parent.remove(light));

    this.enhanceMaterials(this.model);

    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.model.position.x = -center.x;
    this.model.position.y = -center.y;
    this.model.position.z = -center.z;

    this.pivot = new THREE.Group();
    this.pivot.add(this.model);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 1.05 / maxDim;
      this.pivot.scale.set(scale, scale, scale);
    }

    this.pivot.position.y = 0.04;
    this.pivot.rotation.y = this.yaw;

    this.scene.add(this.pivot);

    if (this.loaderEl) {
      this.loaderEl.classList.add('fade-out');
      setTimeout(() => {
        if (this.loaderEl && this.loaderEl.parentNode) {
          this.loaderEl.style.display = 'none';
        }
      }, 450);
    }

    if (this.onLoad) this.onLoad(this);

    this.handleResize();
  }

  enhanceMaterials(object) {
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const processMaterial = (mat) => {
          if (!mat) return mat;

          if (mat.map) {
            mat.map.anisotropy = maxAnisotropy;
            mat.map.minFilter = THREE.LinearMipmapLinearFilter;
            mat.map.magFilter = THREE.LinearFilter;
            mat.map.generateMipmaps = true;
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.needsUpdate = true;
          }

          const name = (mat.name || '').toLowerCase();
          mat.color = new THREE.Color(0xffffff);

          if (name.includes('zipper')) {
            mat.roughness = 0.28;
            mat.metalness = 0.48;
            mat.emissive = new THREE.Color(0x0044aa);
            mat.emissiveIntensity = 0.35;
          } else if (name.includes('accent')) {
            mat.roughness = 0.35;
            mat.metalness = 0.22;
            mat.emissive = new THREE.Color(0x003388);
            mat.emissiveIntensity = 0.25;
          } else {
            mat.roughness = 0.82;
            mat.metalness = 0.04;
            mat.emissive = new THREE.Color(0x000000);
            mat.emissiveIntensity = 0.0;
          }

          mat.needsUpdate = true;
          return mat;
        };

        if (Array.isArray(child.material)) {
          child.material = child.material.map(processMaterial);
        } else {
          child.material = processMaterial(child.material);
        }
      }
    });
  }

  initEvents() {
    const el = this.container;

    el.addEventListener('mouseenter', () => {
      this.isHovering = true;
      this.autoRotateEnabled = false;
    });

    el.addEventListener('mouseleave', () => {
      this.isHovering = false;
      this.isPointerDown = false;
      this.lastInteractionTime = Date.now();
    });

    el.addEventListener('mousemove', (e) => {
      if (this.isPointerDown) return;

      const rect = el.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      this.targetYaw = this.baseYaw + normX * Math.PI;
      this.targetPitch = -normY * 0.26;
      this.lastInteractionTime = Date.now();
    });

    el.addEventListener('pointerdown', (e) => {
      this.isPointerDown = true;
      this.autoRotateEnabled = false;
      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;
      this.dragVelocityX = 0;
      this.dragVelocityY = 0;
      this.lastInteractionTime = Date.now();
      el.style.cursor = 'grabbing';
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown) return;

      const deltaX = e.clientX - this.prevPointerX;
      const deltaY = e.clientY - this.prevPointerY;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;

      const speed = 0.0075;
      this.targetYaw += deltaX * speed;
      this.baseYaw = this.targetYaw;
      this.targetPitch = Math.max(-0.45, Math.min(0.45, this.targetPitch - deltaY * speed * 0.6));

      this.dragVelocityX = deltaX * speed;
      this.dragVelocityY = deltaY * speed;
      this.lastInteractionTime = Date.now();
    });

    const endDrag = (e) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      el.style.cursor = 'grab';
      this.lastInteractionTime = Date.now();
      if (el.releasePointerCapture && e.pointerId) {
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.initialPinchDistance = Math.hypot(dx, dy);
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.initialPinchDistance) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / this.initialPinchDistance;
        this.targetZoom = Math.max(0.75, Math.min(1.4, this.targetZoom * factor));
        this.initialPinchDistance = dist;
      }
    }, { passive: true });

    el.addEventListener('touchend', () => {
      this.initialPinchDistance = null;
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * -0.0012;
      this.targetZoom = Math.max(0.75, Math.min(1.35, this.targetZoom + zoomDelta));
      this.lastInteractionTime = Date.now();
    }, { passive: false });

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  handleResize() {
    if (!this.renderer || !this.camera || !this.canvasWrap) return;
    const width = this.canvasWrap.clientWidth || 400;
    const height = this.canvasWrap.clientHeight || 360;

    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;

    if (width < 480) {
      this.baseCameraDist = 2.35;
    } else if (width < 768) {
      this.baseCameraDist = 2.15;
    } else {
      this.baseCameraDist = 2.0;
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    if (this.isDisposed) return;

    this.animId = requestAnimationFrame(() => this.animate());

    const now = Date.now();
    const idleTime = now - this.lastInteractionTime;

    if (!this.isHovering && !this.isPointerDown && idleTime > 4500 && !this.prefersReducedMotion) {
      this.targetYaw += this.autoRotateSpeed;
      this.baseYaw = this.targetYaw;
    }

    if (!this.isPointerDown && Math.abs(this.dragVelocityX) > 0.0001) {
      this.targetYaw += this.dragVelocityX;
      this.baseYaw = this.targetYaw;
      this.dragVelocityX *= 0.92;
    }

    const damping = this.prefersReducedMotion ? 0.2 : 0.075;
    this.yaw += (this.targetYaw - this.yaw) * damping;
    this.pitch += (this.targetPitch - this.pitch) * damping;
    this.zoom += (this.targetZoom - this.zoom) * damping;

    if (this.pivot) {
      this.pivot.rotation.y = this.yaw;
      this.pivot.rotation.x = this.pitch;

      if (!this.isPointerDown && !this.isHovering && !this.prefersReducedMotion) {
        this.pivot.position.y = 0.04 + Math.sin(now * 0.0018) * 0.015;
      }
    }

    if (this.camera) {
      this.camera.position.z = this.baseCameraDist / this.zoom;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.isDisposed = true;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.resizeObserver) this.resizeObserver.disconnect();

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        }
      });
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }

    [this.canvasWrap, this.loaderEl, this.badgeEl, this.controlsEl].forEach((el) => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }
}

/**
 * ============================================================================
 * 2. MODAL 3D JACKET VIEWER (REUSABLE FOR ALL 24 JACKETS)
 * Supports dynamic model switching, colorway updates, caching & lifecycle.
 * ============================================================================
 */
export class ModalJacketViewer {
  constructor(options = {}) {
    this.container = typeof options.container === 'string'
      ? document.querySelector(options.container)
      : options.container;

    if (!this.container) {
      console.warn('[ModalJacketViewer] Container element not found.');
      return;
    }

    // Geometry Caching to eliminate repeated parsing & network fetches
    this.modelCache = new Map();
    this.loader = new GLTFLoader();

    this.activeProduct = null;
    this.activeColor = null;
    this.activeModel = null;
    this.pivot = null;

    // View state
    this.baseYaw = 0;
    this.yaw = 0;
    this.targetYaw = 0;
    this.pitch = 0;
    this.targetPitch = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.baseCameraDist = 2.15;

    // Interaction states
    this.isPointerDown = false;
    this.pointerStartX = 0;
    this.pointerStartY = 0;
    this.prevPointerX = 0;
    this.prevPointerY = 0;
    this.dragVelocityX = 0;
    this.dragVelocityY = 0;
    this.isHovering = false;
    this.lastInteractionTime = Date.now();
    this.autoRotateSpeed = 0.0035;

    this.initialPinchDistance = null;
    this.isPaused = true;
    this.isDisposed = false;
    this.animId = null;

    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.init();
  }

  init() {
    this.createDomElements();
    this.initThree();
    this.initLighting();
    this.initEvents();
  }

  createDomElements() {
    this.container.style.position = 'relative';
    this.container.classList.add('modal-jacket-3d-active');

    this.canvasWrap = document.createElement('div');
    this.canvasWrap.className = 'modal-3d-canvas-wrap';
    this.canvasWrap.setAttribute('role', 'region');
    this.canvasWrap.setAttribute('aria-label', '3D Interactive Product Viewer. Drag to inspect.');

    this.loaderEl = document.createElement('div');
    this.loaderEl.className = 'modal-3d-loader';
    this.loaderEl.innerHTML = `
      <div class="jacket-loader-spinner"></div>
      <div class="jacket-loader-text">
        <span class="jacket-loader-title">LOADING 3D SHELL</span>
        <span class="jacket-loader-sub" id="modalLoaderProgress">PARSING GEOMETRY...</span>
      </div>
    `;

    this.badgeEl = document.createElement('div');
    this.badgeEl.className = 'modal-3d-badge';
    this.badgeEl.innerHTML = `
      <svg class="jacket-3d-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      <span>360° INTERACTIVE</span>
    `;

    this.controlsEl = document.createElement('div');
    this.controlsEl.className = 'modal-3d-controls';
    this.controlsEl.innerHTML = `
      <button type="button" class="jacket-ctrl-btn" id="modalResetViewBtn" title="Front View" aria-label="Inspect front">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        <span>FRONT</span>
      </button>
      <button type="button" class="jacket-ctrl-btn" id="modalBackViewBtn" title="Back View" aria-label="Inspect back">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
        <span>BACK</span>
      </button>
    `;

    this.container.appendChild(this.canvasWrap);
    this.container.appendChild(this.loaderEl);
    this.container.appendChild(this.badgeEl);
    this.container.appendChild(this.controlsEl);

    const resetBtn = this.controlsEl.querySelector('#modalResetViewBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.targetYaw = 0;
        this.baseYaw = 0;
        this.targetPitch = 0;
        this.targetZoom = 1.0;
        this.dragVelocityX = 0;
        this.dragVelocityY = 0;
        this.lastInteractionTime = Date.now();
      });
    }

    const backBtn = this.controlsEl.querySelector('#modalBackViewBtn');
    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.targetYaw = Math.PI;
        this.baseYaw = Math.PI;
        this.targetPitch = 0;
        this.dragVelocityX = 0;
        this.dragVelocityY = 0;
        this.lastInteractionTime = Date.now();
      });
    }
  }

  initThree() {
    const width = this.canvasWrap.clientWidth || 440;
    const height = this.canvasWrap.clientHeight || 440;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    this.camera.position.set(0, 0, this.baseCameraDist);

    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;

      this.canvasWrap.appendChild(this.renderer.domElement);
    } catch (e) {
      console.warn('[ModalJacketViewer] WebGL initialization failed:', e);
      this.webGlFailed = true;
      this.showFallbackImage();
      return;
    }
  }

  initLighting() {
    const ambientLight = new THREE.AmbientLight(0x1a243a, 1.25);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3, 4, 3.5);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x90b8e8, 1.5);
    fillLight.position.set(-3, 2, 2.5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 2.8);
    rimLight.position.set(0, 4, -3.5);
    this.scene.add(rimLight);

    const bounceLight = new THREE.DirectionalLight(0x0a3b75, 1.0);
    bounceLight.position.set(0, -3, 2);
    this.scene.add(bounceLight);

    // Ground Shadow Disc
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 120);
    grad.addColorStop(0, 'rgba(10, 20, 35, 0.55)');
    grad.addColorStop(0.5, 'rgba(10, 20, 35, 0.20)');
    grad.addColorStop(1, 'rgba(10, 20, 35, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(1.5, 0.75);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85
    });

    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.y = -0.58;
    this.scene.add(this.shadowMesh);
  }

  initEvents() {
    const el = this.container;

    el.addEventListener('mouseenter', () => {
      this.isHovering = true;
    });

    el.addEventListener('mouseleave', () => {
      this.isHovering = false;
      this.isPointerDown = false;
      this.lastInteractionTime = Date.now();
    });

    el.addEventListener('mousemove', (e) => {
      if (this.isPointerDown) return;

      const rect = el.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      this.targetYaw = this.baseYaw + normX * Math.PI;
      this.targetPitch = -normY * 0.26;
      this.lastInteractionTime = Date.now();
    });

    el.addEventListener('pointerdown', (e) => {
      this.isPointerDown = true;
      this.pointerStartX = e.clientX;
      this.pointerStartY = e.clientY;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;
      this.dragVelocityX = 0;
      this.dragVelocityY = 0;
      this.lastInteractionTime = Date.now();
      el.style.cursor = 'grabbing';
      if (el.setPointerCapture) {
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPointerDown) return;

      const deltaX = e.clientX - this.prevPointerX;
      const deltaY = e.clientY - this.prevPointerY;
      this.prevPointerX = e.clientX;
      this.prevPointerY = e.clientY;

      const speed = 0.0075;
      this.targetYaw += deltaX * speed;
      this.baseYaw = this.targetYaw;
      this.targetPitch = Math.max(-0.45, Math.min(0.45, this.targetPitch - deltaY * speed * 0.6));

      this.dragVelocityX = deltaX * speed;
      this.dragVelocityY = deltaY * speed;
      this.lastInteractionTime = Date.now();
    });

    const endDrag = (e) => {
      if (!this.isPointerDown) return;
      this.isPointerDown = false;
      el.style.cursor = 'grab';
      this.lastInteractionTime = Date.now();
      if (el.releasePointerCapture && e.pointerId) {
        try { el.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this.initialPinchDistance = Math.hypot(dx, dy);
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && this.initialPinchDistance) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / this.initialPinchDistance;
        this.targetZoom = Math.max(0.75, Math.min(1.4, this.targetZoom * factor));
        this.initialPinchDistance = dist;
      }
    }, { passive: true });

    el.addEventListener('touchend', () => {
      this.initialPinchDistance = null;
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * -0.0012;
      this.targetZoom = Math.max(0.75, Math.min(1.35, this.targetZoom + zoomDelta));
      this.lastInteractionTime = Date.now();
    }, { passive: false });

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
  }

  handleResize() {
    if (!this.renderer || !this.camera || !this.canvasWrap) return;
    const width = this.canvasWrap.clientWidth || 440;
    const height = this.canvasWrap.clientHeight || 440;

    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;

    if (width < 480) {
      this.baseCameraDist = 2.45;
    } else if (width < 768) {
      this.baseCameraDist = 2.25;
    } else {
      this.baseCameraDist = 2.10;
    }

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  showFallbackImage(imgUrl = null) {
    if (this.canvasWrap) this.canvasWrap.style.display = 'none';
    if (this.loaderEl) this.loaderEl.style.display = 'none';
    if (this.badgeEl) this.badgeEl.style.display = 'none';
    if (this.controlsEl) this.controlsEl.style.display = 'none';
    const img = this.container.querySelector('#modalImg');
    if (img) {
      if (imgUrl) img.src = imgUrl;
      img.classList.remove('modal-fallback-hidden');
      img.removeAttribute('aria-hidden');
      img.style.display = 'block';
    }
  }

  async loadProduct(product, selectedColorName = null) {
    if (!product) return;

    if (this.webGlFailed) {
      this.showFallbackImage(product.image);
      return;
    }

    this.activeProduct = product;
    this.isPaused = false;
    this.resetRotation();

    // Ensure 3D canvas and controls are visible, and hide static image
    if (this.canvasWrap) this.canvasWrap.style.display = 'block';
    if (this.badgeEl) this.badgeEl.style.display = 'inline-flex';
    if (this.controlsEl) this.controlsEl.style.display = 'flex';
    const img = this.container.querySelector('#modalImg');
    if (img) {
      img.classList.add('modal-fallback-hidden');
      img.setAttribute('aria-hidden', 'true');
      img.style.display = 'none';
    }

    const mapping = PRODUCT_3D_MAPPING[product.id] || {
      model: 'alpine',
      baseModelUrl: 'assets/models/white-jacket.glb',
      defaultHex: product.colors?.[0]?.hex || '#f1f5f9'
    };

    const colorObj = (product.colors || []).find(c => c.name === selectedColorName) || product.colors?.[0];
    const hex = colorObj ? colorObj.hex : mapping.defaultHex;
    this.activeColor = hex;

    // Show loader
    if (this.loaderEl) {
      this.loaderEl.style.display = 'flex';
      this.loaderEl.classList.remove('fade-out');
      const progressEl = this.loaderEl.querySelector('#modalLoaderProgress');
      if (progressEl) progressEl.textContent = 'PREPARING 3D ASSET...';
    }

    try {
      const gltf = await this.getOrLoadModel(mapping.baseModelUrl);
      this.setupProductModel(gltf, mapping, hex);

      // Hide loader
      if (this.loaderEl) {
        this.loaderEl.classList.add('fade-out');
        setTimeout(() => {
          if (this.loaderEl) this.loaderEl.style.display = 'none';
        }, 350);
      }

      this.resume();
      this.handleResize();
    } catch (err) {
      console.error('[ModalJacketViewer] Error loading model:', err);
      if (this.loaderEl) {
        this.loaderEl.innerHTML = `
          <div class="jacket-loader-error">
            <span>UNABLE TO RENDER 3D MODEL</span>
            <button type="button" class="jacket-retry-btn" id="modalFallbackBtn" style="margin-top: 8px;">SHOW 2D IMAGE</button>
          </div>
        `;
        const fbBtn = this.loaderEl.querySelector('#modalFallbackBtn');
        if (fbBtn) {
          fbBtn.addEventListener('click', () => {
            this.showFallbackImage(product.image);
          });
        }
      }
    }
  }

  async getOrLoadModel(url) {
    if (this.modelCache.has(url)) {
      return this.modelCache.get(url);
    }

    const progressEl = this.loaderEl?.querySelector('#modalLoaderProgress');
    const p = new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => {
          resolve(gltf);
        },
        (xhr) => {
          if (xhr.lengthComputable && progressEl) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            progressEl.textContent = `${pct}% DOWNLOADED`;
          }
        },
        (error) => {
          this.modelCache.delete(url);
          reject(error);
        }
      );
    });

    this.modelCache.set(url, p);
    return p;
  }

  setupProductModel(gltf, mapping, colorHex) {
    // Remove previous model from pivot
    if (this.pivot) {
      this.scene.remove(this.pivot);
      this.pivot = null;
    }

    // Clone scene from GLTF
    const sceneClone = gltf.scene.clone(true);

    // Remove any embedded lights
    const toRemove = [];
    sceneClone.traverse((child) => {
      if (child.isLight) toRemove.push(child);
    });
    toRemove.forEach((light) => light.parent && light.parent.remove(light));

    // Clone materials so each product has independent color/roughness
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const primaryColor = new THREE.Color(colorHex);

    sceneClone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const cloneMat = (m) => {
          const mat = m.clone();
          if (mat.map) {
            mat.map = m.map; // Share texture memory
            mat.map.anisotropy = maxAnisotropy;
            mat.map.minFilter = THREE.LinearMipmapLinearFilter;
            mat.map.magFilter = THREE.LinearFilter;
            mat.map.generateMipmaps = true;
            mat.map.colorSpace = THREE.SRGBColorSpace;
          }

          const name = (mat.name || '').toLowerCase();

          if (mapping.model === 'alpine') {
            // Alpine model: White fabric base with black zippers & hardware
            // Tint fabric with exact colorway hex
            mat.color = primaryColor;
            mat.roughness = mapping.roughness || 0.82;
            mat.metalness = mapping.metalness || 0.04;
          } else {
            // Cyber model: Multi-material setup
            if (name.includes('zipper')) {
              mat.color = new THREE.Color(mapping.zipperHex || 0x00d4ff);
              mat.roughness = 0.28;
              mat.metalness = 0.48;
              mat.emissive = new THREE.Color(mapping.zipperHex || 0x0044aa);
              mat.emissiveIntensity = 0.35;
            } else if (name.includes('accent')) {
              mat.color = new THREE.Color(mapping.accentHex || 0x00c8ff);
              mat.roughness = 0.35;
              mat.metalness = 0.22;
              mat.emissive = new THREE.Color(mapping.accentHex || 0x003388);
              mat.emissiveIntensity = 0.25;
            } else {
              mat.color = primaryColor;
              mat.roughness = mapping.roughness || 0.82;
              mat.metalness = mapping.metalness || 0.04;
            }
          }

          mat.needsUpdate = true;
          return mat;
        };

        if (Array.isArray(child.material)) {
          child.material = child.material.map(cloneMat);
        } else {
          child.material = cloneMat(child.material);
        }
      }
    });

    // Center & Normalize Scale
    const box = new THREE.Box3().setFromObject(sceneClone);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    sceneClone.position.x = -center.x;
    sceneClone.position.y = -center.y;
    sceneClone.position.z = -center.z;

    this.pivot = new THREE.Group();
    this.pivot.add(sceneClone);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 1.05 / maxDim;
      this.pivot.scale.set(scale, scale, scale);
    }

    this.pivot.position.y = 0.04;
    this.pivot.rotation.y = this.yaw;

    this.scene.add(this.pivot);
    this.activeModel = sceneClone;
  }

  updateColor(colorNameOrHex) {
    if (!this.activeProduct || !this.activeModel) return;

    let hex = null;
    if (typeof colorNameOrHex === 'string') {
      if (colorNameOrHex.startsWith('#')) {
        hex = colorNameOrHex;
      } else {
        const colorObj = (this.activeProduct.colors || []).find(
          c => c.name.toLowerCase() === colorNameOrHex.toLowerCase()
        );
        if (colorObj) hex = colorObj.hex;
      }
    }
    if (!hex) return;

    const newColor = new THREE.Color(hex);
    this.activeColor = hex;

    this.activeModel.traverse((child) => {
      if (child.isMesh) {
        const updateMat = (mat) => {
          const name = (mat.name || '').toLowerCase();
          // For cyber model, don't overwrite zippers/accents with fabric color
          if (!name.includes('zipper') && !name.includes('accent')) {
            mat.color = newColor;
            mat.needsUpdate = true;
          }
        };

        if (Array.isArray(child.material)) {
          child.material.forEach(updateMat);
        } else {
          updateMat(child.material);
        }
      }
    });
  }

  resetRotation() {
    this.yaw = 0;
    this.targetYaw = 0;
    this.baseYaw = 0;
    this.pitch = 0;
    this.targetPitch = 0;
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.dragVelocityX = 0;
    this.dragVelocityY = 0;
    this.lastInteractionTime = Date.now();
  }

  resume() {
    if (this.isDisposed) return;
    this.isPaused = false;
    if (!this.animId) {
      this.animate();
    }
  }

  pause() {
    this.isPaused = true;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  animate() {
    if (this.isDisposed || this.isPaused) return;

    this.animId = requestAnimationFrame(() => this.animate());

    const now = Date.now();
    const idleTime = now - this.lastInteractionTime;

    if (!this.isHovering && !this.isPointerDown && idleTime > 4500 && !this.prefersReducedMotion) {
      this.targetYaw += this.autoRotateSpeed;
      this.baseYaw = this.targetYaw;
    }

    if (!this.isPointerDown && Math.abs(this.dragVelocityX) > 0.0001) {
      this.targetYaw += this.dragVelocityX;
      this.baseYaw = this.targetYaw;
      this.dragVelocityX *= 0.92;
    }

    const damping = this.prefersReducedMotion ? 0.2 : 0.075;
    this.yaw += (this.targetYaw - this.yaw) * damping;
    this.pitch += (this.targetPitch - this.pitch) * damping;
    this.zoom += (this.targetZoom - this.zoom) * damping;

    if (this.pivot) {
      this.pivot.rotation.y = this.yaw;
      this.pivot.rotation.x = this.pitch;

      if (!this.isPointerDown && !this.isHovering && !this.prefersReducedMotion) {
        this.pivot.position.y = 0.04 + Math.sin(now * 0.0018) * 0.015;
      }
    }

    if (this.camera) {
      this.camera.position.z = this.baseCameraDist / this.zoom;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    this.isDisposed = true;
    this.pause();
    if (this.resizeObserver) this.resizeObserver.disconnect();

    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (obj.material.map) obj.material.map.dispose();
            obj.material.dispose();
          }
        }
      });
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}

// Global initialization helpers
window.JacketViewer = JacketViewer;
window.ModalJacketViewer = ModalJacketViewer;
window.PRODUCT_3D_MAPPING = PRODUCT_3D_MAPPING;

window.initJacketViewer = function(containerSelector = '#heroJacketContainer', options = {}) {
  return new JacketViewer({
    container: containerSelector,
    modelUrl: 'assets/models/jacket.glb',
    ...options
  });
};

window.initModalJacketViewer = function(containerSelector = '#modalJacketContainer', options = {}) {
  return new ModalJacketViewer({
    container: containerSelector,
    ...options
  });
};
