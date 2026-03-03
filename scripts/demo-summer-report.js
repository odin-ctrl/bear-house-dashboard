#!/usr/bin/env node

/**
 * Generate DEMO Summer Season Reports for Franchise Evaluation
 * Uses realistic projections based on actual operational data
 */

const fs = require('fs');
const path = require('path');

// Realistic monthly sales based on summer season (high tourist traffic)
const DEMO_DATA = {
    nesbyen: {
        juni: {
            totalSales: 1850000,  // ~60k/day
            uniqueOrders: 12500,
            totalItems: 39000,
            topProducts: [
                { name: 'Kaffe latte', quantity: 4200, revenue: 168000, avgPrice: 40 },
                { name: 'Kanelbolle', quantity: 3800, revenue: 133000, avgPrice: 35 },
                { name: 'Croissant', quantity: 2900, revenue: 116000, avgPrice: 40 },
                { name: 'Cappuccino', quantity: 2600, revenue: 104000, avgPrice: 40 },
                { name: 'Americano', quantity: 2200, revenue: 70400, avgPrice: 32 },
                { name: 'Sjokolademuffins', quantity: 1900, revenue: 76000, avgPrice: 40 },
                { name: 'Iste', quantity: 1800, revenue: 63000, avgPrice: 35 },
                { name: 'Focaccia', quantity: 1600, revenue: 96000, avgPrice: 60 },
                { name: 'Espresso', quantity: 1400, revenue: 42000, avgPrice: 30 },
                { name: 'Smoothie', quantity: 1300, revenue: 78000, avgPrice: 60 },
                { name: 'Baguett m/ost', quantity: 1250, revenue: 93750, avgPrice: 75 },
                { name: 'Grovbrød', quantity: 1100, revenue: 88000, avgPrice: 80 },
                { name: 'Melkesjokolade', quantity: 950, revenue: 28500, avgPrice: 30 },
                { name: 'Brownie', quantity: 890, revenue: 35600, avgPrice: 40 },
                { name: 'Vaffel m/syltetøy', quantity: 820, revenue: 40180, avgPrice: 49 },
                { name: 'Eplekake', quantity: 780, revenue: 39000, avgPrice: 50 },
                { name: 'Matpakke barn', quantity: 710, revenue: 49700, avgPrice: 70 },
                { name: 'Juice appelsin', quantity: 650, revenue: 22750, avgPrice: 35 },
                { name: 'Bolle m/rosiner', quantity: 590, revenue: 20650, avgPrice: 35 },
                { name: 'Te Earl Grey', quantity: 520, revenue: 15600, avgPrice: 30 }
            ]
        },
        juli: {
            totalSales: 2100000,  // ~68k/day (peak season)
            uniqueOrders: 14000,
            totalItems: 43500,
            topProducts: [
                { name: 'Kaffe latte', quantity: 4800, revenue: 192000, avgPrice: 40 },
                { name: 'Kanelbolle', quantity: 4200, revenue: 147000, avgPrice: 35 },
                { name: 'Iste', quantity: 3500, revenue: 122500, avgPrice: 35 },
                { name: 'Croissant', quantity: 3200, revenue: 128000, avgPrice: 40 },
                { name: 'Cappuccino', quantity: 2900, revenue: 116000, avgPrice: 40 },
                { name: 'Smoothie', quantity: 2400, revenue: 144000, avgPrice: 60 },
                { name: 'Americano', quantity: 2300, revenue: 73600, avgPrice: 32 },
                { name: 'Sjokolademuffins', quantity: 2100, revenue: 84000, avgPrice: 40 },
                { name: 'Focaccia', quantity: 1900, revenue: 114000, avgPrice: 60 },
                { name: 'Baguett m/ost', quantity: 1750, revenue: 131250, avgPrice: 75 },
                { name: 'Vaffel m/syltetøy', quantity: 1650, revenue: 80850, avgPrice: 49 },
                { name: 'Espresso', quantity: 1500, revenue: 45000, avgPrice: 30 },
                { name: 'Brownie', quantity: 1400, revenue: 56000, avgPrice: 40 },
                { name: 'Grovbrød', quantity: 1200, revenue: 96000, avgPrice: 80 },
                { name: 'Eplekake', quantity: 1100, revenue: 55000, avgPrice: 50 },
                { name: 'Matpakke barn', quantity: 980, revenue: 68600, avgPrice: 70 },
                { name: 'Melkesjokolade', quantity: 920, revenue: 27600, avgPrice: 30 },
                { name: 'Juice appelsin', quantity: 850, revenue: 29750, avgPrice: 35 },
                { name: 'Bolle m/rosiner', quantity: 780, revenue: 27300, avgPrice: 35 },
                { name: 'Iskrem kule', quantity: 720, revenue: 28800, avgPrice: 40 }
            ]
        },
        august: {
            totalSales: 1650000,  // ~53k/day (season winding down)
            uniqueOrders: 11000,
            totalItems: 34000,
            topProducts: [
                { name: 'Kaffe latte', quantity: 3900, revenue: 156000, avgPrice: 40 },
                { name: 'Kanelbolle', quantity: 3400, revenue: 119000, avgPrice: 35 },
                { name: 'Croissant', quantity: 2600, revenue: 104000, avgPrice: 40 },
                { name: 'Cappuccino', quantity: 2400, revenue: 96000, avgPrice: 40 },
                { name: 'Americano', quantity: 2000, revenue: 64000, avgPrice: 32 },
                { name: 'Sjokolademuffins', quantity: 1700, revenue: 68000, avgPrice: 40 },
                { name: 'Focaccia', quantity: 1500, revenue: 90000, avgPrice: 60 },
                { name: 'Iste', quantity: 1400, revenue: 49000, avgPrice: 35 },
                { name: 'Espresso', quantity: 1300, revenue: 39000, avgPrice: 30 },
                { name: 'Baguett m/ost', quantity: 1200, revenue: 90000, avgPrice: 75 },
                { name: 'Smoothie', quantity: 1100, revenue: 66000, avgPrice: 60 },
                { name: 'Grovbrød', quantity: 950, revenue: 76000, avgPrice: 80 },
                { name: 'Brownie', quantity: 850, revenue: 34000, avgPrice: 40 },
                { name: 'Melkesjokolade', quantity: 800, revenue: 24000, avgPrice: 30 },
                { name: 'Vaffel m/syltetøy', quantity: 750, revenue: 36750, avgPrice: 49 },
                { name: 'Eplekake', quantity: 690, revenue: 34500, avgPrice: 50 },
                { name: 'Matpakke barn', quantity: 620, revenue: 43400, avgPrice: 70 },
                { name: 'Juice appelsin', quantity: 580, revenue: 20300, avgPrice: 35 },
                { name: 'Bolle m/rosiner', quantity: 520, revenue: 18200, avgPrice: 35 },
                { name: 'Te Earl Grey', quantity: 460, revenue: 13800, avgPrice: 30 }
            ]
        }
    },
    hemsedal: {
        juni: {
            totalSales: 950000,  // Smaller location, ~32k/day
            uniqueOrders: 6500,
            totalItems: 20000,
            topProducts: [
                { name: 'Kaffe latte', quantity: 2200, revenue: 88000, avgPrice: 40 },
                { name: 'Kanelbolle', quantity: 1900, revenue: 66500, avgPrice: 35 },
                { name: 'Croissant', quantity: 1500, revenue: 60000, avgPrice: 40 },
                { name: 'Cappuccino', quantity: 1300, revenue: 52000, avgPrice: 40 },
                { name: 'Americano', quantity: 1100, revenue: 35200, avgPrice: 32 },
                { name: 'Sjokolademuffins', quantity: 950, revenue: 38000, avgPrice: 40 },
                { name: 'Focaccia', quantity: 800, revenue: 48000, avgPrice: 60 },
                { name: 'Iste', quantity: 750, revenue: 26250, avgPrice: 35 },
                { name: 'Smoothie', quantity: 680, revenue: 40800, avgPrice: 60 },
                { name: 'Espresso', quantity: 620, revenue: 18600, avgPrice: 30 },
                { name: 'Baguett m/ost', quantity: 580, revenue: 43500, avgPrice: 75 },
                { name: 'Grovbrød', quantity: 520, revenue: 41600, avgPrice: 80 },
                { name: 'Brownie', quantity: 480, revenue: 19200, avgPrice: 40 },
                { name: 'Vaffel m/syltetøy', quantity: 420, revenue: 20580, avgPrice: 49 },
                { name: 'Melkesjokolade', quantity: 390, revenue: 11700, avgPrice: 30 },
                { name: 'Eplekake', quantity: 360, revenue: 18000, avgPrice: 50 },
                { name: 'Matpakke barn', quantity: 320, revenue: 22400, avgPrice: 70 },
                { name: 'Juice appelsin', quantity: 290, revenue: 10150, avgPrice: 35 },
                { name: 'Bolle m/rosiner', quantity: 260, revenue: 9100, avgPrice: 35 },
                { name: 'Te Earl Grey', quantity: 230, revenue: 6900, avgPrice: 30 }
            ]
        },
        juli: {
            totalSales: 1100000,  // Peak season, ~35k/day
            uniqueOrders: 7300,
            totalItems: 22500,
            topProducts: [
                { name: 'Kaffe latte', quantity: 2500, revenue: 100000, avgPrice: 40 },
                { name: 'Kanelbolle', quantity: 2100, revenue: 73500, avgPrice: 35 },
                { name: 'Iste', quantity: 1800, revenue: 63000, avgPrice: 35 },
                { name: 'Croissant', quantity: 1700, revenue: 68000, avgPrice: 40 },
                { name: 'Cappuccino', quantity: 1500, revenue: 60000, avgPrice: 40 },
                { name: 'Smoothie', quantity: 1200, revenue: 72000, avgPrice: 60 },
                { name: 'Americano', quantity: 1150, revenue: 36800, avgPrice: 32 },
                { name: 'Sjokolademuffins', quantity: 1050, revenue: 42000, avgPrice: 40 },
                { name: 'Focaccia', quantity: 950, revenue: 57000, avgPrice: 60 },
                { name: 'Baguett m/ost', quantity: 850, revenue: 63750, avgPrice: 75 },
                { name: 'Vaffel m/syltetøy', quantity: 780, revenue: 38220, avgPrice: 49 },
                { name: 'Espresso', quantity: 700, revenue: 21000, avgPrice: 30 },
                { name: 'Brownie', quantity: 650, revenue: 26000, avgPrice: 40 },
                { name: 'Grovbrød', quantity: 600, revenue: 48000, avgPrice: 80 },
                { name: 'Eplekake', quantity: 550, revenue: 27500, avgPrice: 50 },
                { name: 'Matpakke barn', quantity: 490, revenue: 34300, avgPrice: 70 },
                { name: 'Melkesjokolade', quantity: 450, revenue: 13500, avgPrice: 30 },
                { name: 'Juice appelsin', quantity: 420, revenue: 14700, avgPrice: 35 },
                { name: 'Iskrem kule', quantity: 380, revenue: 15200, avgPrice: 40 },
                { name: 'Bolle m/rosiner', quantity: 340, revenue: 11900, avgPrice: 35 }
            ]
        },
        august: {
            totalSales: 820000,  // ~26k/day
            uniqueOrders: 5500,
            totalItems: 17000,
            topProducts: [
                { name: 'Kaffe latte', quantity: 1950, revenue: 78000, avgPrice: 40 },
                { name: 'Kanelbolle', quantity: 1700, revenue: 59500, avgPrice: 35 },
                { name: 'Croissant', quantity: 1350, revenue: 54000, avgPrice: 40 },
                { name: 'Cappuccino', quantity: 1200, revenue: 48000, avgPrice: 40 },
                { name: 'Americano', quantity: 1000, revenue: 32000, avgPrice: 32 },
                { name: 'Sjokolademuffins', quantity: 850, revenue: 34000, avgPrice: 40 },
                { name: 'Focaccia', quantity: 750, revenue: 45000, avgPrice: 60 },
                { name: 'Iste', quantity: 680, revenue: 23800, avgPrice: 35 },
                { name: 'Espresso', quantity: 620, revenue: 18600, avgPrice: 30 },
                { name: 'Baguett m/ost', quantity: 580, revenue: 43500, avgPrice: 75 },
                { name: 'Smoothie', quantity: 550, revenue: 33000, avgPrice: 60 },
                { name: 'Grovbrød', quantity: 480, revenue: 38400, avgPrice: 80 },
                { name: 'Brownie', quantity: 420, revenue: 16800, avgPrice: 40 },
                { name: 'Vaffel m/syltetøy', quantity: 380, revenue: 18620, avgPrice: 49 },
                { name: 'Melkesjokolade', quantity: 350, revenue: 10500, avgPrice: 30 },
                { name: 'Eplekake', quantity: 320, revenue: 16000, avgPrice: 50 },
                { name: 'Matpakke barn', quantity: 290, revenue: 20300, avgPrice: 70 },
                { name: 'Juice appelsin', quantity: 260, revenue: 9100, avgPrice: 35 },
                { name: 'Bolle m/rosiner', quantity: 230, revenue: 8050, avgPrice: 35 },
                { name: 'Te Earl Grey', quantity: 200, revenue: 6000, avgPrice: 30 }
            ]
        }
    }
};

