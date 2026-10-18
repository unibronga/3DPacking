// 3D-вьюпорт: бесконечная сетка, контейнеры и вложенные объекты,
// выбор кликом, перелёт камеры к объекту, перемещение гизмо.
// 1 единица сцены = 1 м; в данных — сантиметры.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as store from './store.js';
import { t } from './i18n.js';

const CM = 0.01;
const WALL_PAD = 0.003; // м
const EDGE_GEO = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const fmt = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');

// Сетка как в 3D-редакторе: мелкая клетка 10 см, крупная 1 м, оси X/Z цветом,
// плавно гаснет к горизонту.
function makeGrid() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCam: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color(0xb9b0e0) },
      uFade: { value: 40 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCam; uniform vec3 uColor; uniform float uFade;
      varying vec3 vWorld;
      float line(vec2 p, float s) {
        vec2 c = p / s;
        vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }
      void main() {
        vec2 p = vWorld.xz;
        float h = max(abs(uCam.y), 0.5);
        float minor = line(p, 0.1) * (1.0 - smoothstep(3.0, 14.0, h));
        float major = line(p, 1.0);
        float d = length(p - uCam.xz);
        float fade = 1.0 - smoothstep(uFade * 0.25, uFade, d);
        vec2 fw = fwidth(p);
        float ax = 1.0 - min(abs(p.y) / (fw.y * 1.4), 1.0);
        float az = 1.0 - min(abs(p.x) / (fw.x * 1.4), 1.0);
        vec3 col = uColor;
        float a = max(minor * 0.10, major * 0.26);
        col = mix(col, vec3(1.0, 0.36, 0.48), ax); a = max(a, ax * 0.75);
        col = mix(col, vec3(0.42, 0.55, 1.0), az); a = max(a, az * 0.75);
        a *= fade;
        if (a < 0.003) discard;
        gl_FragColor = vec4(col, a);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.001;
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

function worldVisible(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export class Viewport {
  constructor(el) {
    this.el = el;
    this.nodes = new Map();
    this.prefs = { grid: true, focus: true, labels: true };
    this.mode = 'select';
    this.selectedId = null;
    this.hoverId = null;
    this.onPick = () => {};
    this.onFly = () => {};
    this.needsRender = true;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(r.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels';
    el.appendChild(this.labels.domElement);

    const scene = (this.scene = new THREE.Scene());
    scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;

    // near побольше — точнее буфер глубины (меньше мерцания совпадающих граней)
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.08, 600);
    this.camera.position.set(7, 5, 8);

    const c = (this.controls = new OrbitControls(this.camera, r.domElement));
    c.enableDamping = true;
    c.dampingFactor = 0.085;
    c.maxPolarAngle = Math.PI * 0.495;
    c.minDistance = 0.15;
    c.maxDistance = 150;
    c.screenSpacePanning = true;
    c.addEventListener('start', () => { this.anim = null; });

    this.hemi = new THREE.HemisphereLight(0xe2dbff, 0x1c1236, 0.75);
    scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight(0xffffff, 1.7));
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 0.5, far: 60 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.01;
    sun.shadow.radius = 6;
    scene.add(sun);

    // Пол-приёмник теней не пишет глубину: иначе прозрачное дно контейнеров,
    // лежащее в той же плоскости, «дерётся» с ним (z-fighting, рваные пятна).
    const floor = (this.floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x08041a, opacity: 0.32, depthWrite: false })));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    this.grid = makeGrid();
    scene.add(this.grid);

    this.world = new THREE.Group();
    scene.add(this.world);

    const boxLine = (color, opacity) => {
      const l = new THREE.LineSegments(EDGE_GEO, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
      l.renderOrder = 999;
      l.visible = false;
      return l;
    };
    this.selBox = boxLine(0xd7b4ff, 1);
    this.hoverBox = boxLine(0xffffff, 0.45);

    const tc = (this.tc = new TransformControls(this.camera, r.domElement));
    tc.setTranslationSnap(0.01);
    tc.setSize(0.85);
    tc.addEventListener('dragging-changed', (e) => {
      c.enabled = !e.value;
      this.dragging = e.value;
      const it = store.get(this.selectedId);
      if (e.value && it) this.gesture = { id: it.id, home: it.parentId, source: `gesture:${Math.random().toString(36).slice(2)}` };
      else if (!e.value && this.gesture) { store.endGesture(this.gesture.id, this.gesture.home, this.gesture.source); this.gesture = null; }
    });
    tc.addEventListener('objectChange', () => this.onTransform());
    tc.addEventListener('change', () => (this.needsRender = true));
    scene.add(tc.getHelper());

    this.theme = { edgeMix: '#ffffff', edgeAmount: 0.45, edgeSolid: 0.35 };
    this.raycaster = new THREE.Raycaster();
    this.moving = new Set();
    this.bindPointer();

    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const loop = () => { requestAnimationFrame(loop); this.tick(); };
    loop();
  }

  // ── цикл ──────────────────────────────────────────────────────────────
  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  tick() {
    if (this.anim) {
      const a = this.anim;
      const k = ease(Math.min(1, (performance.now() - a.t0) / a.dur));
      this.controls.target.lerpVectors(a.fromT, a.toT, k);
      this.camera.position.lerpVectors(a.fromP, a.toP, k);
      if (k >= 1) this.anim = null;
      this.needsRender = true;
    }
    if (this.moving.size) this.stepMoves();
    if (this.controls.update()) this.needsRender = true;
    if (!this.needsRender) return;
    this.needsRender = false;
    this.grid.material.uniforms.uCam.value.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }

  // Перелёт предметов по дуге: подняли, перенесли, опустили.
  stepMoves() {
    const now = performance.now();
    for (const n of this.moving) {
      const m = n.move;
      if (!m) { this.moving.delete(n); continue; }
      const t = (now - m.t0) / m.dur;
      if (t <= 0) continue;
      const k = ease(Math.min(1, t));
      n.group.position.lerpVectors(m.from, m.to, k);
      n.group.position.y += Math.sin(k * Math.PI) * m.lift;
      if (t >= 1) { n.group.position.copy(m.to); n.move = null; this.moving.delete(n); }
    }
    this.needsRender = true;
  }

  // ── тема ──────────────────────────────────────────────────────────────
  applyTheme(t) {
    this.theme = t;
    this.grid.material.uniforms.uColor.value.set(t.grid);
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    this.hemi.intensity = t.hemi;
    this.sun.color.set(t.sun);
    this.sun.intensity = t.sunPower;
    this.floor.material.color.set(t.shadow);
    this.floor.material.opacity = t.shadowOpacity;
    this.selBox.material.color.set(t.sel);
    this.hoverBox.material.color.set(t.hover);
    this.renderer.toneMappingExposure = t.exposure;
    this.scene.environmentIntensity = t.env;
    this.refreshLook();
  }

  // Пиксельный рендер: рисуем в половинном разрешении и растягиваем без сглаживания.
  setPixel(on) {
    this.renderer.setPixelRatio(on ? 0.5 : Math.min(devicePixelRatio, 2));
    this.el.classList.toggle('pixel', on);
    this.resize();
  }

  // ── синхронизация с данными ───────────────────────────────────────────
  ensureNode(it) {
    let n = this.nodes.get(it.id);
    if (n) return n;
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(undefined, new THREE.MeshPhysicalMaterial({ roughness: 0.42, metalness: 0.02, clearcoat: 0.35, clearcoatRoughness: 0.4 }));
    mesh.userData.id = it.id;
    const edges = new THREE.LineSegments(EDGE_GEO, new THREE.LineBasicMaterial({ transparent: true }));
    edges.raycast = () => {};
    const labelEl = document.createElement('div');
    labelEl.className = 'label3d';
    labelEl.innerHTML = '<div class="chip"><b></b><span></span></div>';
    labelEl.firstChild.addEventListener('click', () => this.onPick(it.id, { fly: true }));
    const label = new CSS2DObject(labelEl);
    label.center.set(0.5, 1);
    group.add(mesh, edges, label);
    n = { group, mesh, edges, label, labelEl, sizeKey: '' };
    this.nodes.set(it.id, n);
    return n;
  }

  // detail.animate — предметы переезжают на новые места плавно (расстановка).
  sync(detail = {}) {
    const animate = !!detail.animate;
    this.scene.updateMatrixWorld(true);
    let order = 0;
    const alive = new Set(store.all().map((i) => i.id));
    for (const [id, n] of this.nodes) {
      if (alive.has(id)) continue;
      if (this.tc.object === n.group) this.tc.detach();
      n.group.removeFromParent();
      n.mesh.geometry?.dispose();
      n.mesh.material.dispose();
      n.edges.material.dispose();
      n.labelEl.remove();
      this.nodes.delete(id);
    }
    const walk = (pid, parentObj) => {
      for (const it of store.children(pid)) {
        const fresh = !this.nodes.has(it.id);
        const n = this.ensureNode(it);
        // attach сохраняет мировое положение — анимация начнётся с прежнего места
        if (n.group.parent !== parentObj) n.group.parent ? parentObj.attach(n.group) : parentObj.add(n.group);
        this.applyItem(it, n, animate ? { delay: Math.min(order++ * 22, 450), fresh } : null);
        walk(it.id, n.group);
      }
    };
    walk(null, this.world);
    this.refreshLook();
  }

  applyItem(it, n, anim = null) {
    const s = it.size;
    const w = s.x * CM, h = s.y * CM, d = s.z * CM;
    // Прозрачные стенки контейнера чуть шире настоящих (на 3 мм наружу): иначе
    // грань вещи, прижатой к стенке, лежит с ней в одной плоскости и мерцает
    // клетками (z-fighting). Внутренние размеры и расстановка не меняются.
    const pad = it.opacity < 0.999 || store.children(it.id).length ? WALL_PAD * 2 : 0;
    const key = `${s.x}|${s.y}|${s.z}|${pad}`;
    if (n.sizeKey !== key) {
      n.mesh.geometry?.dispose();
      const rad = pad ? 0.004 : Math.min(0.015, Math.min(w, h, d) * 0.08);
      n.mesh.geometry = new RoundedBoxGeometry(w + pad, h + pad, d + pad, 3, rad);
      n.edges.scale.set(w + pad, h + pad, d + pad);
      n.sizeKey = key;
    }
    const p = it.parentId ? store.get(it.parentId).size : { x: 0, y: 0, z: 0 };
    const to = new THREE.Vector3(
      (it.pos.x + s.x / 2 - p.x / 2) * CM,
      (it.pos.y + s.y / 2 - p.y / 2) * CM,
      (it.pos.z + s.z / 2 - p.z / 2) * CM,
    );
    if (anim && (anim.fresh || n.group.position.distanceToSquared(to) > 1e-8)) {
      const from = anim.fresh ? to.clone().add(new THREE.Vector3(0, 0.6, 0)) : n.group.position.clone();
      n.group.position.copy(from);
      n.move = { from, to, t0: performance.now() + anim.delay, dur: anim.fresh ? 420 : 560, lift: anim.fresh ? 0 : 0.12 + Math.min(0.3, from.distanceTo(to) * 0.15) };
      this.moving.add(n);
    } else {
      n.group.position.copy(to);
      n.move = null;
      this.moving.delete(n);
    }
    n.group.visible = it.visible;
    n.label.position.set(0, h / 2, 0);
    n.labelEl.querySelector('b').textContent = it.name;
    n.labelEl.querySelector('span').textContent = `${fmt(s.x)}×${fmt(s.y)}×${fmt(s.z)}`;
  }

  // Цвет, прозрачность, подсветка пути к выбранному, подписи, рамки.
  refreshLook() {
    const sel = this.selectedId && store.get(this.selectedId) ? this.selectedId : null;
    const related = new Set();
    if (sel) {
      related.add(sel);
      for (const a of store.ancestors(sel)) related.add(a.id);
      for (const d of store.descendants(sel)) related.add(d.id);
    }
    const path = new Set(sel ? [sel, ...store.ancestors(sel).map((a) => a.id)] : []);
    const selKids = sel ? store.children(sel).length : 0;
    for (const it of store.all()) {
      const n = this.nodes.get(it.id);
      if (!n) continue;
      const dim = this.prefs.focus && sel && !related.has(it.id);
      const op = it.opacity * (dim ? 0.18 : 1);
      const m = n.mesh.material;
      m.color.set(it.color);
      const transparent = op < 0.999;
      if (m.transparent !== transparent) { m.transparent = transparent; m.needsUpdate = true; }
      m.opacity = op;
      m.depthWrite = !transparent;
      m.side = it.opacity < 0.999 ? THREE.DoubleSide : THREE.FrontSide;
      // Стенки контейнера уступают совпадающим граням вложенных предметов.
      m.polygonOffset = it.opacity < 0.999;
      m.polygonOffsetFactor = 1;
      m.polygonOffsetUnits = 2;
      n.mesh.castShadow = it.opacity > 0.5 && !dim;
      n.mesh.receiveShadow = it.opacity > 0.5;
      n.mesh.renderOrder = it.opacity < 0.999 ? 1 : 0;

      const bad = store.hasProblem(it.id);
      const em = n.edges.material;
      const th = this.theme;
      em.color.set(bad ? '#ff5c7a' : new THREE.Color(it.color).lerp(new THREE.Color(th.edgeMix), th.edgeAmount));
      em.opacity = (it.edges || bad ? (it.opacity < 0.999 ? 0.85 : th.edgeSolid) : 0) * (dim ? 0.25 : 1);
      n.edges.visible = em.opacity > 0;

      const shown = this.prefs.labels && store.isVisible(it.id) &&
        (!it.parentId || path.has(it.id) || it.id === this.hoverId || (sel && it.parentId === sel && selKids <= 6));
      n.label.visible = !!shown;
      n.labelEl.classList.toggle('is-sel', it.id === sel);
      n.labelEl.classList.toggle('is-path', path.has(it.id) && it.id !== sel);
      n.labelEl.classList.toggle('is-bad', bad);
      n.labelEl.classList.toggle('is-dim', !!dim);
    }
    this.placeBox(this.selBox, sel);
    const hl = this.dropId || (this.hoverId !== sel ? this.hoverId : null);
    this.placeBox(this.hoverBox, hl);
    this.hoverBox.material.color.set(this.dropId ? (this.dropReject ? '#ff5c7a' : this.theme.sel || '#d7b4ff') : this.theme.hover || '#ffffff');
    this.hoverBox.material.opacity = this.dropId ? 0.9 : 0.45;
    this.updateGizmo();
    this.needsRender = true;
  }

  placeBox(line, id) {
    const n = id && this.nodes.get(id);
    const it = id && store.get(id);
    if (!n || !it) { line.removeFromParent(); line.visible = false; return; }
    n.group.add(line);
    const pad = 0.012;
    line.scale.set(it.size.x * CM + pad, it.size.y * CM + pad, it.size.z * CM + pad);
    line.visible = true;
  }

  // ── выбор ─────────────────────────────────────────────────────────────
  setSelected(id) {
    this.selectedId = id;
    this.refreshLook();
  }

  setPref(key, value) {
    this.prefs[key] = value;
    if (key === 'grid') this.grid.visible = value;
    this.refreshLook();
  }

  setMode(mode) {
    this.mode = mode;
    this.updateGizmo();
  }

  updateGizmo() {
    const n = this.mode === 'move' && this.selectedId && this.nodes.get(this.selectedId);
    if (!n) { if (this.tc.object) this.tc.detach(); return; }
    if (this.tc.object !== n.group) this.tc.attach(n.group);
    const root = !store.get(this.selectedId)?.parentId;
    this.tc.showY = !root;
  }

  // Гизмо двигает группу; переводим в сантиметры, прилипаем к 1 см
  // и не даём выйти за стенки родителя.
  onTransform() {
    const id = this.selectedId;
    const it = store.get(id);
    const n = this.nodes.get(id);
    if (!it || !n) return;
    const g = n.group.position, s = it.size;
    const p = it.parentId ? store.get(it.parentId).size : null;
    const axis = (k) => {
      let v = Math.round(g[k] / CM - s[k] / 2 + (p ? p[k] / 2 : 0));
      if (p) v = Math.max(0, Math.min(v, Math.max(0, p[k] - s[k])));
      return v;
    };
    const pos = { x: axis('x'), y: p ? axis('y') : 0, z: axis('z') };
    if (pos.x === it.pos.x && pos.y === it.pos.y && pos.z === it.pos.z) return;
    store.update(id, { pos }, this.gesture?.source || 'transform');
  }

  // ── указатель ─────────────────────────────────────────────────────────
  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    // capture — раньше OrbitControls: на предмете вращение не начинается
    el.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY };
      if (e.button !== 0 || this.mode !== 'select') return;
      let id = this.pick(e);
      if (id && e.altKey) id = store.get(id)?.parentId || id;
      if (!id || !this.canDrag(id)) return;
      this.controls.enabled = false;
      this.pending = { id, x: e.clientX, y: e.clientY };
    }, true);
    el.addEventListener('pointermove', (e) => {
      if (this.pending && !this.drag && Math.hypot(e.clientX - this.pending.x, e.clientY - this.pending.y) > 5) {
        this.beginDrag(e);
        try { el.setPointerCapture(e.pointerId); } catch {}
      }
      if (this.drag) this.updateDrag(e);
    });
    el.addEventListener('pointerup', (e) => {
      if (this.drag) { this.endDrag(); this.pending = null; this.controls.enabled = true; down = null; return; }
      if (this.pending) { this.pending = null; this.controls.enabled = true; }
      if (!down || this.dragging || this.tc.dragging) { down = null; return; }
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 4 || e.button !== 0) return;
      let id = this.pick(e);
      if (id && e.altKey) id = store.get(id)?.parentId || id;
      this.onPick(id, {});
    });
    el.addEventListener('dblclick', (e) => {
      const id = this.pick(e);
      if (id) this.onPick(id, { fly: true });
      else this.frameAll();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      this.lastMove = e;
      if (this.hoverQueued) return;
      this.hoverQueued = true;
      requestAnimationFrame(() => {
        this.hoverQueued = false;
        const id = this.pick(this.lastMove);
        el.style.cursor = id ? (this.mode === 'select' && this.canDrag(id) ? 'grab' : 'pointer') : '';
        if (id !== this.hoverId) { this.hoverId = id; this.refreshLook(); }
      });
    });
    el.addEventListener('pointerleave', () => { if (this.hoverId) { this.hoverId = null; this.refreshLook(); } });
  }

  // ── перетаскивание мышью ──────────────────────────────────────────────
  // Сплошные предметы тащатся сразу; прозрачный контейнер — если уже выбран.
  // Комнаты (корневые) двигаются гизмо (G), чтобы не мешать вращать камеру.
  canDrag(id) {
    const it = store.get(id);
    return !!it && !!it.parentId && store.isVisible(id) && (it.opacity >= 0.5 || id === this.selectedId);
  }

  rayPlane(e, y) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), new THREE.Vector3());
    if (!hit || hit.distanceTo(this.camera.position) > 80) return null;
    return hit;
  }

  beginDrag(e) {
    const id = this.pending.id;
    const it = store.get(id);
    const w0 = store.worldPos(id);
    // Плоскость — на высоте точки, за которую взяли: предмет идёт ровно под курсором.
    this.rayPlane(e, 0);
    const grab = this.raycaster.intersectObject(this.nodes.get(id).mesh, false)[0];
    const planeY = grab ? grab.point.y : w0.y * CM;
    const hit0 = this.rayPlane(e, planeY);
    if (!hit0) return;
    this.onPick(id, {});
    this.drag = { id, home: it.parentId, w0, hit0, planeY, source: `gesture:${Math.random().toString(36).slice(2)}` };
    this.renderer.domElement.style.cursor = 'grabbing';
  }

  // Куда упадёт предмет: самый глубокий контейнер, над которым его центр.
  // Если самый глубокий контейнер под центром слишком мал — он в reject.
  dropTarget(id, cx, cz, s) {
    let best = null, depth = -1, reject = null, rdepth = -1;
    for (const c of store.all()) {
      if (c.id === id || store.isAncestor(id, c.id) || !store.isVisible(c.id)) continue;
      const box = !c.parentId || c.opacity < 0.999 || store.children(c.id).length > 0;
      if (!box) continue;
      const w = store.worldPos(c.id);
      if (cx < w.x || cx > w.x + c.size.x || cz < w.z || cz > w.z + c.size.z) continue;
      const dep = store.ancestors(c.id).length;
      const fits = s.x <= c.size.x && s.z <= c.size.z && s.y <= c.size.y;
      if (fits && dep > depth) { depth = dep; best = c; }
      if (!fits && dep > rdepth) { rdepth = dep; reject = c; }
    }
    return { best, reject: reject && rdepth > depth ? reject : null };
  }

  updateDrag(e) {
    const d = this.drag;
    const it = store.get(d.id);
    const hit = it && this.rayPlane(e, d.planeY);
    if (!hit) return;
    const s = it.size;
    const wx = d.w0.x + (hit.x - d.hit0.x) / CM;
    const wz = d.w0.z + (hit.z - d.hit0.z) / CM;
    const { best, reject } = this.dropTarget(d.id, wx + s.x / 2, wz + s.z / 2, s);
    const dest = best || store.get(it.parentId);
    const dw = store.worldPos(dest.id);
    const sibs = store.children(dest.id).filter((c) => c.id !== d.id && store.isVisible(c.id));
    // прилипание к стенкам и соседям — порог ~10 px на экране
    const perPx = (2 * hit.distanceTo(this.camera.position) * Math.tan((this.camera.fov * Math.PI) / 360)) / this.el.clientHeight;
    const thr = (10 * perPx) / CM;
    const axis = (k, v) => {
      v = Math.max(0, Math.min(v, Math.max(0, dest.size[k] - s[k])));
      let bestV = v, bestD = thr;
      const cands = [0, dest.size[k] - s[k]];
      for (const c of sibs) cands.push(c.pos[k] + c.size[k], c.pos[k] - s[k], c.pos[k], c.pos[k] + c.size[k] - s[k]);
      for (const cv of cands) if (cv >= 0 && cv <= dest.size[k] - s[k] + 0.01 && Math.abs(cv - v) < bestD) { bestD = Math.abs(cv - v); bestV = cv; }
      return Math.round(bestV);
    };
    const x = axis('x', wx - dw.x);
    const z = axis('z', wz - dw.z);
    // «гравитация»: встаёт на самый высокий сплошной предмет под собой
    let y = 0;
    for (const c of sibs) {
      if (c.opacity < 0.999) continue;
      if (x < c.pos.x + c.size.x - 0.01 && x + s.x > c.pos.x + 0.01 && z < c.pos.z + c.size.z - 0.01 && z + s.z > c.pos.z + 0.01) y = Math.max(y, c.pos.y + c.size.y);
    }
    const patch = {};
    if (dest.id !== it.parentId) patch.parentId = dest.id;
    if (patch.parentId || x !== it.pos.x || y !== it.pos.y || z !== it.pos.z) patch.pos = { x, y, z };
    const dropId = reject ? reject.id : dest.id !== d.home ? dest.id : null;
    if (dropId !== this.dropId || !!reject !== !!this.dropReject) { this.dropId = dropId; this.dropReject = !!reject; this.refreshLook(); }
    d.reject = reject;
    if (patch.pos) store.update(d.id, patch, d.source);
  }

  endDrag() {
    const d = this.drag;
    this.drag = null;
    this.dropId = null;
    this.dropReject = false;
    if (d.reject) this.onNotice?.(t('«{name}» не влезает в «{target}»', { name: store.get(d.id)?.name, target: d.reject.name }));
    this.renderer.domElement.style.cursor = '';
    store.endGesture(d.id, d.home, d.source);
    this.refreshLook();
  }

  // Клик сквозь прозрачные стенки: если дальше по лучу лежит потомок
  // того, во что попали, выбираем самого глубокого.
  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = [];
    for (const n of this.nodes.values()) if (worldVisible(n.mesh)) meshes.push(n.mesh);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    let id = hits[0].object.userData.id;
    for (const h of hits.slice(1)) {
      const hid = h.object.userData.id;
      if (store.isAncestor(id, hid)) id = hid;
    }
    return id;
  }

  // ── камера ────────────────────────────────────────────────────────────
  flyTo(target, pos, dur = 750) {
    this.anim = { t0: performance.now(), dur, fromT: this.controls.target.clone(), toT: target.clone(), fromP: this.camera.position.clone(), toP: pos.clone() };
    this.needsRender = true;
  }

  fitBox(box, { dir, instant, margin = 1.08, pad = 0 } = {}) {
    if (box.isEmpty()) box = new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 1, 2));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const fov = (this.camera.fov * Math.PI) / 180;
    const fit = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect));
    const dist = Math.max(0.5, (sphere.radius / Math.sin(fit / 2)) * margin + pad);
    const d = (dir || this.camera.position.clone().sub(this.controls.target)).clone().normalize();
    const pos = sphere.center.clone().add(d.multiplyScalar(dist));
    if (instant) {
      this.controls.target.copy(sphere.center);
      this.camera.position.copy(pos);
      this.needsRender = true;
    } else this.flyTo(sphere.center, pos);
  }

  focus(id) {
    const n = this.nodes.get(id);
    if (!n) return;
    // С запасом вокруг — чтобы было видно, где именно лежит объект.
    this.scene.updateMatrixWorld();
    this.fitBox(new THREE.Box3().setFromObject(n.mesh), { margin: 1.15, pad: 0.9 });
  }

  frameAll(instant = false) {
    this.scene.updateMatrixWorld();
    const box = new THREE.Box3();
    for (const n of this.nodes.values()) if (worldVisible(n.mesh)) box.expandByObject(n.mesh);
    this.fitBox(box, { instant, dir: instant ? new THREE.Vector3(1, 0.75, 1.15) : undefined });
  }

  view(name) {
    const dirs = { top: new THREE.Vector3(0, 1, 0.0001), front: new THREE.Vector3(0, 0.08, 1), side: new THREE.Vector3(1, 0.08, 0), persp: new THREE.Vector3(1, 0.75, 1.15) };
    this.scene.updateMatrixWorld();
    const box = new THREE.Box3();
    const n = this.selectedId && this.nodes.get(this.selectedId);
    if (n) box.setFromObject(n.mesh);
    else for (const m of this.nodes.values()) if (worldVisible(m.mesh)) box.expandByObject(m.mesh);
    this.fitBox(box, { dir: dirs[name] });
  }
}
