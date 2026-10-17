import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Rendering shares the exact sampled physics profile; orbiting never changes controls.
window.createGripfallArena = canvas => {
  const P = window.Gripfall;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new T.Scene();
  scene.background = new T.Color('#181e1b');
  scene.fog = new T.Fog('#181e1b', 230, 520);
  const camera = new T.PerspectiveCamera(40, 1, .1, 700);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .1;
  controls.minDistance = 12;
  controls.maxDistance = 290;
  controls.minPolarAngle = .12;
  controls.maxPolarAngle = Math.PI / 2 - .015;
  controls.cursorStyle = 'grab';
  // Do not call listenToKeyEvents: arrows belong exclusively to suction and jets.
  let mobile = canvas.clientWidth <= 700;
  function resetView() {
    // Flush orbit inertia before restoring the camera, including immediately after a drag.
    controls.enableDamping = false; controls.update();
    controls.target.set(mobile ? 95 : 66, 26, 0);
    camera.position.set(mobile ? 65 : 32, 59, mobile ? 153 : 164);
    controls.update(); controls.enableDamping = true;
  }
  resetView();
  scene.add(new T.HemisphereLight('#e7f0d9', '#444b36', 2.4));
  const key = new T.DirectionalLight('#f5f0d9', 4);
  key.position.set(40, 100, 45);
  key.target.position.set(70, 20, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -100, right: 100, top: 90, bottom: -90, near: 1, far: 260 });
  key.shadow.normalBias = .08;
  scene.add(key, key.target);
  const rim = new T.DirectionalLight('#a9c7db', 2.3);
  rim.position.set(140, 55, -50);
  scene.add(rim);
  const mat = (color, roughness = .7, metalness = .1) => new T.MeshStandardMaterial({ color, roughness, metalness });
  const concrete = mat('#7b8379'), steel = mat('#525d55', .43, .7);
  const red = new T.MeshStandardMaterial({ color: '#fc5140', emissive: '#ed3928', emissiveIntensity: .8 });
  const lime = new T.MeshStandardMaterial({ color: '#d4e9b4', emissive: '#b6e089', emissiveIntensity: .65 });
  function box(parent, x, y, z, w, h, d, material) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  function beam(a, b, radius, material, parent = scene) {
    const start = new T.Vector3(...a), finish = new T.Vector3(...b), delta = finish.clone().sub(start);
    const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, delta.length(), 6), material);
    mesh.position.copy(start.add(finish).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    mesh.castShadow = true; parent.add(mesh); return mesh;
  }
  box(scene, 65, -.5, 0, 400, .9, 300, mat('#1e2821', .95));
  const grid = new T.GridHelper(400, 40, '#5a6750', '#45503f');
  grid.position.set(65, -.035, 0); scene.add(grid);

  const samples = [];
  for (let s = 0; s < P.C.rampX; s += 2) samples.push(P.track(s));
  samples.push(...P.curve);
  const halfWidth = 4.5;
  // A single continuous strip, with real thickness and rails on both sides.
  function strip(offset, material) {
    const vertices = [], indices = [];
    samples.forEach((p, i) => {
      const x = p.x - Math.sin(p.angle) * offset, y = p.y + Math.cos(p.angle) * offset;
      vertices.push(x, y, -halfWidth, x, y, halfWidth);
      if (i) { const n = i * 2; indices.push(n - 2, n - 1, n, n - 1, n + 1, n); }
    });
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new T.Mesh(geometry, material);
    mesh.receiveShadow = true; mesh.castShadow = true; scene.add(mesh);
  }
  concrete.side = T.DoubleSide;
  strip(0, concrete); strip(-.65, steel);
  for (const z of [-halfWidth, halfWidth]) {
    const points = samples.map(p => new T.Vector3(p.x, p.y, z));
    const rail = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 520, .12, 5, false), red);
    scene.add(rail);
    // Steel side wall connects the road surface and its underside.
    const vertices = [], indices = [];
    samples.forEach((p, i) => {
      vertices.push(p.x, p.y, z, p.x + Math.sin(p.angle) * .65, p.y - Math.cos(p.angle) * .65, z);
      if (i) { const n = i * 2; indices.push(n - 2, n - 1, n, n - 1, n + 1, n); }
    });
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const wall = new T.Mesh(geometry, new T.MeshStandardMaterial({ color: '#59645b', metalness: .5, roughness: .6, side: T.DoubleSide }));
    scene.add(wall);
  }
  const centerline = new T.BufferGeometry().setFromPoints(samples.map(p => new T.Vector3(p.x - Math.sin(p.angle) * .025, p.y + Math.cos(p.angle) * .025, 0)));
  scene.add(new T.Line(centerline, new T.LineBasicMaterial({ color: '#ced5c6', transparent: true, opacity: .55 })));
  const braces = P.curve.filter((_, i) => i % 32 === 0 || i === P.curve.length - 1);
  for (const z of [-5.1, 5.1]) {
    const outer = braces.map(p => [p.x + Math.sin(p.angle) * 3.3, p.y - Math.cos(p.angle) * 3.3, z]);
    braces.forEach((p, i) => {
      beam([p.x, p.y, z], outer[i], .14, steel);
      if (i) {
        beam(outer[i - 1], outer[i], .18, steel);
        beam([braces[i - 1].x, braces[i - 1].y, z], outer[i], .1, steel);
      }
    });
    for (let i = 3; i < braces.length; i += 4) {
      beam(outer[i], [outer[i][0] + 10, 0, z], .2, steel);
      beam([outer[i][0] + 10, 0, z], outer[Math.max(0, i - 3)], .12, steel);
    }
  }
  const padCenter = (P.C.padLeft + P.C.padRight) / 2, padWidth = P.C.padRight - P.C.padLeft;
  box(scene, padCenter, .015, 0, padWidth, .03, 12, mat('#515f42'));
  for (const z of [-6, 6]) box(scene, padCenter, .06, z, padWidth, .09, .14, lime);
  for (const x of [P.C.padLeft, P.C.padRight]) box(scene, x, .06, 0, .14, .09, 12, lime);
  box(scene, padCenter, .065, 0, 2.8, .025, .12, lime);
  box(scene, padCenter, .065, 0, .12, .025, 2.8, lime);
  for (let i = 0; i < 12; i++) {
    for (const z of [-10, 10]) box(scene, P.C.padLeft + i * padWidth / 11, .16, z, .24, .25, .5, lime);
  }

  const car = new T.Group(); scene.add(car);
  const silver = mat('#dce4df', .28, .75), glass = mat('#172c2b', .13, .65), rubber = mat('#111816', .95);
  function profile(points, depth, material) {
    const shape = new T.Shape(points.map(([x, y]) => new T.Vector2(x, y)));
    const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .04, bevelSize: .05, bevelSegments: 1, steps: 1 });
    geometry.translate(0, 0, -depth / 2);
    const mesh = new T.Mesh(geometry, material); mesh.castShadow = true; car.add(mesh);
    return mesh;
  }
  profile([[-2.2, -.3], [2.25, -.3], [2.36, -.08], [2.1, .2], [-1.5, .28], [-2.2, .12]], 1.95, silver);
  profile([[-1.5, .25], [1.14, .23], [.42, .73], [-.77, .77]], 1.62, glass);
  box(car, -.2, .77, 0, 1.2, .065, 1.65, silver);
  box(car, -2.2, .05, 0, .16, .35, 2.1, steel);
  const wheels = [];
  for (const x of [-1.3, 1.3]) for (const z of [-1.04, 1.04]) {
    const wheel = new T.Mesh(new T.CylinderGeometry(.38, .38, .32, 16), rubber);
    wheel.rotation.x = Math.PI / 2; wheel.position.set(x, -.52, z); wheel.castShadow = true;
    car.add(wheel); wheels.push(wheel);
    const hub = new T.Mesh(new T.CylinderGeometry(.21, .21, .335, 12), steel);
    hub.rotation.x = Math.PI / 2; hub.position.copy(wheel.position); car.add(hub);
  }
  for (const z of [-.65, .65]) {
    box(car, 2.22, .02, z, .045, .12, .45, lime);
    box(car, -2.22, .02, z, .045, .12, .4, red);
  }
  const suction = box(car, 0, -.66, 0, 2.5, .06, 1.2,
    new T.MeshBasicMaterial({ color: '#ff7254', transparent: true, opacity: 0 }));
  const jets = new T.Group(); scene.add(jets);
  const jetMaterial = new T.MeshBasicMaterial({ color: '#b9f3ff', transparent: true, opacity: .8, depthWrite: false });
  function plume(parent, x, y, z, direction) {
    const group = new T.Group(); group.position.set(x, y, z);
    group.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...direction));
    const flame = new T.Mesh(new T.ConeGeometry(.26, 3.5, 10), jetMaterial);
    flame.position.y = 1.75; group.add(flame); parent.add(group); return group;
  }
  const lift = [-1.2, 1.2].flatMap(x => [-.65, .65].map(z => plume(jets, x, -.55, z, [0, -1, 0])));
  const down = [plume(jets, 0, .6, 0, [0, 1, 0])];
  const left = [plume(jets, 2, 0, 0, [1, 0, 0])];
  const right = [plume(jets, -2, 0, 0, [-1, 0, 0])];
  const pitch = [-1.3, 1.3].map(x => plume(car, x, -.5, 0, [0, -1, 0]));
  const trailGeometry = new T.BufferGeometry();
  trailGeometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(200 * 3), 3));
  trailGeometry.setDrawRange(0, 0);
  const trail = new T.Line(trailGeometry, new T.LineBasicMaterial({ color: '#b5d6c2', transparent: true, opacity: .35 }));
  trail.frustumCulled = false;
  scene.add(trail); const trailPoints = [];
  const dust = new T.Group(); scene.add(dust);
  const dustMaterial = new T.MeshBasicMaterial({ color: '#c3ceb9', transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 14; i++) {
    const puff = new T.Mesh(new T.SphereGeometry(.45 + i % 3 * .2, 8, 6), dustMaterial);
    dust.add(puff);
  }
  let previousState = 'ready', dustAge = 10, width = 0, height = 0;
  function reset() {
    trailPoints.length = 0; trailGeometry.setDrawRange(0, 0); dustAge = 10; previousState = 'ready';
  }
  function render(body, dt) {
    if (width !== canvas.clientWidth || height !== canvas.clientHeight) {
      width = canvas.clientWidth; height = canvas.clientHeight;
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      const nextMobile = width <= 700;
      if (nextMobile !== mobile) { mobile = nextMobile; resetView(); }
    }
    car.position.set(body.x, body.y, 0); car.rotation.z = body.angle;
    wheels.forEach(w => w.rotateY(-body.speed * dt / .38));
    suction.material.opacity = body.attached ? body.vacuum * .85 : 0;
    jets.position.copy(car.position);
    const running = body.state === 'running' && !body.attached;
    for (const [meshes, power] of [[lift, body.jets.up], [down, body.jets.down], [left, body.jets.left], [right, body.jets.right]]) {
      meshes.forEach(m => { m.visible = running && power > .001; m.scale.y = .2 + power * (1 + .1 * Math.sin(body.time * 55)); });
    }
    pitch.forEach((m, i) => { const power = i ? Math.max(0, body.pitchJet) : Math.max(0, -body.pitchJet); m.visible = running && power > .001; m.scale.y = .2 + power; });
    if (running) {
      trailPoints.push(car.position.clone()); if (trailPoints.length > 200) trailPoints.shift();
      trailGeometry.setFromPoints(trailPoints); trailGeometry.setDrawRange(0, trailPoints.length);
    }
    if (body.state !== previousState && ['landed', 'crashed'].includes(body.state)) {
      dustAge = 0; dust.position.set(body.x, .4, 0);
    }
    previousState = body.state; dustAge += dt;
    dustMaterial.opacity = Math.max(0, .45 - dustAge * .25);
    dust.children.forEach((p, i) => {
      const a = i * 2.39996, radius = dustAge * (2 + i % 3);
      p.position.set(Math.cos(a) * radius, dustAge * .6, Math.sin(a) * radius);
      p.scale.setScalar(1 + dustAge * .9);
    });
    // On phones the orbit rig follows the stunt while preserving the user's chosen angle.
    if (mobile) {
      const target = new T.Vector3(body.x, Math.max(14, body.y * .65), 0);
      const shift = target.sub(controls.target).multiplyScalar(Math.min(1, dt * 2));
      camera.position.add(shift); controls.target.add(shift);
    }
    controls.update(dt); renderer.render(scene, camera);
    canvas.dataset.ready = 'true';
  }
  return { render, reset, resetView,
    getView: () => ({ position: camera.position.toArray(), target: controls.target.toArray(), distance: controls.getDistance() }) };
};
