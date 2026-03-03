/**
 * Alcohol Sales Analysis for Bear House / Nes Bakeri
 * Reports liters sold by group (1=beer, 2=wine, 3=spirits) per municipality
 * Period: 2025
 */

const { getAccessToken, LOCATIONS } = require('../src/favrit.js');

// Municipality groupings
const MUNICIPALITIES = {
    'Nesbyen': [LOCATIONS.nesbyen, LOCATIONS.nesbyen_pizzeria],
    'Ål': [LOCATIONS.al_bakeri, LOCATIONS.al_bearhouse],
    'Hemsedal': [LOCATIONS.hemsedal, LOCATIONS.hemsedal_takeaway]
};

// API config
const API_BASE = 'https://favrit.com/ws/accounting-api-service';

/**
 * Fetch order lines for a location with 48-hour chunking
 */
async function fetchOrderLinesChunked(locationId, startDate, endDate) {
    const token = await getAccessToken();
    const allOrders = [];
    
    let currentStart = new Date(startDate);
    const finalEnd = new Date(endDate);
    
    while (currentStart < finalEnd) {
        let currentEnd = new Date(currentStart.getTime() + (47 * 60 * 60 * 1000)); // 47 hours
        if (currentEnd > finalEnd) currentEnd = finalEnd;
        
        const fromDate = currentStart.toISOString().replace('Z', '').split('.')[0];
        const toDate = currentEnd.toISOString().replace('Z', '').split('.')[0];
        
        const url = `${API_BASE}/api/orderlines/v3/${locationId}?from-date=${fromDate}&to-date=${toDate}`;
        
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const csvText = await response.text();
                const orders = parseCSV(csvText);
                allOrders.push(...orders);
            }
        } catch (error) {
            console.error(`    Error fetching chunk: ${error.message}`);
        }
        
        // Move to next chunk
        currentStart = new Date(currentEnd.getTime() + 1000);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return allOrders;
}

/**
 * Parse CSV to JSON
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(';');
    const orders = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';');
        const order = {};
        headers.forEach((header, index) => {
            order[header] = values[index] || '';
        });
        order.quantity = parseFloat(order.quantity) || 0;
        orders.push(order);
    }
    
    return orders;
}

/**
 * Classify product as alcohol
 */
function classifyProduct(itemName) {
    const name = itemName.toLowerCase();
    
    // Beer detection
    const beerKeywords = ['øl', 'pils', 'ale', 'lager', 'ipa', 'pilsner', 'hansa', 'ringnes', 'tuborg', 'carlsberg', 'corona', 'heineken', 'fatøl', 'halvliter', 'beer'];
    for (const kw of beerKeywords) {
        if (name.includes(kw)) {
            if (name.includes('0,6') || name.includes('0.6') || name.includes('60cl') || name.includes('stor')) {
                return { group: 1, type: 'beer', size: 0.6 };
            } else if (name.includes('0,5') || name.includes('0.5') || name.includes('50cl') || name.includes('halvliter')) {
                return { group: 1, type: 'beer', size: 0.5 };
            } else if (name.includes('0,4') || name.includes('0.4') || name.includes('40cl')) {
                return { group: 1, type: 'beer', size: 0.4 };
            }
            return { group: 1, type: 'beer', size: 0.5 }; // Default
        }
    }
    
    // Wine detection
    const wineKeywords = ['vin', 'rødvin', 'hvitvin', 'rosévin', 'rose', 'prosecco', 'champagne', 'cava', 'musserende', 'glass vin', 'husets vin', 'wine'];
    for (const kw of wineKeywords) {
        if (name.includes(kw)) {
            if (name.includes('flaske') || name.includes('75cl') || name.includes('0,75')) {
                return { group: 2, type: 'wine', size: 0.75 };
            }
            return { group: 2, type: 'wine', size: 0.15 };
        }
    }
    
    // Spirits detection
    const spiritKeywords = ['drink', 'cocktail', 'gin', 'vodka', 'whisky', 'whiskey', 'rum', 'tequila', 'aperol', 'spritz', 'mojito', 'margarita', 'shot', 'brennevin', 'akevitt', 'cognac', 'likør', 'negroni', 'daiquiri'];
    for (const kw of spiritKeywords) {
        if (name.includes(kw)) {
            return { group: 3, type: 'spirits', size: 0.04 };
        }
    }
    
    return null;
}

