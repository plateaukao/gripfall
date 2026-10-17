const assert = require('node:assert/strict');
const P = require('./physics.js');
function run(controller, maxSeconds = 35) {
  const b = P.create();
  for (let i = 0; i < maxSeconds * 120 && !['landed','crashed'].includes(b.state); i++)
    P.step(b, controller(b), 1 / 120);
  return b;
}
const top = P.track(P.end), vertical = P.curve.reduce((best,p)=>p.x>best.x?p:best);
assert(top.x < vertical.x && top.angle > Math.PI / 2, 'The physical ramp must hook back past vertical');
assert(P.C.rampHeight/(vertical.x-P.C.rampX)>10,'The foot must turn into a tall, narrow upright');
assert((P.C.rampX-(P.C.padLeft+P.C.padRight)/2)/P.C.rampHeight>1.3,'The return landing must be far from the ramp');
assert(P.curve.some(p=>p.y>30&&p.angle>Math.PI/2),'The upper section must lean back');
const demo = run(P.demoInput);
assert(demo.releaseVX < 0 && demo.releaseAngle > Math.PI / 2, 'Launch must reverse the approach direction');
assert.equal(demo.state, 'landed', JSON.stringify(demo));
const unpoweredLanding = run(b => ({ drive: 1, vacuum: 1, assist: true }));
assert.equal(unpoweredLanding.state, 'crashed', 'A hard fall must not be accepted as a landing');
const noGrip = run(() => ({ drive: 1, vacuum: 0 }), 20);
assert(noGrip.maxAngle < P.C.endAngle, 'Low grip should fail to carry the car through the hook');
const empty = P.create();
Object.assign(empty, { state: 'running', attached: false, launched: true, fuel: 0, y: 30 });
P.step(empty, { up: 1, right: 1, pitch: 1 }, .1);
assert.equal(empty.vx, 0); assert(empty.vy < 0); assert.equal(empty.fuel, 0);
const suction=P.create();
for(let i=0;i<60;i++)P.step(suction,{vacuum:1},1/120);
assert(suction.vacuum>.99&&suction.state==='ready','Vacuum throttle works before driving');
for(let i=0;i<60;i++)P.step(suction,{vacuum:0},1/120);
assert.equal(suction.vacuum,0,'Releasing vacuum throttle must wind suction down');
for (const [control, axis, sign] of [['left','vx',-1],['right','vx',1],['up','vy',1],['down','vy',-1]]) {
  const b=P.create(); Object.assign(b,{state:'running',attached:false,y:30});
  P.step(b,{[control]:1},.1);
  assert(Math.sign(b[axis])===sign,`${control} must produce the correct force`);
  assert(b.fuel<100,`${control} must consume fuel`);
}
for (const sign of [-1,1]) {
  const b=P.create();Object.assign(b,{state:'running',attached:false,y:30});
  P.step(b,{pitch:sign,assist:false},.1); assert(Math.sign(b.omega)===sign);
}
console.log('PASS: hooked surface, reversed launch, controlled landing, hard crash, grip loss, four thrust directions, pitch jets, empty fuel.');
console.log(`Demo: ${demo.time.toFixed(1)}s, release vx ${demo.releaseVX.toFixed(1)}m/s, landing x ${demo.x.toFixed(1)}m, fuel ${demo.fuel.toFixed(0)}%.`);
