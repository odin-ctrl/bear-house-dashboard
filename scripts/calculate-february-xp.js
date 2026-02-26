/**
 * Calculate February XP based on Martin's rules (CORRECTED):
 * 
 * 1. Work on budget-hit day: 10 XP
 * 2. Didn't work but part of streak: bonus = days since YOU joined the streak
 * 3. Max ONE of these per day (the higher one)
 * 4. From day 10+: Everyone gets streak-length XP (streak matters more)
 * 5. You only get streak bonus from the day YOU joined the streak
 * 6. Streak breaks: Everything resets
 */

const fs = require('fs');
const path = require('path');

// Load data
const shiftsData = JSON.parse(fs.readFileSync('/tmp/february-shifts.json', 'utf8'));
const budgetData = JSON.parse(fs.readFileSync('/tmp/february-budget.json', 'utf8'));

function calculateXP(location) {
    const shifts = shiftsData[location];
    const budgets = budgetData[location];
    
    // Track XP per employee
    const xpByEmployee = {}; // { name: { total: 0, breakdown: [] } }
    
    // Track current streak
    let currentStreak = 0;
    // Track when each person joined the streak: { name: joinedOnDay }
    let streakJoinDay = {};
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${location.toUpperCase()} - XP CALCULATION`);
    console.log('='.repeat(60));
    
    for (const dayData of budgets) {
        const date = dayData.date;
        const hit = dayData.hit;
        const dayWorkers = shifts[date] || [];
        const workerNames = [...new Set(dayWorkers.map(w => w.name))];
        
        if (!hit) {
            // Streak broken!
            if (currentStreak > 0) {
                console.log(`\n❌ ${date} (${dayData.day}): Budsjett IKKE nådd - Streak brutt etter ${currentStreak} dager`);
            }
            currentStreak = 0;
            streakJoinDay = {};
            continue;
        }
        
        // Budget hit!
        currentStreak++;
        
        console.log(`\n✅ ${date} (${dayData.day}): ${dayData.sales.toLocaleString()} / ${dayData.budget.toLocaleString()} - Streak dag ${currentStreak}`);
        console.log(`   Jobbet: ${workerNames.map(n => n.split(' ')[0]).join(', ') || 'Ingen registrert'}`);
        
        // Add today's workers to streak (record when they joined)
        for (const name of workerNames) {
            if (!(name in streakJoinDay)) {
                streakJoinDay[name] = currentStreak; // They joined on this streak day
            }
        }
        
        // Calculate XP for each person
        const dailyXP = {};
        
        // 1. Workers today get 10 XP (or streak if streak >= 10)
        for (const name of workerNames) {
            const xp = currentStreak >= 10 ? currentStreak : 10;
            dailyXP[name] = { xp, reason: currentStreak >= 10 ? `Streak dag ${currentStreak}` : 'Jobbet budsjett-dag' };
        }
        
        // 2. Streak participants who didn't work today get their personal streak XP
        for (const [name, joinedDay] of Object.entries(streakJoinDay)) {
            if (!workerNames.includes(name)) {
                // Didn't work today but part of streak
                // Their personal streak = current streak day - day they joined + 1
                const personalStreakDays = currentStreak - joinedDay + 1;
                
                if (currentStreak >= 10) {
                    // From day 10+, everyone gets full streak XP
                    dailyXP[name] = { xp: currentStreak, reason: `Streak dag ${currentStreak} (del av team)` };
                } else {
                    // Before day 10, non-workers get their personal streak length
                    dailyXP[name] = { xp: personalStreakDays, reason: `Streak-bonus (din dag ${personalStreakDays})` };
                }
            }
        }
        
        // Record XP
        for (const [name, data] of Object.entries(dailyXP)) {
            if (!xpByEmployee[name]) {
                xpByEmployee[name] = { total: 0, breakdown: [] };
            }
            xpByEmployee[name].total += data.xp;
            xpByEmployee[name].breakdown.push({
                date,
                xp: data.xp,
                reason: data.reason
            });
            console.log(`   → ${name.split(' ')[0]}: +${data.xp} XP (${data.reason})`);
        }
    }
    
    // Final summary
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`OPPSUMMERING ${location.toUpperCase()}:`);
    console.log('─'.repeat(60));
    
    const sorted = Object.entries(xpByEmployee)
        .sort((a, b) => b[1].total - a[1].total);
    
    for (const [name, data] of sorted) {
        const daysWorked = data.breakdown.filter(b => b.reason.includes('Jobbet')).length;
        const streakDays = data.breakdown.filter(b => b.reason.includes('Streak')).length;
        console.log(`${data.total.toString().padStart(4)} XP - ${name} (${daysWorked} arbeidsdager, ${streakDays} streak-dager)`);
    }
    
    return xpByEmployee;
}

// Calculate for both locations
const nesbyenXP = calculateXP('nesbyen');
const hemsedalXP = calculateXP('hemsedal');

// Save results
const results = {
    nesbyen: nesbyenXP,
    hemsedal: hemsedalXP,
    calculatedAt: new Date().toISOString()
};

fs.writeFileSync('/tmp/february-xp-calculated.json', JSON.stringify(results, null, 2));
console.log('\n\nResultater lagret i /tmp/february-xp-calculated.json');
