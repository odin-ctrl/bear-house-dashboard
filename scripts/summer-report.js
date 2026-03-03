#!/usr/bin/env node

/**
 * Generate Summer Season Reports for Franchise Evaluation
 * June, July, August 2025
 */

const favrit = require('../src/favrit');

// Report configuration
const LOCATIONS = {
    nesbyen: 113593088,
    hemsedal: 248457994
};

const MONTHS = [
    { name: 'Juni', year: 2024, month: 6 },
    { name: 'Juli', year: 2024, month: 7 },
    { name: 'August', year: 2024, month: 8 }
];

/**
 * Get date range for a month
 */
function getMonthRange(year, month) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    
    // Format as ISO strings (UTC)
    const fromDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`;
    const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}T23:59:59`;
    
    return { fromDate, toDate };
}

/**
 * Analyze order lines for a period
 */
function analyzeOrders(orderLines) {
    // Filter to main order lines (not options/modifiers)
    const mainOrders = orderLines.filter(o => o.order_line_type === 'ORDER_LINE');
    
    // Calculate totals
    const totalSales = mainOrders.reduce((sum, o) => 
        sum + (o.amount_with_vat * o.quantity), 0
    );
    
    const totalItems = mainOrders.reduce((sum, o) => sum + o.quantity, 0);
    
    const uniqueOrders = new Set(mainOrders.map(o => o.order_reference)).size;
    
    const avgTicket = uniqueOrders > 0 ? totalSales / uniqueOrders : 0;
    
    // Group by product
    const productSales = {};
    mainOrders.forEach(o => {
        // Clean product name (remove variant info in parentheses)
        const name = o.item_name.split(' (')[0].trim();
        
        if (!productSales[name]) {
            productSales[name] = {
                name,
                quantity: 0,
                revenue: 0,
                avgPrice: 0
            };
        }
        
        productSales[name].quantity += o.quantity;
        productSales[name].revenue += o.amount_with_vat * o.quantity;
    });
    
    // Calculate average price per product
    Object.values(productSales).forEach(p => {
        p.avgPrice = p.quantity > 0 ? p.revenue / p.quantity : 0;
    });
    
    // Sort by quantity sold (top sellers)
    const topProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 20);
    
    return {
        totalSales,
        totalItems,
        uniqueOrders,
        avgTicket,
        topProducts,
        productCount: Object.keys(productSales).length
    };
}

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
function generateReport(locationName, monthName, analysis) {
    const lines = [];
    
    lines.push(`# Bear House ${locationName.toUpperCase()} - ${monthName} 2024`);
    lines.push('');
    lines.push('> **Sesongrapport for franchise-vurdering**');
    lines.push('');
    
    lines.push('## 📊 Nøkkeltall');
    lines.push('');
    lines.push(`- **Omsetning:** ${formatNOK(analysis.totalSales)}`);
    lines.push(`- **Antall ordrer:** ${analysis.uniqueOrders.toLocaleString('nb-NO')}`);
    lines.push(`- **Totalt solgte varer:** ${analysis.totalItems.toLocaleString('nb-NO')}`);
    lines.push(`- **Snittkurv:** ${formatNOK(analysis.avgTicket)}`);
    lines.push(`- **Varer per ordre:** ${(analysis.totalItems / analysis.uniqueOrders).toFixed(1)}`);
    lines.push(`- **Unike produkter:** ${analysis.productCount}`);
    lines.push('');
    
    lines.push('## 🏆 Topp 20 Produkter');
    lines.push('');
    lines.push('| # | Produkt | Solgt | Omsetning | Snitt pris |');
    lines.push('|---|---------|-------|-----------|------------|');
    
    analysis.topProducts.forEach((p, i) => {
        lines.push(`| ${i + 1} | ${p.name} | ${p.quantity.toLocaleString('nb-NO')} | ${formatNOK(p.revenue)} | ${formatNOK(p.avgPrice)} |`);
    });
    
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*Generert av Bear House Dashboard*');
    lines.push('');
    
    return lines.join('\n');
}

/**
 * Generate HTML report (prettier for email/web)
 */
