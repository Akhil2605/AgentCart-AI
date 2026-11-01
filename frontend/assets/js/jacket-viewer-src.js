import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * AgentCart AI - Interactive 3D Jacket Showcase Viewer
 * High-definition WebGL viewer with smooth 360-degree mouse tracking,
 * touch gestures, PBR physical lighting, and responsive framing.
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
    // Front faces camera at yaw = 0
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

    // Event listeners for control buttons
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

    // Scene
    this.scene = new THREE.Scene();

    // Camera (Telephoto 38° FOV for authentic studio look)
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 50);
    this.camera.position.set(0, 0, this.baseCameraDist);

    // Renderer
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
    // 1. Balanced cool ambient fill (deep midnight tone with fold clarity)
    const ambientLight = new THREE.AmbientLight(0x1a243a, 1.25);
    this.scene.add(ambientLight);

    // 2. Front-right Key Light (Crisp daylight)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3, 4, 3.5);
    this.scene.add(keyLight);

    // 3. Front-left Soft Fill (Diffuses shadows)
    const fillLight = new THREE.DirectionalLight(0x90b8e8, 1.5);
    fillLight.position.set(-3, 2, 2.5);
    this.scene.add(fillLight);

    // 4. Rear Electric Blue Rim/Backlight (Faithful to reference photograph)
    const rimLight = new THREE.DirectionalLight(0x00b4ff, 3.2);
    rimLight.position.set(0, 4, -3.5);
    this.scene.add(rimLight);

    // 5. Subtle Bottom Bounce Light
    const bounceLight = new THREE.DirectionalLight(0x0a3b75, 1.0);
    bounceLight.position.set(0, -3, 2);
    this.scene.add(bounceLight);

    // 6. Ground Shadow Disc
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

    // Remove any extraneous embedded lights
    const toRemove = [];
    this.model.traverse((child) => {
      if (child.isLight) toRemove.push(child);
    });
    toRemove.forEach((light) => light.parent && light.parent.remove(light));

    // Enhance materials with physical PBR properties
    this.enhanceMaterials(this.model);

    // Compute bounding box & center geometry
    const box = new THREE.Box3().setFromObject(this.model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.model.position.x = -center.x;
    this.model.position.y = -center.y;
    this.model.position.z = -center.z;

    this.pivot = new THREE.Group();
    this.pivot.add(this.model);

    // Normalize scale so height is 1.0 unit
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = 1.05 / maxDim;
      this.pivot.scale.set(scale, scale, scale);
    }

    this.pivot.position.y = 0.04;
    this.pivot.rotation.y = this.yaw;

    this.scene.add(this.pivot);

    // Hide loader
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

          // Keep color neutral white so texture map values are reproduced with pristine fidelity
          mat.color = new THREE.Color(0xffffff);

          if (name.includes('zipper')) {
            // Bright electric blue zipper track & teeth
            mat.roughness = 0.28;
            mat.metalness = 0.48;
            mat.emissive = new THREE.Color(0x0044aa);
            mat.emissiveIntensity = 0.35;
          } else if (name.includes('accent')) {
            // Electric blue piping & seam lines
            mat.roughness = 0.35;
            mat.metalness = 0.22;
            mat.emissive = new THREE.Color(0x003388);
            mat.emissiveIntensity = 0.25;
          } else {
            // Main Technical Ripstop Fabric (Hood, sleeves, pockets, body)
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

    // Mouse Move: Smooth natural 360-degree rotation according to mouse position
    el.addEventListener('mousemove', (e) => {
      if (this.isPointerDown) return;

      const rect = el.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 to +1
      const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1; // -1 to +1

      // Moving mouse left rotates towards left; right rotates towards right
      // Base orientation is Math.PI (front)
      this.targetYaw = this.baseYaw + normX * Math.PI;
      // Subtle vertical viewing angle adjustment
      this.targetPitch = -normY * 0.26;

      this.lastInteractionTime = Date.now();
    });

    // Pointer Events for Click-and-Drag Rotation
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

    // Mobile Pinch Zoom
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

    // Scroll Wheel Smooth Zoom
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY * -0.0012;
      this.targetZoom = Math.max(0.75, Math.min(1.35, this.targetZoom + zoomDelta));
      this.lastInteractionTime = Date.now();
    }, { passive: false });

    // Resize Observer
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

    // Gentle ambient auto-rotation after idle
    if (!this.isHovering && !this.isPointerDown && idleTime > 4500 && !this.prefersReducedMotion) {
      this.targetYaw += this.autoRotateSpeed;
      this.baseYaw = this.targetYaw;
    }

    // Drag inertia release
    if (!this.isPointerDown && Math.abs(this.dragVelocityX) > 0.0001) {
      this.targetYaw += this.dragVelocityX;
      this.baseYaw = this.targetYaw;
      this.dragVelocityX *= 0.92;
    }

    // Damping Interpolation (smooth lerp)
    const damping = this.prefersReducedMotion ? 0.2 : 0.075;
    this.yaw += (this.targetYaw - this.yaw) * damping;
    this.pitch += (this.targetPitch - this.pitch) * damping;
    this.zoom += (this.targetZoom - this.zoom) * damping;

    // Update Model
    if (this.pivot) {
      this.pivot.rotation.y = this.yaw;
      this.pivot.rotation.x = this.pitch;

      if (!this.isPointerDown && !this.isHovering && !this.prefersReducedMotion) {
        this.pivot.position.y = 0.04 + Math.sin(now * 0.0018) * 0.015;
      }
    }

    // Update Camera Zoom
    if (this.camera) {
      this.camera.position.z = this.baseCameraDist / this.zoom;
    }

    // Render
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

// Global initialization
window.JacketViewer = JacketViewer;
window.initJacketViewer = function(containerSelector = '#heroJacketContainer', options = {}) {
  return new JacketViewer({
    container: containerSelector,
    modelUrl: 'assets/models/jacket.glb',
    ...options
  });
};
