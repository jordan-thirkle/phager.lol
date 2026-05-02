import * as pc from 'playcanvas';
const OriginalEntity = pc.Entity;

let success = false;
global.pc = pc; // Let's try to override Entity on global pc
global.pc.Entity = class MockEntity {
  constructor(name) {
    this.name = name;
  }
  addComponent() {}
};

try {
  const e = new pc.Entity('test');
  e.addComponent('model');
  success = true;
} catch(err) {
  console.error("Error", err.message);
}

console.log("Success:", success);