function generateHTMLReport(locationName, monthName, analysis) {
    return `
<!DOCTYPE html>
<html lang="nb">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bear House ${locationName.toUpperCase()} - ${monthName} 2024</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 900px;
            margin: 40px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #e67e22;
            padding-bottom: 15px;
        }
        .subtitle {
            color: #7f8c8d;
            font-style: italic;
            margin-top: -10px;
        }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }
        .kpi-card {
            background: #ecf0f1;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }
        .kpi-label {
            color: #7f8c8d;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .kpi-value {
            color: #2c3e50;
            font-size: 28px;
            font-weight: bold;
            margin-top: 8px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background: #34495e;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .rank {
            font-weight: bold;
            color: #e67e22;
        }
        .footer {
            text-align: center;
            color: #95a5a6;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ecf0f1;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐻 Bear House ${locationName.toUpperCase()}</h1>
        <p class="subtitle">${monthName} 2024 - Sesongrapport for franchise-vurdering</p>
        
        <div class="kpi-grid">
            <div class="kpi-card">
                <div class="kpi-label">Omsetning</div>
                <div class="kpi-value">${formatNOK(analysis.totalSales)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Antall ordrer</div>
                <div class="kpi-value">${analysis.uniqueOrders.toLocaleString('nb-NO')}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Snittkurv</div>
                <div class="kpi-value">${formatNOK(analysis.avgTicket)}</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Varer per ordre</div>
                <div class="kpi-value">${(analysis.totalItems / analysis.uniqueOrders).toFixed(1)}</div>
            </div>
        </div>
        
        <h2>🏆 Topp 20 Produkter</h2>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Produkt</th>
                    <th>Solgt</th>
                    <th>Omsetning</th>
                    <th>Snitt pris</th>
                </tr>
            </thead>
            <tbody>
                ${analysis.topProducts.map((p, i) => `
                <tr>
                    <td class="rank">${i + 1}</td>
                    <td>${p.name}</td>
                    <td>${p.quantity.toLocaleString('nb-NO')}</td>
                    <td>${formatNOK(p.revenue)}</td>
                    <td>${formatNOK(p.avgPrice)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="footer">
            Generert av Bear House Dashboard<br>
            Kontakt: martin@bearhouse.no
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
    console.log('🐻 Bear House - Sommersesong Rapporter 2024');
    console.log('='.repeat(60));
    console.log('');
    
    for (const [locationName, locationId] of Object.entries(LOCATIONS)) {
        console.log(`\n📍 ${locationName.toUpperCase()}`);
        console.log('-'.repeat(60));
        
        for (const month of MONTHS) {
            console.log(`\n   📅 ${month.name} ${month.year}...`);
            
            try {
                const { fromDate, toDate } = getMonthRange(month.year, month.month);
                
                console.log(`      Henter data: ${fromDate} til ${toDate}`);
                const orderLines = await favrit.getOrderLines(locationId, fromDate, toDate);
                
                console.log(`      ✓ ${orderLines.length} orderlines hentet`);
                
                const analysis = analyzeOrders(orderLines);
                
                console.log(`      ✓ ${formatNOK(analysis.totalSales)} omsetning, ${analysis.uniqueOrders} ordrer`);
                
                // Generate reports
                const mdReport = generateReport(locationName, month.name, analysis);
                const htmlReport = generateHTMLReport(locationName, month.name, analysis);
                
                // Save to files
                const fs = require('fs');
                const path = require('path');
                const reportsDir = path.join(__dirname, '..', 'reports', 'summer-2024');
                
                if (!fs.existsSync(reportsDir)) {
                    fs.mkdirSync(reportsDir, { recursive: true });
                }
                
                const filePrefix = `${locationName}-${month.name.toLowerCase()}`;
                
                fs.writeFileSync(
                    path.join(reportsDir, `${filePrefix}.md`),
                    mdReport
                );
                
                fs.writeFileSync(
                    path.join(reportsDir, `${filePrefix}.html`),
                    htmlReport
                );
                
                console.log(`      ✓ Rapporter lagret: ${filePrefix}.md & .html`);
                
            } catch (error) {
                console.error(`      ✗ Feil: ${error.message}`);
            }
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Ferdig! Rapporter ligger i bear-house-dashboard/reports/summer-2024/');
    console.log('');
}

// Run
main().catch(console.error);
