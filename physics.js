/* Shared, deterministic physics: the rendered ramp uses this exact curve. */
(function (root) {
  'use strict';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  // Reference profile: short foot, long upright middle, then a left-leaning upper sweep.
  // These two cubic sections replace the former circular quarter-pipe.
  const rampX = 112, curve = [];
  const sections = [
    [[112,0],[116,0],[117,6],[117,16]],
    [[117,16],[117,40],[115,48],[92,66]]
  ];
  let length = rampX;
  for (const section of sections) for (let i = 0; i <= 240; i++) {
    if (curve.length && i === 0) continue;
    const t = i / 240, u = 1 - t, [a,b,c,d] = section;
    const xy = axis => u*u*u*a[axis] + 3*u*u*t*b[axis] + 3*u*t*t*c[axis] + t*t*t*d[axis];
    const first = axis => 3*u*u*(b[axis]-a[axis]) + 6*u*t*(c[axis]-b[axis]) + 3*t*t*(d[axis]-c[axis]);
    const second = axis => 6*u*(c[axis]-2*b[axis]+a[axis]) + 6*t*(d[axis]-2*c[axis]+b[axis]);
    const x=xy(0), y=xy(1), dx=first(0), dy=first(1);
    if (curve.length) length += Math.hypot(x-curve.at(-1).x, y-curve.at(-1).y);
    curve.push({x,y,s:length,angle:Math.atan2(dy,dx),curvature:(dx*second(1)-dy*second(0))/Math.pow(dx*dx+dy*dy,1.5)});
  }
  const C = Object.freeze({ g:12, rampX, rampHeight:66, endAngle:curve.at(-1).angle,
    height:.9, maxSpeed:16, thrust:23, padLeft:10, padRight:26 });
  const end = length;
  function track(s) {
    if (s <= rampX) return {x:s,y:0,angle:0,curvature:0};
    let lo=0, hi=curve.length-1;
    while (hi-lo>1) {const mid=(lo+hi)>>1; if(curve[mid].s<s)lo=mid;else hi=mid;}
    const a=curve[lo], b=curve[hi], t=clamp((s-a.s)/(b.s-a.s),0,1);
    return Object.fromEntries(['x','y','angle','curvature'].map(key=>[key,a[key]+(b[key]-a[key])*t]));
  }
  function place(b) {
    const p = track(b.s);
    b.x = p.x - Math.sin(p.angle) * C.height;
    b.y = p.y + Math.cos(p.angle) * C.height;
    b.angle = p.angle;
    b.vx = b.speed * Math.cos(p.angle);
    b.vy = b.speed * Math.sin(p.angle);
    b.omega = b.speed * p.curvature;
  }
  function create() {
    const b = { s: C.rampX-12, speed: 0, x: C.rampX-12, y: C.height, vx: 0, vy: 0,
      angle: 0, omega: 0, attached: true, state: 'ready', phase: 'approach',
      vacuum: 0, fuel: 100, time: 0, launched: false, maxAngle: 0,
      releaseVX: null, releaseAngle: null, reason: '', impact: null, score: 0,
      jets: { up: 0, down: 0, left: 0, right: 0 }, pitchJet: 0 };
    return b;
  }
  function release(b) {
    b.attached = false;
    b.launched = true;
    b.phase = 'flight';
    b.releaseVX = b.vx;
    b.releaseAngle = b.angle;
  }
  function finish(b, reason, landed) {
    b.impact = { vx: b.vx, vy: b.vy, angle: wrap(b.angle) };
    b.state = landed ? 'landed' : 'crashed';
    b.phase = landed ? 'landed' : 'crashed';
    b.reason = reason;
    b.y = Math.max(b.y, .45);
    b.score = landed ? Math.round(1000 + b.fuel * 8 - Math.abs(b.vy) * 45 - Math.abs(b.vx) * 25) : 0;
    b.jets = { up: 0, down: 0, left: 0, right: 0 };
  }
  function demoInput(b) {
    if (b.attached) return { drive: 1, vacuum: 1, assist: true };
    const height = Math.max(0, b.y - C.height);
    const desiredVY = -Math.min(9, Math.sqrt(2 * 3 * height));
    const lift = clamp((C.g + 2.6 * (desiredVY - b.vy)) / C.thrust, 0, 1);
    const targetVX = clamp(((C.padLeft+C.padRight)/2 - b.x) * .75, -17, 17);
    const horizontal = clamp((targetVX - b.vx) * 2 / C.thrust, -1, 1);
    return { up: lift, left: Math.max(0, -horizontal), right: Math.max(0, horizontal), assist: true };
  }
  function step(b, input, dt) {
    if (b.state === 'crashed' || b.state === 'landed') return b;
    const targetVacuum = clamp(input.vacuum || 0, 0, 1);
    b.vacuum += clamp(targetVacuum-b.vacuum,-dt*3,dt*3);
    if (b.state === 'ready' && (input.drive || input.up || input.left || input.right)) b.state = 'running';
    if (b.state === 'ready') return b;
    b.time += dt;
    if (b.attached) {
      const p = track(b.s);
      const support = b.speed * b.speed * p.curvature + C.g * Math.cos(p.angle) + b.vacuum * 38;
      if (support < 0) { release(b); return b; }
      const traction = Math.min(17, .75 * support);
      const accel = (input.drive || 0) * traction - C.g * Math.sin(p.angle) - b.speed * .06;
      b.speed = clamp(b.speed + accel * dt, -12, C.maxSpeed);
      b.s = Math.max(0, b.s + b.speed * dt);
      if (b.s === 0) b.speed = Math.max(0, b.speed);
      if (b.s >= end) { b.s = end; place(b); release(b); }
      else { place(b); b.phase = b.s < C.rampX ? 'approach' : p.angle > Math.PI / 2 ? 'hook' : 'climb'; }
      b.maxAngle = Math.max(b.maxAngle, b.angle);
      return b;
    }
    const jets = { up: clamp(input.up || 0, 0, 1), down: clamp(input.down || 0, 0, 1),
      left: clamp(input.left || 0, 0, 1), right: clamp(input.right || 0, 0, 1) };
    const manualPitch = clamp(input.pitch || 0, -1, 1);
    let torque = manualPitch * 5;
    if (input.assist && !manualPitch) torque = clamp(-wrap(b.angle) * 8 - b.omega * 5, -8, 8);
    const usage = (jets.up + jets.down + jets.left + jets.right) * 7 + Math.abs(torque) * .15;
    const available = usage > 0 ? Math.min(1, b.fuel / (usage * dt)) : 1;
    for (const key of Object.keys(jets)) jets[key] *= available;
    torque *= available;
    b.fuel = Math.max(0, b.fuel - usage * available * dt);
    b.jets = jets; b.pitchJet = torque / 8;
    b.vx += ((jets.right - jets.left) * C.thrust - b.vx * .025) * dt;
    b.vy += ((jets.up - jets.down) * C.thrust - C.g) * dt;
    b.omega += (torque - b.omega * .2) * dt;
    b.angle = wrap(b.angle + b.omega * dt);
    b.x += b.vx * dt; b.y += b.vy * dt;
    const a = b.angle;
    const wheelY = b.y - Math.abs(1.3 * Math.sin(a)) - .65 * Math.cos(a) - .25;
    const bodyY = b.y - Math.abs(1.7 * Math.sin(a)) - Math.abs(.38 * Math.cos(a));
    if (wheelY <= 0 || bodyY <= 0) {
      const level = Math.abs(a) < Math.PI / 12;
      const inPad = b.x - 1.6 >= C.padLeft && b.x + 1.6 <= C.padRight;
      const soft = Math.abs(b.vy) <= 4.2 && Math.abs(b.vx) <= 5.2;
      const landed = level && inPad && soft;
      finish(b, !level ? 'Level the car before touchdown.' : !soft ? 'Use the jets to reduce descent and sideways speed.' : !inPad ? 'Touch down inside the lit landing zone.' : 'A clean return. Wheels down.', landed);
      if (landed) { b.y = C.height; b.angle = 0; }
    } else {
      for (let i=1;i<curve.length-8;i++) {
        const a=curve[i-1], p=curve[i], dx=p.x-a.x, dy=p.y-a.y;
        const t=clamp(((b.x-a.x)*dx+(b.y-a.y)*dy)/(dx*dx+dy*dy),0,1);
        if (Math.hypot(b.x-a.x-dx*t,b.y-a.y-dy*t)<.65) {
          finish(b,'The car hit the ramp. Steer clear of the surface.',false);break;
        }
      }
      if (b.x < -20 || b.x > 145 || b.y > 100 || b.time > 90)
        finish(b, 'Outside the arena. Retry the return.', false);
    }
    return b;
  }
  const api = { C, end, curve, track, create, step, demoInput };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gripfall = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
