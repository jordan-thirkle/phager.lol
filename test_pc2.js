import { Entity, StandardMaterial } from 'playcanvas';
try {
  const e = new Entity();
  console.log("Entity success");
  const m = new StandardMaterial();
  console.log("Material success");
  e.addComponent('model', { type: 'cylinder' });
  console.log("Component success");
  e.setLocalScale(40, 5, 40);
  e.setLocalEulerAngles(90, 0, 0);
  e.setPosition(10, 20, 30);
  console.log("Transform success", e.getPosition());
} catch(err) {
  console.error("Playcanvas error:", err);
}