async function analyzeAlcoholSales() {
    console.log('='.repeat(60));
    console.log('ALKOHOLSALG-ANALYSE 2025');
    console.log('Bear House / Nes Bakeri');
    console.log('='.repeat(60));
    console.log('Henter data fra Favrit (dette tar litt tid pga 48t-begrensning)...\n');
    
    const results = {};
    const alcoholProducts = {};
    
    for (const [municipality, locationIds] of Object.entries(MUNICIPALITIES)) {
        console.log(`\n📍 ${municipality.toUpperCase()}`);
        console.log('-'.repeat(40));
        
        results[municipality] = {
            group1: { liters: 0, count: 0, products: {} },
            group2: { liters: 0, count: 0, products: {} },
            group3: { liters: 0, count: 0, products: {} }
        };
        
        for (const locationId of locationIds) {
            console.log(`  Henter lokasjon ${locationId}...`);
            
            const orders = await fetchOrderLinesChunked(
                locationId,
                '2025-01-01T00:00:00',
                '2025-12-31T23:59:59'
            );
            
            console.log(`    → ${orders.length} ordrelinjer`);
            
            // Filter ORDER_LINE only
            const mainOrders = orders.filter(o => o.order_line_type === 'ORDER_LINE');
            
            for (const order of mainOrders) {
                const itemName = order.item_name || '';
                const quantity = order.quantity || 0;
                
                const classification = classifyProduct(itemName);
                
                if (classification) {
                    const groupKey = `group${classification.group}`;
                    const liters = classification.size * quantity;
                    
                    results[municipality][groupKey].liters += liters;
                    results[municipality][groupKey].count += quantity;
                    
                    if (!results[municipality][groupKey].products[itemName]) {
                        results[municipality][groupKey].products[itemName] = { count: 0, liters: 0, size: classification.size };
                    }
                    results[municipality][groupKey].products[itemName].count += quantity;
                    results[municipality][groupKey].products[itemName].liters += liters;
                    
                    if (!alcoholProducts[itemName]) {
                        alcoholProducts[itemName] = { group: classification.group, type: classification.type, size: classification.size };
                    }
                }
            }
        }
    }
    
    // Print summary
    console.log('\n\n' + '='.repeat(60));
    console.log('SAMMENDRAG - LITER SOLGT PER KOMMUNE (2025)');
    console.log('='.repeat(60));
    
    let grandTotal = { group1: 0, group2: 0, group3: 0 };
    
    for (const [municipality, data] of Object.entries(results)) {
        console.log(`\n📍 ${municipality}`);
        console.log(`   Gruppe 1 (Øl):        ${data.group1.liters.toFixed(2)} liter (${data.group1.count} serveringer)`);
        console.log(`   Gruppe 2 (Vin):       ${data.group2.liters.toFixed(2)} liter (${data.group2.count} serveringer)`);
        console.log(`   Gruppe 3 (Brennevin): ${data.group3.liters.toFixed(2)} liter (${data.group3.count} serveringer)`);
        
        grandTotal.group1 += data.group1.liters;
        grandTotal.group2 += data.group2.liters;
        grandTotal.group3 += data.group3.liters;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('TOTALT ALLE KOMMUNER');
    console.log('='.repeat(60));
    console.log(`   Gruppe 1 (Øl):        ${grandTotal.group1.toFixed(2)} liter`);
    console.log(`   Gruppe 2 (Vin):       ${grandTotal.group2.toFixed(2)} liter`);
    console.log(`   Gruppe 3 (Brennevin): ${grandTotal.group3.toFixed(2)} liter`);
    
    // Print top products
    console.log('\n' + '='.repeat(60));
    console.log('IDENTIFISERTE ALKOHOLPRODUKTER');
    console.log('='.repeat(60));
    
    const sortedProducts = Object.entries(alcoholProducts).sort((a, b) => a[1].group - b[1].group);
    for (const [name, info] of sortedProducts) {
        console.log(`   [Gr.${info.group}] ${name} (${(info.size * 100).toFixed(0)}cl)`);
    }
    
    // Save to JSON
    const outputPath = require('path').join(__dirname, '../data/alcohol-analysis-2025.json');
    require('fs').writeFileSync(outputPath, JSON.stringify({
        period: '2025-01-01 to 2025-12-31',
        generatedAt: new Date().toISOString(),
        summary: {
            Nesbyen: {
                gruppe1_ol_liter: parseFloat(results.Nesbyen.group1.liters.toFixed(2)),
                gruppe2_vin_liter: parseFloat(results.Nesbyen.group2.liters.toFixed(2)),
                gruppe3_brennevin_liter: parseFloat(results.Nesbyen.group3.liters.toFixed(2))
            },
            Ål: {
                gruppe1_ol_liter: parseFloat(results.Ål.group1.liters.toFixed(2)),
                gruppe2_vin_liter: parseFloat(results.Ål.group2.liters.toFixed(2)),
                gruppe3_brennevin_liter: parseFloat(results.Ål.group3.liters.toFixed(2))
            },
            Hemsedal: {
                gruppe1_ol_liter: parseFloat(results.Hemsedal.group1.liters.toFixed(2)),
                gruppe2_vin_liter: parseFloat(results.Hemsedal.group2.liters.toFixed(2)),
                gruppe3_brennevin_liter: parseFloat(results.Hemsedal.group3.liters.toFixed(2))
            }
        },
        totals: {
            gruppe1_ol_liter: parseFloat(grandTotal.group1.toFixed(2)),
            gruppe2_vin_liter: parseFloat(grandTotal.group2.toFixed(2)),
            gruppe3_brennevin_liter: parseFloat(grandTotal.group3.toFixed(2))
        },
        detailedResults: results,
        identifiedProducts: alcoholProducts
    }, null, 2));
    
    console.log(`\n✅ Detaljert rapport lagret: ${outputPath}`);
    
    return results;
}

analyzeAlcoholSales().catch(console.error);