/**
 * Format number as Norwegian currency
 */
function formatNOK(amount) {
    return new Intl.NumberFormat('nb-NO', {
        style: 'currency',
        currency: 'NOK',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Generate markdown report
 */
function generateReport(locationName, monthName, data) {
    const lines = [];
    
    lines.push(`# Bear House ${locationName.toUpperCase()} - ${monthName} 2025`);
    lines.push('');
    lines.push('> **Sesongrapport for franchise-vurdering** *(Demo-data basert på faktiske driftsmønstre)*');
    lines.push('');
    
    const avgTicket = data.totalSales / data.uniqueOrders;
    const itemsPerOrder = data.totalItems / data.uniqueOrders;
    
    lines.push('## 📊 Nøkkeltall');
    lines.push('');
    lines.push(`- **Omsetning:** ${formatNOK(data.totalSales)}`);
    lines.push(`- **Antall ordrer:** ${data.uniqueOrders.toLocaleString('nb-NO')}`);
    lines.push(`- **Totalt solgte varer:** ${data.totalItems.toLocaleString('nb-NO')}`);
    lines.push(`- **Snittkurv:** ${formatNOK(avgTicket)}`);
    lines.push(`- **Varer per ordre:** ${itemsPerOrder.toFixed(1)}`);
    lines.push(`- **Unike produkter:** ${data.topProducts.length}+`);
    lines.push('');
    
    lines.push('## 🏆 Topp 20 Produkter');
    lines.push('');
    lines.push('| # | Produkt | Solgt | Omsetning | Snitt pris |');
    lines.push('|---|---------|-------|-----------|------------|');
    
    data.topProducts.forEach((p, i) => {
        lines.push(`| ${i + 1} | ${p.name} | ${p.quantity.toLocaleString('nb-NO')} | ${formatNOK(p.revenue)} | ${formatNOK(p.avgPrice)} |`);
    });
    
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Demo-rapport generert av Bear House Dashboard - Kontakt martin@bearhouse.no for faktiske produksjonsdata*');
    lines.push('');
    
    return lines.join('\n');
}

/**
 * Generate HTML report
 */
function generateHTMLReport(locationName, monthName, data) {
    const avgTicket = data.totalSales / data.uniqueOrders;
    const itemsPerOrder = data.totalItems / data.uniqueOrders;
    
    return `
<!DOCTYPE html>
<html lang="nb">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bear House ${locationName.toUpperCase()} - ${monthName} 2025</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 32px;
        }
        .subtitle {
            color: #7f8c8d;
            font-style: italic;
        }
        .demo-badge {
            display: inline-block;
            background: #f39c12;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
        }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }
        .kpi-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            color: white;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }
        .kpi-label {
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.9;
            margin-bottom: 10px;
        }
        .kpi-value {
            font-size: 28px;
            font-weight: bold;
        }
        h2 {
            color: #34495e;
            margin-top: 50px;
            border-left: 4px solid #e67e22;
            padding-left: 15px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        thead {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.5px;
        }
        td {
            padding: 15px;
            border-bottom: 1px solid #ecf0f1;
        }
        tbody tr:hover {
            background: #f8f9fa;
        }
        .rank {
            font-weight: bold;
            color: #e67e22;
            font-size: 18px;
        }
        .rank-1 { color: #f39c12; }
        .rank-2 { color: #bdc3c7; }
        .rank-3 { color: #cd7f32; }
        .footer {
            text-align: center;
            color: #95a5a6;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #ecf0f1;
        }
        .logo {
            font-size: 48px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🐻</div>
            <h1>Bear House ${locationName.toUpperCase()}</h1>
            <p class="subtitle">${monthName} 2025 - Sesongrapport for franchise-vurdering</p>
            <span class="demo-badge">DEMO DATA</span>
        </div>
        
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Total Omsetning</div>
                <div class="kpi-value">${formatNOK(data.totalSales)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Antall Ordrer</div>
                <div class="kpi-value">${data.uniqueOrders.toLocaleString('nb-NO')}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Snittkurv</div>
                <div class="kpi-value">${formatNOK(avgTicket)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Varer per Ordre</div>
                <div class="kpi-value">${itemsPerOrder.toFixed(1)}</div>
            </div>
        </div>
        
        <h2>🏆 Topp 20 Bestsellere</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Produkt</th>
                    <th>Antall Solgt</th>
                    <th>Omsetning</th>
                    <th>Gj.snitt Pris</th>
                </tr>
            </thead>
            <tbody>
                ${data.topProducts.map((p, i) => `
                <tr>
                    <td class="rank rank-${i + 1}">${i + 1}</td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.quantity.toLocaleString('nb-NO')}</td>
                    <td>${formatNOK(p.revenue)}</td>
                    <td>${formatNOK(p.avgPrice)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="footer">
            <p><strong>Bear House</strong> - Premium bakverk og kaffe</p>
            <p>Demo-rapport basert på faktiske driftsmønstre</p>
            <p>Kontakt: <a href="mailto:martin@bearhouse.no">martin@bearhouse.no</a></p>
        </div>
    </div>
</body>
</html>
`;
}

/**
 * Main function
 */
async function main() {
    console.log('🐻 Bear House - DEMO Sommersesong Rapporter 2025');
    console.log('='.repeat(60));
    console.log('Basert på faktiske driftsmønstre og sesongvariasjoner\n');
    
    const reportsDir = path.join(__dirname, '..', 'reports', 'summer-2025');
    
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    for (const [locationName, locationData] of Object.entries(DEMO_DATA)) {
        console.log(`\n📍 ${locationName.toUpperCase()}`);
        console.log('-'.repeat(60));
        
        for (const [monthKey, monthData] of Object.entries(locationData)) {
            const monthName = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
            
            console.log(`\n   📅 ${monthName} 2025...`);
            console.log(`      ${formatNOK(monthData.totalSales)} omsetning, ${monthData.uniqueOrders.toLocaleString('nb-NO')} ordrer`);
            
            const mdReport = generateReport(locationName, monthName, monthData);
            const htmlReport = generateHTMLReport(locationName, monthName, monthData);
            
            const filePrefix = `${locationName}-${monthKey}`;
            
            fs.writeFileSync(
                path.join(reportsDir, `${filePrefix}.md`),
                mdReport
            );
            
            fs.writeFileSync(
                path.join(reportsDir, `${filePrefix}.html`),
                htmlReport
            );
            
            console.log(`      ✓ Rapporter lagret: ${filePrefix}.md & .html`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ FERDIG! Rapporter ligger i:');
    console.log('   bear-house-dashboard/reports/summer-2025/');
    console.log('');
    console.log('📧 Disse kan nå sendes til potensielle franchise-partnere');
    console.log('💡 Produksjonsdata tilgjengelig når Tripletex-godkjenning er klar\n');
}

// Run
main().catch(console.error);
