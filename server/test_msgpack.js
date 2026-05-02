import { encode, decode } from '@msgpack/msgpack';

const m = new Map();
m.set('1', { id: 1, x: 10 });
m.set('2', { id: 2, x: 20 });

console.log(m);

try {
  const enc = encode(m);
  console.log("Encoded Map successfully:", enc);
  console.log("Decoded:", decode(enc));
} catch (e) {
  console.error("Failed to encode Map:", e);
}

const obj = { '1': { id: 1, x: 10 }, '2': { id: 2, x: 20 } };
try {
  const encObj = encode(obj);
  console.log("Encoded Obj successfully:", encObj);
  console.log("Decoded:", decode(encObj));
} catch (e) {
  console.error("Failed to encode Obj:", e);
}
