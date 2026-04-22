const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  await page.goto('http://localhost:3001');
  await page.type('#nameInput', 'TEST');
  await page.click('#playBtn');
  await new Promise(r => setTimeout(r, 1000));
  
  // Inject script to track my blob position
  await page.evaluate(() => {
    window.lastPos = null;
    setInterval(() => {
      const me = AppState.gameState.players.find(p => p.id === AppState.myId);
      if (me && me.blobs[0]) {
        if (window.lastPos) {
           console.log(`Blob X: ${me.blobs[0].x.toFixed(2)}, Z: ${me.blobs[0].z.toFixed(2)}`);
        }
        window.lastPos = { x: me.blobs[0].x, z: me.blobs[0].z };
      }
    }, 500);

  });

  // Move mouse to top right
  await page.mouse.move(800, 100);
  console.log('Moved mouse to 800, 100');
  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();
