#!/usr/bin/env node
/**
 * Daily Average Ticket XP Script
 * Runs daily to check if yesterday's avg ticket hit the goal
 * Gives 10 XP to all store employees who worked that day
 * 
 * Usage: node scripts/daily-avgticket-xp.js [YYYY-MM-DD]
 * If no date provided, uses yesterday
 */

const path = require('path');
const fs = require('fs');

// Load modules
const favrit = require('../src/favrit');
const avgTicketModule = require('../src/avgticket');
const gamification = require('../src/gamification');

// Planday config
const PLANDAY = {
    clientId: 'eea0dc07-83f6-4df7-9792-79b120ba7839',
    refreshToken: 'MTnGQFLsIECNhGOFEwYrNg',
    tokenUrl: 'https://id.planday.com/connect/token',
    apiBase: 'https://openapi.planday.com'
};

// Store departments (production excluded)
const STORE_DEPARTMENTS = {
    nesbyen: [16761],  // Nesbyen butikk
    hemsedal: [16854]  // Hemsedal butikk
};

// Planday token cache
let plandayToken = null;
let tokenExpiry = 0;

async function getPlandayToken() {
    if (plandayToken && Date.now() < tokenExpiry - 60000) {
        return plandayToken;
    }

    const response = await fetch(PLANDAY.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `client_id=${PLANDAY.clientId}&grant_type=refresh_token&refresh_token=${PLANDAY.refreshToken}`
    });

    const data = await response.json();
    plandayToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
    return plandayToken;
}

async function getShiftsForDate(date, departmentIds) {
    const token = await getPlandayToken();
    const dateStr = date.toISOString().split('T')[0];
    
    const response = await fetch(
        `${PLANDAY.apiBase}/scheduling/v1/shifts?from=${dateStr}&to=${dateStr}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-ClientId': PLANDAY.clientId
            }
        }
    );

    const data = await response.json();
    const shifts = data.data || [];
    
    // Filter to store departments only
    return shifts.filter(s => 
        departmentIds.includes(s.departmentId) && 
        s.employeeId && 
        s.status !== 'Cancelled'
    );
}

async function getSalesForDate(location, date) {
    const locationId = favrit.LOCATIONS[location];
    if (!locationId) return null;

    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const orders = await favrit.getOrderLines(
        locationId,
        dayStart.toISOString().replace('Z', ''),
        dayEnd.toISOString().replace('Z', '')
    );

    const mainOrders = orders.filter(o => o.order_line_type === 'ORDER_LINE');
    const totalSales = mainOrders.reduce((sum, o) => sum + (o.amount_with_vat * o.quantity), 0);
    const uniqueOrders = new Set(mainOrders.map(o => o.order_reference)).size;

    return {
        sales: Math.round(totalSales),
        transactions: uniqueOrders,
        avgTicket: uniqueOrders > 0 ? Math.round(totalSales / uniqueOrders) : 0
    };
}

async function processLocation(location, date) {
    console.log(`\n📍 ${location.toUpperCase()}`);
    
    // Get sales data
    const salesData = await getSalesForDate(location, date);
    if (!salesData || salesData.transactions < 10) {
        console.log(`   ⚠️  Ikke nok data (${salesData?.transactions || 0} transaksjoner)`);
        return { location, skipped: true, reason: 'insufficient_data' };
    }

    const { avgTicket, sales, transactions } = salesData;
    const goal = avgTicketModule.getAvgTicketGoal(location);
    const goalMet = avgTicket >= goal;

    console.log(`   💰 Salg: ${sales.toLocaleString()} kr (${transactions} ordre)`);
    console.log(`   📊 Snitt: ${avgTicket} kr (mål: ${goal} kr)`);
    
    if (!goalMet) {
        console.log(`   ❌ Mål ikke nådd (${Math.round((avgTicket/goal)*100)}%)`);
        return { location, goalMet: false, avgTicket, goal };
    }

    console.log(`   ✅ MÅL NÅDD! 🎯`);

    // Get employees who worked
    const deptIds = STORE_DEPARTMENTS[location];
    const shifts = await getShiftsForDate(date, deptIds);
    const employeeIds = [...new Set(shifts.map(s => s.employeeId))];

    if (employeeIds.length === 0) {
        console.log(`   ⚠️  Ingen ansatte funnet i Planday`);
        return { location, goalMet: true, avgTicket, goal, employees: 0 };
    }

    console.log(`   👥 ${employeeIds.length} ansatte jobbet: ${employeeIds.join(', ')}`);

    // Give XP
    const results = gamification.recordAvgTicketHit(employeeIds, location, avgTicket, goal);
    gamification.updateLeaderboards();

    console.log(`   🎮 ${results.length} ansatte fikk 10 XP hver!`);

    return {
        location,
        goalMet: true,
        avgTicket,
        goal,
        employees: employeeIds.length,
        xpGiven: results.length * 10
    };
}

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('  🎯 Daily Average Ticket XP Calculator');
    console.log('═══════════════════════════════════════════════════');

    // Parse date argument or use yesterday
    let targetDate;
    if (process.argv[2]) {
        targetDate = new Date(process.argv[2]);
    } else {
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - 1);
    }
    
    const dateStr = targetDate.toISOString().split('T')[0];
    console.log(`\n📅 Dato: ${dateStr}`);

    const results = [];

    for (const location of ['nesbyen', 'hemsedal']) {
        try {
            const result = await processLocation(location, targetDate);
            results.push(result);
        } catch (error) {
            console.error(`   ❌ Feil for ${location}:`, error.message);
            results.push({ location, error: error.message });
        }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  📊 OPPSUMMERING');
    console.log('═══════════════════════════════════════════════════');
    
    let totalXp = 0;
    for (const r of results) {
        if (r.goalMet) {
            console.log(`✅ ${r.location}: ${r.avgTicket} kr snitt → ${r.employees} ansatte fikk XP`);
            totalXp += r.xpGiven || 0;
        } else if (r.skipped) {
            console.log(`⏭️  ${r.location}: Hoppet over (${r.reason})`);
        } else if (r.error) {
            console.log(`❌ ${r.location}: Feil - ${r.error}`);
        } else {
            console.log(`❌ ${r.location}: ${r.avgTicket} kr snitt (mål: ${r.goal} kr)`);
        }
    }
    
    console.log(`\n💎 Totalt XP gitt: ${totalXp}`);
    console.log('═══════════════════════════════════════════════════\n');

    // Log to file
    const logFile = path.join(__dirname, '..', 'data', 'avgticket-log.json');
    let log = [];
    try {
        if (fs.existsSync(logFile)) {
            log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        }
    } catch (e) {}
    
    log.push({
        date: dateStr,
        runAt: new Date().toISOString(),
        results
    });
    
    // Keep last 90 days
    if (log.length > 90) log = log.slice(-90);
    fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
    
    return results;
}

main().catch(console.error);
