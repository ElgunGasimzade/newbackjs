const { spawn } = require('child_process');
const http = require('http');

const BASE_URL = 'http://localhost:8080/api/v1';
const SERVER_URL = 'http://localhost:8080';

// Helper to wait for server to be ready
function waitForServer(retries = 20) {
    return new Promise((resolve, reject) => {
        if (retries === 0) return reject(new Error('Server failed to start'));

        http.get(SERVER_URL, (res) => {
            // Server acts on root? Maybe not, but connection means it's up.
            // Actually our server doesn't have root handler, might 404, but that means it's UP.
            resolve();
        }).on('error', () => {
            // Not ready yet
            setTimeout(() => waitForServer(retries - 1).then(resolve).catch(reject), 500);
        });
    });
}

// Helper for fetch (Node 18+ has global fetch, covering my bases)
async function get(endpoint, headers = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
    if (!res.ok) throw new Error(`GET ${endpoint} failed: ${res.statusText}`);
    return res.json();
}

async function post(endpoint, body) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`POST ${endpoint} failed: ${res.statusText}`);
    return res.json();
}

async function verifyImage(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Image fetch failed: ${url} (${res.status})`);
    const type = res.headers.get('content-type');
    if (!type || !type.startsWith('image/')) throw new Error(`Invalid image content-type: ${type}`);
    console.log(`[PASS] Image Verified: ${url} (${type})`);
}

async function runTests() {
    console.log('--- STARTING BACKEND TESTS ---');

    // 1. Auth (Skipped - unused)
    // console.log('\n[TEST] Auth /guest-login');
    // const auth = await post('/auth/guest-login', { deviceId: 'test_dev_1' });
    // if (!auth.token || !auth.guestId) throw new Error('Invalid Auth Response');
    // console.log('[PASS] Auth successful');

    // 2. Home Feed (English Default)
    console.log('\n[TEST] Home Feed (Default/EN)');
    const homeEn = await get('/home/feed?page=1&limit=5');
    if (homeEn.hero.title !== "Deal of the Day ⚡️") throw new Error(`Expected EN Title, got: ${homeEn.hero.title}`);
    if (homeEn.products.length === 0) throw new Error('No products in Home Feed');

    // Check Keys
    const p1 = homeEn.products[0];
    if (!p1.name || !p1.brand || p1.price === undefined) throw new Error('Missing keys in Product (Check mapper!)');
    console.log(`[PASS] Home Feed EN (Items: ${homeEn.products.length}, Sample: ${p1.name})`);

    // 3. Home Feed (Azerbaijani)
    console.log('\n[TEST] Home Feed (Localization AZ)');
    const homeAz = await get('/home/feed', { 'Accept-Language': 'az' });
    if (homeAz.hero.title !== "Günün Təklifi ⚡️") throw new Error(`Expected AZ Title, got: ${homeAz.hero.title}`);
    console.log('[PASS] Home Feed AZ Localized');

    // 4. Image Verification
    console.log('\n[TEST] Image Serving');
    if (p1.imageUrl) {
        // If it's a localhost URL, we test it. If remote, we still test connectivity.
        await verifyImage(p1.imageUrl);
    } else {
        console.warn('[WARN] No image URL to test');
    }

    // 5. Search
    console.log('\n[TEST] Search "Milka"');
    const search = await get('/search?q=Milka');
    if (search.results.length === 0) throw new Error('Search returned no results');
    if (!search.results[0].name.toLowerCase().includes('milka')) throw new Error('Search result mismatch');
    console.log(`[PASS] Search Found ${search.results.length} items`);

    // 6. Brand Selection
    console.log('\n[TEST] Brand Deals');
    const brands = await get('/deals/brands');
    if (!brands.groups || brands.groups.length === 0) throw new Error('No Brand Groups found');
    console.log(`[PASS] Brand Groups: ${brands.groups.length}`);

    // 7. Planning
    console.log('\n[TEST] Planning Optimization');
    const plan = await post('/planning/optimize', { items: ["Un", "Yag", "Cay"] });
    if (!plan.options || plan.options.length < 2) throw new Error('Planning failed to generate options');
    const optA = plan.options.find(o => o.type === 'MAX_SAVINGS');
    if (!optA.totalSavings && optA.totalSavings !== 0) throw new Error('Missing totalSavings in Plan');
    console.log(`[PASS] Plan Generated (Savings: ${optA.totalSavings})`);

    console.log('\n--- ALL TESTS PASSED ---');
}

// Main Execution
const serverProcess = spawn('node', ['server.js'], { stdio: 'pipe' });
serverProcess.stdout.on('data', d => console.log(`[SERVER] ${d.toString().trim()}`));
serverProcess.stderr.on('data', d => console.error(`[SERVER ERR] ${d.toString().trim()}`));

console.log('Waiting for server...');
waitForServer()
    .then(runTests)
    .then(() => {
        console.log('Tearing down...');
        serverProcess.kill();
        process.exit(0);
    })
    .catch(err => {
        console.error('\n[FAIL] Test Suite Failed:', err);
        serverProcess.kill();
        process.exit(1);
    });
