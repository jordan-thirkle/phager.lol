
const ITERATIONS = 10000000;
const masses = Array.from({length: 1000}, () => Math.random() * 1000 + 10);

function originalWay(mass) {
    return Math.pow(mass, 0.45) * 2.2;
}

function cachedWay(b) {
    if (b.mass !== b.lastMassForRadius) {
        b.radius = Math.pow(b.mass, 0.45) * 2.2;
        b.lastMassForRadius = b.mass;
    }
    return b.radius;
}

console.log(`Running benchmark with ${ITERATIONS} iterations...`);

// Baseline
let start = Date.now();
let sum1 = 0;
for (let i = 0; i < ITERATIONS; i++) {
    const mass = masses[i % 1000];
    sum1 += originalWay(mass);
}
let end = Date.now();
console.log(`Original Way: ${end - start}ms (sum: ${sum1.toFixed(2)})`);

// Cached (same mass)
const blobs = masses.map(m => ({ mass: m }));
start = Date.now();
let sum2 = 0;
for (let i = 0; i < ITERATIONS; i++) {
    const b = blobs[i % 1000];
    sum2 += cachedWay(b);
}
end = Date.now();
console.log(`Cached Way (constant mass): ${end - start}ms (sum: ${sum2.toFixed(2)})`);

// Cached (changing mass)
start = Date.now();
let sum3 = 0;
for (let i = 0; i < ITERATIONS; i++) {
    const b = blobs[i % 1000];
    if (i % 10 === 0) b.mass += 0.1; // simulate mass change
    sum3 += cachedWay(b);
}
end = Date.now();
console.log(`Cached Way (changing mass 10% of time): ${end - start}ms (sum: ${sum3.toFixed(2)})`);
