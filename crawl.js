const fs = require('fs');
const https = require('https');

function testEndpoint(url) {
    if (!url) return Promise.resolve(false);
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        }, (res) => {
            if (res.statusCode === 200) {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(true);
                    } catch (e) {
                        resolve(false);
                    }
                });
            } else {
                resolve(false);
            }
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

function getRedirectTarget(url) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(res.headers.location);
            } else {
                resolve(url);
            }
        });
        req.on('error', () => resolve(url));
        req.on('timeout', () => {
            req.destroy();
            resolve(url);
        });
    });
}

function fetchHtml(url) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        }, (res) => {
            if (res.statusCode === 200) {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            } else {
                resolve('');
            }
        });
        req.on('error', () => resolve(''));
        req.on('timeout', () => {
            req.destroy();
            resolve('');
        });
    });
}

async function resolveActiveDomain(resolverUrl) {
    if (!resolverUrl) return null;
    try {
        console.log(`Resolving redirect for: ${resolverUrl}`);
        const landingPage = await getRedirectTarget(resolverUrl);
        console.log(`Landing page target: ${landingPage}`);
        if (!landingPage || landingPage === resolverUrl) return null;
        
        const html = await fetchHtml(landingPage);
        if (!html) return null;
        
        // Find href containing sv1. or ticulam or tieulam
        const match = html.match(/href="https?:\/\/(sv1\.[a-zA-Z0-9.-]+\.[a-zA-Z0-9.]+)"/i);
        if (match && match[1]) {
            let host = match[1].split('/')[0];
            return "https://" + host;
        }
    } catch (e) {
        console.log(`Failed to resolve dynamic domain: ${e.message}`);
    }
    return null;
}

async function run() {
    console.log("Starting Auto-Heal API Link Checker...");
    
    // Candidates for TieuLam
    const tieuLamCandidates = [
        "https://sv.khandai-a.xyz/api/v1/external/fixtures/unfinished",
        "https://sv.tieulam.live/api/v1/external/fixtures/unfinished"
    ];
    let workingTieuLam = tieuLamCandidates[0];
    for (let url of tieuLamCandidates) {
        console.log(`Testing TieuLam: ${url}`);
        if (await testEndpoint(url)) {
            console.log(`-> WORKING: ${url}`);
            workingTieuLam = url;
            break;
        }
    }

    // Candidates for Xoilac / Socolive
    const xoilacCandidates = [
        "https://api.gvapi.cc/api/matches",
        "https://api.colatv.live/api/matches",
        "https://api.xoilaclinkwc2026.tv/api/matches"
    ];
    let workingXoilac = xoilacCandidates[0];
    for (let url of xoilacCandidates) {
        console.log(`Testing Xoilac: ${url}`);
        if (await testEndpoint(url)) {
            console.log(`-> WORKING: ${url}`);
            workingXoilac = url;
            break;
        }
    }

    // Candidates for Colalive
    const colaliveCandidates = [
        "https://api.cltvlv.com/api/matches",
        "https://d2av5eups05yh3.cloudfront.net/api/c5/business/livehouse/index",
        "https://d3j9d91vxmbmsx.cloudfront.net/api/c5/business/livehouse/index"
    ];
    let workingColalive = colaliveCandidates[0];
    for (let url of colaliveCandidates) {
        console.log(`Testing Colalive: ${url}`);
        if (await testEndpoint(url)) {
            console.log(`-> WORKING: ${url}`);
            workingColalive = url;
            break;
        }
    }

    // Candidates for LuongSon list
    const luongSonListCandidates = [
        "https://api-ls.cdnokvip.com/api/get-livestream-group?isHot=false&isLive=false&isToday=false&isTomorrow=false&offset=0",
        "https://api-ls.luongson.tv/api/get-livestream-group?isHot=false&isLive=false&isToday=false&isTomorrow=false&offset=0"
    ];
    let workingLuongSonList = luongSonListCandidates[0];
    let workingLuongSonDetailBase = "https://api-ls.cdnokvip.com/api/match-detail";
    
    for (let url of luongSonListCandidates) {
        console.log(`Testing LuongSon: ${url}`);
        if (await testEndpoint(url)) {
            console.log(`-> WORKING: ${url}`);
            workingLuongSonList = url;
            workingLuongSonDetailBase = url.split('?')[0].replace("get-livestream-group", "match-detail");
            break;
        }
    }

    // Read existing config.json to preserve structure
    const configPath = 'config.json';
    let configData = {};
    
    if (fs.existsSync(configPath)) {
        try {
            const content = fs.readFileSync(configPath, 'utf8');
            configData = JSON.parse(content);
            console.log("Successfully loaded existing config.json structure.");
        } catch (e) {
            console.log("Failed to parse existing config.json, initializing empty object.", e);
        }
    }

    // Ensure sources array exists
    if (!configData.sources) {
        configData.sources = [];
    }

    // Update URL fields in the sources list while maintaining the format
    for (let src of configData.sources) {
        if (src.id === 'tieulam') {
            src.api_url = workingTieuLam;
        } else if (src.id === 'xoilac') {
            src.api_url = workingXoilac;
        } else if (src.id === 'socolive') {
            src.api_url = workingXoilac; // SocoLive uses same candidates
        } else if (src.id === 'colalive') {
            src.api_url = workingColalive;
        } else if (src.id === 'luongson') {
            src.api_url = workingLuongSonList;
            src.luongson_detail_base = workingLuongSonDetailBase;
        }

        // If source has resolver_url configured, try resolving dynamic domain names
        if (src.resolver_url) {
            const resolvedDomain = await resolveActiveDomain(src.resolver_url);
            if (resolvedDomain) {
                console.log(`Resolved new active domain for ${src.id}: ${resolvedDomain}`);
                src.referer = resolvedDomain + "/";
                src.origin = resolvedDomain;
            }
        }
    }

    console.log("Final Generated Config structure:", JSON.stringify(configData, null, 2));
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    console.log("config.json merged and written successfully.");
}

run();
