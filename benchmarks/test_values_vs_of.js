import { performance } from 'perf_hooks';

const foods = {};
for (let i = 0; i < 2000; i++) {
    foods[i] = { id: i, x: Math.random(), z: Math.random() };
}

function withIn() {
    let sum = 0;
    for (const id in foods) {
        sum += foods[id].x;
    }
    return sum;
}

function withValuesI() {
    let sum = 0;
    const vals = Object.values(foods);
    for (let i = 0; i < vals.length; i++) {
        sum += vals[i].x;
    }
    return sum;
}

function withValuesOf() {
    let sum = 0;
    for (const f of Object.values(foods)) {
        sum += f.x;
    }
    return sum;
}

for (let i = 0; i < 1000; i++) withIn();
for (let i = 0; i < 1000; i++) withValuesI();
for (let i = 0; i < 1000; i++) withValuesOf();

let start1 = performance.now();
for (let i = 0; i < 10000; i++) withIn();
console.log(`for...in: ${performance.now() - start1} ms`);

let start2 = performance.now();
for (let i = 0; i < 10000; i++) withValuesI();
console.log(`Object.values[i]: ${performance.now() - start2} ms`);

let start3 = performance.now();
for (let i = 0; i < 10000; i++) withValuesOf();
console.log(`Object.values of: ${performance.now() - start3} ms`);
