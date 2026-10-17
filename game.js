(() => {
  'use strict';
  const P = window.Gripfall, $ = id => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const floorY = 710, scale = 9;
  const project = (x, y) => [280 + x * scale, floorY - y * scale];
  const point = p => p.map(n => n.toFixed(2)).join(' ');
  const path = points => 'M' + points.map(point).join('L');
  const line = (points, color, width = 1, extra = '') => `<path d="${path(points)}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
  const samples = [];
  for (let s = P.C.rampX-16; s < P.C.rampX; s += 2) samples.push(P.track(s));
  samples.push(...P.curve);
  const centers = samples.map(p => project(p.x, p.y));
  // The depth vector rotates in projection so the hooked lip keeps its road width.
  const near = centers.map(([x, y], i) => [x - 48, y - 13 * Math.cos(samples[i].angle)]);
  const far = centers.map(([x, y], i) => [x + 48, y + 13 * Math.cos(samples[i].angle)]);
  const shell = far.map(([x, y]) => [x + 19, y + 24]);
  const surface = path(near) + 'L' + far.slice().reverse().map(point).join('L') + 'Z';
  const structure = path(far) + 'L' + shell.slice().reverse().map(point).join('L') + 'Z';
  let road = `<path d="${structure}" fill="url(#side)" stroke="#53604c" stroke-width="1"/><path d="${surface}" fill="url(#ramp)" stroke="#8d9781" stroke-width="1"/><path d="${surface}" fill="url(#concrete)"/>`;
  for (let i = 2; i < centers.length; i += 26) {
    road += line([far[i], shell[i]], '#738065', 2, 'opacity=".55"');
    if (i + 26 < shell.length) road += line([far[i], shell[i + 26]], '#68785c', 1.5, 'opacity=".5"');
    road += line([near[i], far[i]], '#414b3f', 1, 'opacity=".4"');
  }
  road += line(centers, '#d3d9cb', 1.5, 'opacity=".38"');
  road += line(near, '#f25240', 4) + line(far, '#ff654f', 4);
  road += line([near.at(-1), far.at(-1)], '#e0e9d5', 4);
  $('road').innerHTML = road;
  const l = project(P.C.padLeft, 0), r = project(P.C.padRight, 0), cx = (l[0]+r[0])/2;
  $('landing').innerHTML = `<path d="M${l[0]-20} ${floorY-20}L${r[0]-20} ${floorY-20}L${r[0]+20} ${floorY+20}L${l[0]+20} ${floorY+20}Z" fill="#b7d49b" fill-opacity=".1" stroke="#b7d49b" stroke-width="1.5" stroke-dasharray="9 7"/>` +
    `<path d="M${l[0]-18} ${floorY-21}H${r[0]-18}M${l[0]+18} ${floorY+21}H${r[0]+18}" stroke="#d3e5b8" stroke-width="3"/>` +
    `<path d="M${cx} ${floorY-12}V${floorY+12}M${cx-15} ${floorY}H${cx+15}" stroke="#d3e5b8" stroke-width="1.5"/><text x="${cx}" y="${floorY-40}" text-anchor="middle" fill="#cddfbc">RETURN LANDING ZONE</text>`;

  let body = P.create(), paused = false, demo = false, assist = true, appliedInput = {};
  let accumulator = 0, last = null, lastPhase = '', cameraX = project(body.x,body.y)[0]-300, cloudAge = 5, resultShown = false;
  const keys = new Set(), pointers = new Map(), trail = [];
  const bindings = { Space: 'drive', ArrowUp: 'vacuum', ArrowDown: 'up',
    KeyW: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyA: 'noseUp', KeyD: 'noseDown' };
  function clearInput() { keys.clear(); pointers.clear(); }
  function pressed(action) {
    return [...keys].some(code => bindings[code] === action) || [...pointers.values()].includes(action);
  }
  function stopDemo() { demo = false; $('demo').textContent = 'Watch demo'; }
  function reset() {
    body = P.create(); appliedInput = {}; cameraX=clamp(project(body.x,body.y)[0]-300,0,950);
    clearInput(); trail.length = 0; resultShown = false; cloudAge = 5;
    $('result').hidden = true; $('impactCloud').innerHTML = '';
    lastPhase = ''; accumulator = 0; setPaused(false);
  }
  function startDemo() { demo = true; reset(); $('demo').textContent = 'Stop demo'; }
  function setPaused(value) {
    paused = value; clearInput(); accumulator = 0; last = null;
    $('paused').hidden = !paused;
    $('pause').textContent = paused ? 'Resume' : 'Pause';
    $('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game');
  }
  $('reset').onclick = $('retry').onclick = () => { stopDemo(); reset(); };
  $('demo').onclick = () => { if (demo) { stopDemo(); reset(); } else startDemo(); };
  $('pause').onclick = () => setPaused(!paused);
  $('assist').onclick = () => {
    const effectiveAssist = demo ? appliedInput.assist : assist;
    stopDemo(); assist = !effectiveAssist; $('assist').setAttribute('aria-pressed', String(assist));
    $('assist').textContent = `Level assist ${assist ? 'ON' : 'OFF'}`;
  };
  let helpWasPaused = false;
  $('help').onclick = () => { helpWasPaused = paused; setPaused(true); $('instructions').showModal(); };
  $('closeHelp').onclick = $('helpDone').onclick = () => $('instructions').close();
  $('instructions').addEventListener('close', () => setPaused(helpWasPaused));
  document.querySelectorAll('[data-hold]').forEach(button => {
    button.addEventListener('pointerdown', e => {
      if (paused) return;
      e.preventDefault(); stopDemo();
      button.setPointerCapture(e.pointerId); pointers.set(e.pointerId, button.dataset.hold);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(event, e => pointers.delete(e.pointerId));
    // Native keyboard activation of a hold button also gives it a short pulse.
    button.addEventListener('click', e => {
      if (e.detail || paused) return;
      stopDemo(); const id = 'keyboard-' + button.dataset.hold;
      pointers.set(id, button.dataset.hold); setTimeout(() => pointers.delete(id), 200);
    });
  });
  document.addEventListener('keydown', e => {
    if ($('instructions').open) return;
    if (e.code === 'KeyR' && !e.repeat) { stopDemo(); reset(); return; }
    if (e.code === 'KeyP' && !e.repeat) { setPaused(!paused); return; }
    if (paused) return;
    if (bindings[e.code]) { e.preventDefault(); stopDemo(); keys.add(e.code); }
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
  function controls() {
    if (demo) return P.demoInput(body);
    return { drive: +pressed('drive'), vacuum: +pressed('vacuum'),
      up: +pressed('up'), down: +pressed('down'), left: +pressed('left'), right: +pressed('right'),
      pitch: +pressed('noseUp') - +pressed('noseDown'), assist };
  }
  const phases = {
    approach: ['01', 'APPROACH', 'Hold Space to drive.<br>Hold ↑ for vacuum grip.'],
    climb: ['02', 'CLIMB', 'Keep Space + ↑ held.<br>Follow the tall ramp into its upper sweep.'],
    hook: ['03', 'HOOK BACK', 'Follow the hook past vertical.<br>Your forward direction is now back toward the start.'],
    flight: ['04', 'RETURN', '← → steer. ↓ fires lift jets.<br>Make the long return to the landing lights.'],
    landed: ['05', 'TOUCHDOWN', 'Back where it began.<br>A controlled return.'],
    crashed: ['05', 'RETRY', 'Read the landing. Adjust the jets.<br>Press R for another run.']
  };
  function touchdown() {
    if (resultShown || !['landed', 'crashed'].includes(body.state)) return;
    resultShown = true; cloudAge = 0;
    const success = body.state === 'landed';
    $('resultLabel').textContent = success ? 'CLEAN TOUCHDOWN' : 'RUN ENDED';
    $('resultTitle').textContent = success ? `${body.score.toLocaleString()} points` : 'One more try.';
    const impact = body.impact;
    $('resultDetail').textContent = `${body.reason} Impact: ${Math.abs(impact.vy).toFixed(1)} m/s vertical, ${Math.abs(impact.vx).toFixed(1)} m/s horizontal. ${Math.round(body.fuel)}% fuel left.`;
    $('result').hidden = false;
    const [x, y] = project(body.x, 0);
    $('impactCloud').innerHTML = Array.from({ length: 18 }, (_, i) => {
      const offset = Math.sin(i * 5.7) * (success ? 55 : 95);
      return `<circle cx="${x + offset}" cy="${y - 8 - (i % 4) * 8}" r="${8 + i % 5 * 5}" fill="${success ? '#cedbce' : '#84938a'}"/>`;
    }).join('');
  }
  function render(dt) {
    const [x, y] = project(body.x, body.y);
    const degrees = -body.angle * 180 / Math.PI;
    $('car').setAttribute('transform', `translate(${x} ${y}) rotate(${degrees}) scale(.72)`);
    $('contact').style.opacity = body.attached ? body.vacuum * .85 : 0;
    $('carShadow').setAttribute('cx', x);
    $('carShadow').setAttribute('cy', floorY+7);
    $('carShadow').setAttribute('rx', 25 + body.y * .8);
    $('carShadow').setAttribute('opacity', clamp(.35 - body.y / 140, .03, .35));
    $('worldJets').setAttribute('transform', `translate(${x} ${y})`);
    for (const direction of ['up', 'down', 'left', 'right'])
      $('jet-' + direction).style.opacity = body.attached ? 0 : body.jets[direction];
    // Pitch assist uses the same limited fuel supply as the manually fired jets.
    $('jets').style.opacity = !body.attached && !resultShown ? Math.abs(body.pitchJet) * .45 : 0;
    if (!paused && body.state === 'running' && !body.attached) {
      trail.push([x, y]); if (trail.length > 200) trail.shift();
    }
    $('trail').setAttribute('d', trail.length ? path(trail) : '');
    $('altitude').textContent = Math.max(0, body.y - P.C.height).toFixed(1);
    $('speed').textContent = Math.hypot(body.vx, body.vy).toFixed(1);
    $('fallSpeed').textContent = body.vy.toFixed(1);
    $('fuelValue').textContent = `${Math.round(body.fuel)}%`; $('fuel').value = body.fuel;
    $('vacValue').textContent = Math.round(body.vacuum * 100)+'%';
    $('vacuumPower').value = body.vacuum;
    $('vacState').textContent = !body.attached ? 'NO SURFACE CONTACT' : body.vacuum > .4 ? 'VACUUM ENGAGED' : 'HOLD ↑ FOR GRIP';
    $('runBadge').textContent = demo ? 'DEMO · PRESS ANY CONTROL TO TAKE OVER' : assist ? 'MANUAL JETS · LEVEL ASSIST ON' : 'MANUAL JETS · MANUAL PITCH';
    // Show the commands actually used by physics, including demo and assisted pitch jets.
    const running = !paused && !['landed','crashed'].includes(body.state);
    const levels = {
      drive: body.attached ? appliedInput.drive || 0 : 0,
      vacuum: appliedInput.vacuum || 0,
      up: body.jets.up, down: body.jets.down, left: body.jets.left, right: body.jets.right,
      noseUp: Math.max(0, body.pitchJet), noseDown: Math.max(0, -body.pitchJet)
    };
    document.querySelectorAll('[data-hold]').forEach(button => {
      const power = running ? levels[button.dataset.hold] || 0 : 0;
      button.classList.toggle('active', power > .001);
      button.setAttribute('aria-pressed', String(power > .001));
      button.style.setProperty('--power', power);
      button.dataset.power = Math.round(power * 100);
    });
    const effectiveAssist = demo ? !!appliedInput.assist : assist;
    $('assist').setAttribute('aria-pressed', String(effectiveAssist));
    $('assist').textContent = `Level assist ${effectiveAssist ? 'ON' : 'OFF'}`;
    if (body.phase !== lastPhase) {
      const [number, title, note] = phases[body.phase];
      $('stageTitle').innerHTML = `${number}<span> / </span>${title}`;
      $('stageNote').innerHTML = note; lastPhase = body.phase;
    }
    if (innerWidth <= 700) {
      cameraX += (clamp(x - 300, -50, 1000) - cameraX) * Math.min(1, dt * 5);
      $('scene').setAttribute('viewBox', `${cameraX} 0 650 900`);
    } else { cameraX = 0; $('scene').setAttribute('viewBox', '0 0 1440 900'); }
    if (!paused) cloudAge += dt;
    $('impactCloud').setAttribute('opacity', Math.max(0, .65 - cloudAge * .28));
    touchdown();
  }
  function frame(time) {
    const dt = last === null ? 0 : Math.min((time - last) / 1000, .1);
    last = time;
    if (!paused) {
      accumulator += dt;
      while (accumulator >= 1 / 120) {
        appliedInput = controls();
        P.step(body, appliedInput, 1 / 120);
        accumulator -= 1 / 120;
      }
    }
    render(dt); requestAnimationFrame(frame);
  }
  window.gripfall = Object.freeze({ getState: () => JSON.parse(JSON.stringify(body)), startDemo,
    reset: () => { stopDemo(); reset(); }, isPaused: () => paused });
  requestAnimationFrame(frame);
})();
