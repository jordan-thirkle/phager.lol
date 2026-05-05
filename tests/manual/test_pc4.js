import * as pc from 'playcanvas';
const mockApp = { systems: { model: { addComponent: () => {} } } };
const e = new pc.Entity();
e._app = mockApp;
try {
  e.addComponent('model', { type: 'cylinder' });
  console.log("Component success");
} catch(err) {
  console.error("Error", err);
}
