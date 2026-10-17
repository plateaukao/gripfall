(() => {
  'use strict';
  const P = window.Gripfall, $ = id => document.getElementById(id);
  let view;
  try { view = window.createGripfallArena($('scene')); }
  catch (error) { $('renderError').hidden = false; console.error(error); }
  $('resetView').onclick = () => view?.resetView();
  let body = P.create(), demo = false, assist = true, appliedInput = {};
  let accumulator = 0, last = null, lastPhase = '', resultShown = false;
  const keys = new Set(), pointers = new Map();
  const bindings = { Space: 'drive', ArrowUp: 'vacuum', ArrowDown: 'up',
    KeyW: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyA: 'noseUp', KeyD: 'noseDown' };
  function clearInput() { keys.clear(); pointers.clear(); }
  function pressed(action) {
    return [...keys].some(code => bindings[code] === action) || [...pointers.values()].includes(action);
  }
  function stopDemo() { demo = false; $('demo').textContent = 'Watch demo'; }
  function reset() {
    body = P.create(); appliedInput = {};
    clearInput(); resultShown = false; view?.reset();
    $('result').hidden = true;
    lastPhase = ''; accumulator = 0; last = null;
  }
  function startDemo() { demo = true; reset(); $('demo').textContent = 'Stop demo'; }
  $('reset').onclick = $('retry').onclick = () => { stopDemo(); reset(); };
  $('demo').onclick = () => { if (demo) { stopDemo(); reset(); } else startDemo(); };
  $('assist').onclick = () => {
    const effectiveAssist = demo ? appliedInput.assist : assist;
    stopDemo(); assist = !effectiveAssist; $('assist').setAttribute('aria-pressed', String(assist));
    $('assist').textContent = `Level assist ${assist ? 'ON' : 'OFF'}`;
  };
  $('help').onclick = () => { clearInput(); $('instructions').showModal(); };
  $('closeHelp').onclick = $('helpDone').onclick = () => $('instructions').close();
  document.querySelectorAll('[data-hold]').forEach(button => {
    button.addEventListener('pointerdown', e => {
      e.preventDefault(); stopDemo();
      button.setPointerCapture(e.pointerId); pointers.set(e.pointerId, button.dataset.hold);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture'])
      button.addEventListener(event, e => pointers.delete(e.pointerId));
    // Native keyboard activation of a hold button also gives it a short pulse.
    button.addEventListener('click', e => {
      if (e.detail || $('instructions').open) return;
      stopDemo(); const id = 'keyboard-' + button.dataset.hold;
      pointers.set(id, button.dataset.hold); setTimeout(() => pointers.delete(id), 200);
    });
  });
  document.addEventListener('keydown', e => {
    if ($('instructions').open) return;
    if (e.code === 'KeyR' && !e.repeat) { stopDemo(); reset(); return; }
    if (bindings[e.code]) { e.preventDefault(); stopDemo(); keys.add(e.code); }
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { clearInput(); last = null; accumulator = 0; });
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
    resultShown = true;
    const success = body.state === 'landed';
    $('resultLabel').textContent = success ? 'CLEAN TOUCHDOWN' : 'RUN ENDED';
    $('resultTitle').textContent = success ? `${body.score.toLocaleString()} points` : 'One more try.';
    const impact = body.impact;
    $('resultDetail').textContent = `${body.reason} Impact: ${Math.abs(impact.vy).toFixed(1)} m/s vertical, ${Math.abs(impact.vx).toFixed(1)} m/s horizontal. ${Math.round(body.fuel)}% fuel left.`;
    $('result').hidden = false;
  }
  function render(dt) {
    view?.render(body, dt);
    $('altitude').textContent = Math.max(0, body.y - P.C.height).toFixed(1);
    $('speed').textContent = Math.hypot(body.vx, body.vy).toFixed(1);
    $('fallSpeed').textContent = body.vy.toFixed(1);
    $('fuelValue').textContent = `${Math.round(body.fuel)}%`; $('fuel').value = body.fuel;
    $('vacValue').textContent = Math.round(body.vacuum * 100)+'%';
    $('vacuumPower').value = body.vacuum;
    $('vacState').textContent = !body.attached ? 'NO SURFACE CONTACT' : body.vacuum > .4 ? 'VACUUM ENGAGED' : 'HOLD ↑ FOR GRIP';
    $('runBadge').textContent = demo ? 'DEMO · PRESS ANY CONTROL TO TAKE OVER' : assist ? 'MANUAL JETS · LEVEL ASSIST ON' : 'MANUAL JETS · MANUAL PITCH';
    // Show the commands actually used by physics, including demo and assisted pitch jets.
    const running = !['landed','crashed'].includes(body.state);
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
    touchdown();
  }
  function frame(time) {
    if (document.hidden || $('instructions').open) {
      last = null; accumulator = 0; requestAnimationFrame(frame); return;
    }
    const dt = last === null ? 0 : Math.min((time - last) / 1000, .1);
    last = time;
    accumulator += dt;
    while (accumulator >= 1 / 120) {
      appliedInput = controls();
      P.step(body, appliedInput, 1 / 120);
      accumulator -= 1 / 120;
    }
    render(dt); requestAnimationFrame(frame);
  }
  window.gripfall = Object.freeze({ getState: () => JSON.parse(JSON.stringify(body)), getView: () => view?.getView(), startDemo,
    reset: () => { stopDemo(); reset(); } });
  requestAnimationFrame(frame);
})();
