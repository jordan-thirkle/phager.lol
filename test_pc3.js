import * as pc from 'playcanvas';
try {
  const app = new pc.Application(document.createElement('canvas')); // Need mock canvas?
  console.log("App success");
} catch(err) {
  console.error("Error", err);
}
