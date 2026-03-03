/**
 * Quick Alcohol Analysis - Nesbyen & Hemsedal only
 * Fetches 2025 data in weekly chunks
 */

const { getAccessToken, LOCATIONS } = require('../src/favrit.js');
const fs = require('fs');

const API_BASE = 'https://favrit.com/ws/accounting-api-service';

// Only locations with confirmed data
const ACTIVE_LOCATIONS = {
    'Nesbyen': [LOCATIONS.nesbyen],  // 113593088
    'Hemsedal': [LOCATIONS.hemsedal] // 248457994
};

async function fetchChunk(token, locationId, fromDate, toDate) {
    const url = `${API_BASE}/api/orderlines/v3/${locationId}?from-date=${fromDate}&to-date=${toDate}`;
    try {
        const response = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) return [];
        const text = await response.text();
        return parseCSV(text);
    } catch (e) {
        return [];
    }
}

function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(';');
    const orders = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';');
        const order = {};
        headers.forEach((h, idx) => { order[h] = values[idx] || ''; });
        order.quantity = parseFloat(order.quantity) || 0;
        orders.push(order);
    }
    return orders;
}

function classifyAlcohol(itemName) {
    const name = itemName.toLowerCase();
    
    // Skip false positives
    if (name.includes('syltetøy') || name.includes('americano') || name.includes('espresso')) return null;
    
    // Beer - look for specific patterns
    if (name.includes('tap beer') || name.includes('fatøl') || name.includes('hansa') || 
        name.includes('ringnes') || name.includes('pilsner') || name.includes('pils') ||
        (name.includes('øl') && !name.includes('kjøl'))) {
        // Detect size
        if (name.includes('0,6') || name.includes('0.6')) return { group: 1, size: 0.6 };
        if (name.includes('0,5') || name.includes('0.5')) return { group: 1, size: 0.5 };
        if (name.includes('0,4') || name.includes('0.4')) return { group: 1, size: 0.4 };
        return { group: 1, size: 0.5 }; // default
    }
    
    // Wine
    if ((name.includes('vin') && !name.includes('syltetøy')) || name.includes('prosecco') || 
        name.includes('champagne') || name.includes('cava')) {
        if (name.includes('flaske') || name.includes('75cl')) return { group: 2, size: 0.75 };
        return { group: 2, size: 0.15 };
    }
    
    // Spirits
    if (name.includes('drink') || name.includes('cocktail') || name.includes('gin ') ||
        name.includes('vodka') || name.includes('whisky') || name.includes('rum ') ||
        name.includes('aperol') || name.includes('spritz') || name.includes('mojito')) {
        return { group: 3, size: 0.04 };
    }
    
    return null;
}

async function analyze() {
    console.log('='.repeat(50));
    console.log('ALKOHOLSALG-ANALYSE 2025');
    console.log('='.repeat(50));
    
    const token = await getAccessToken();
    const results = { Nesbyen: { g1: 0, g2: 0, g3: 0, products: {} }, Hemsedal: { g1: 0, g2: 0, g3: 0, products: {} } };
    
    // Generate 47-hour chunks for all of 2025
    const chunks = [];
    let d = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-12-31T23:59:59Z');
    while (d < end) {
        const chunkEnd = new Date(Math.min(d.getTime() + 47*60*60*1000, end.getTime()));
        chunks.push([d.toISOString().split('.')[0], chunkEnd.toISOString().split('.')[0]]);
        d = new Date(chunkEnd.getTime() + 1000);
    }
    
    console.log(`Henter ${chunks.length} perioder per lokasjon...`);
    
    for (const [kommune, locIds] of Object.entries(ACTIVE_LOCATIONS)) {
        console.log(`\n📍 ${kommune}`);
        let totalOrders = 0;
        
        for (const locId of locIds) {
            for (let i = 0; i < chunks.length; i++) {
                if (i % 50 === 0) process.stdout.write(`  ${Math.round(i/chunks.length*100)}%...`);
                
                const orders = await fetchChunk(token, locId, chunks[i][0], chunks[i][1]);
                totalOrders += orders.length;
                
                for (const o of orders) {
                    if (o.order_line_type !== 'ORDER_LINE') continue;
                    const c = classifyAlcohol(o.item_name);
                    if (c) {
                        const liters = c.size * o.quantity;
                        results[kommune]['g' + c.group] += liters;
                        if (!results[kommune].products[o.item_name]) {
                            results[kommune].products[o.item_name] = { group: c.group, count: 0, liters: 0 };
                        }
                        results[kommune].products[o.item_name].count += o.quantity;
                        results[kommune].products[o.item_name].liters += liters;
                    }
                }
                
                // Small delay
                await new Promise(r => setTimeout(r, 50));
            }
        }
        console.log(` ${totalOrders} ordrelinjer totalt`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('RESULTAT - LITER SOLGT 2025');
    console.log('='.repeat(50));
    
    for (const [kommune, data] of Object.entries(results)) {
        console.log(`\n${kommune}:`);
        console.log(`  Gruppe 1 (Øl):        ${data.g1.toFixed(2)} liter`);
        console.log(`  Gruppe 2 (Vin):       ${data.g2.toFixed(2)} liter`);
        console.log(`  Gruppe 3 (Brennevin): ${data.g3.toFixed(2)} liter`);
        
        const prods = Object.entries(data.products);
        if (prods.length > 0) {
            console.log('  Produkter:');
            prods.forEach(([name, p]) => console.log(`    - ${name}: ${p.count} stk (${p.liters.toFixed(2)}L)`));
        }
    }
    
    // Note about Ål
    console.log('\n⚠️  Ål: Ingen data funnet i Favrit for 2025');
    
    // Save
    fs.writeFileSync('./data/alcohol-2025-final.json', JSON.stringify(results, null, 2));
    console.log('\n✅ Lagret til data/alcohol-2025-final.json');
}

analyze().catch(console.error);
