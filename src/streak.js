/**
 * Streak System for Bear House Dashboard
 * 
 * XP Rewards:
 * - 10 XP when hitting budget (to all workers that day)
 * - Streak bonus: Each person who worked during the streak gets XP = streak length
 *   (awarded once per person when streak increases)
 * 
 * Example: 5-day streak
 * - Day 1: Workers get 10 XP, streak bonus = 1 XP to all
 * - Day 2: Workers get 10 XP, streak bonus = 2 XP to all who worked in streak
 * - Day 3: Workers get 10 XP, streak bonus = 3 XP to all who worked in streak
 * - etc.
 */

const fs = require('fs');
const path = require('path');

const STREAK_FILE = path.join(__dirname, '../data/streak.json');

// Default streak data structure
const defaultStreakData = {
    nesbyen: {
        currentStreak: 0,
        lastHitDate: null,
        streakParticipants: [],  // { odingaze: { days: ['2026-02-23', '2026-02-24'], bonusPaid: 2 } }
        history: []
    },
    hemsedal: {
        currentStreak: 0,
        lastHitDate: null,
        streakParticipants: [],
        history: []
    }
};

function loadStreakData() {
    try {
        if (fs.existsSync(STREAK_FILE)) {
            return JSON.parse(fs.readFileSync(STREAK_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[Streak] Error loading data:', e.message);
    }
    return JSON.parse(JSON.stringify(defaultStreakData));
}

function saveStreakData(data) {
    try {
        const dir = path.dirname(STREAK_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(STREAK_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[Streak] Error saving data:', e.message);
    }
}

/**
 * Record a budget hit for a location
 * @param {string} location - 'nesbyen' or 'hemsedal'
 * @param {string} date - Date string YYYY-MM-DD
 * @param {number} sales - Actual sales
 * @param {number} budget - Budget target
 * @param {Array<string>} workers - Array of worker usernames who worked that day
 * @returns {Object} XP awards to distribute
 */
function recordBudgetHit(location, date, sales, budget, workers) {
    const data = loadStreakData();
    const loc = data[location];
    
    if (!loc) {
        console.error(`[Streak] Unknown location: ${location}`);
        return { success: false, error: 'Unknown location' };
    }
    
    const hitBudget = sales >= budget;
    const xpAwards = {};
    
    if (hitBudget) {
        // Check if this continues the streak
        const yesterday = getYesterday(date);
        const continuesStreak = loc.lastHitDate === yesterday;
        
        if (continuesStreak) {
            loc.currentStreak++;
        } else {
            // New streak starts
            loc.currentStreak = 1;
            loc.streakParticipants = {};
        }
        
        loc.lastHitDate = date;
        
        // Award 10 XP to all workers today
        workers.forEach(worker => {
            if (!xpAwards[worker]) xpAwards[worker] = { daily: 0, streak: 0 };
            xpAwards[worker].daily = 10;
            
            // Track participation
            if (!loc.streakParticipants[worker]) {
                loc.streakParticipants[worker] = { days: [], bonusPaid: 0 };
            }
            if (!loc.streakParticipants[worker].days.includes(date)) {
                loc.streakParticipants[worker].days.push(date);
            }
        });
        
        // Award streak bonus to ALL participants (current streak length XP)
        const streakBonus = loc.currentStreak;
        Object.keys(loc.streakParticipants).forEach(worker => {
            const participant = loc.streakParticipants[worker];
            
            // Only award the difference from what they've already received
            const newBonus = streakBonus - participant.bonusPaid;
            if (newBonus > 0) {
                if (!xpAwards[worker]) xpAwards[worker] = { daily: 0, streak: 0 };
                xpAwards[worker].streak = newBonus;
                participant.bonusPaid = streakBonus;
            }
        });
        
        // Log to history
        loc.history.push({
            date,
            sales,
            budget,
            streak: loc.currentStreak,
            workers: workers.length,
            xpAwarded: Object.values(xpAwards).reduce((sum, a) => sum + a.daily + a.streak, 0)
        });
        
        // Keep only last 30 days of history
        if (loc.history.length > 30) {
            loc.history = loc.history.slice(-30);
        }
        
        console.log(`[Streak] ${location} hit budget! Streak: ${loc.currentStreak} days`);
        
    } else {
        // Streak broken
        if (loc.currentStreak > 0) {
            console.log(`[Streak] ${location} streak broken at ${loc.currentStreak} days`);
            loc.history.push({
                date,
                sales,
                budget,
                streakBroken: true,
                finalStreak: loc.currentStreak
            });
        }
        loc.currentStreak = 0;
        loc.streakParticipants = {};
    }
    
    saveStreakData(data);
    
    return {
        success: true,
        hitBudget,
        currentStreak: loc.currentStreak,
        xpAwards,
        totalXP: Object.values(xpAwards).reduce((sum, a) => sum + a.daily + a.streak, 0)
    };
}

/**
 * Get current streak info for a location
 */
function getStreakInfo(location) {
    const data = loadStreakData();
    const loc = data[location];
    
    if (!loc) return null;
    
    return {
        currentStreak: loc.currentStreak,
        lastHitDate: loc.lastHitDate,
        participantCount: Object.keys(loc.streakParticipants).length,
        participants: Object.entries(loc.streakParticipants).map(([name, info]) => ({
            name,
            daysWorked: info.days.length,
            bonusEarned: info.bonusPaid
        })),
        recentHistory: loc.history.slice(-7)
    };
}

/**
 * Get yesterday's date string
 */
function getYesterday(dateStr) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
}

/**
 * Initialize streak data from historical Favrit data
 */
async function initializeFromHistory(location, favrit, budget, planday) {
    console.log(`[Streak] Initializing ${location} from history...`);
    
    const data = loadStreakData();
    const loc = data[location];
    
    // Reset
    loc.currentStreak = 0;
    loc.lastHitDate = null;
    loc.streakParticipants = {};
    loc.history = [];
    
    const today = new Date();
    const results = [];
    
    // Check last 14 days backwards
    for (let i = 13; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        try {
            const dayBudget = await budget.getBudget(location, date);
            const fromDate = `${dateStr}T00:00:00`;
            const toDate = `${dateStr}T23:59:59`;
            
            const orders = await favrit.getOrderLines(
                favrit.LOCATIONS[location], 
                fromDate, 
                toDate
            );
            
            const sales = orders
                .filter(o => o.order_line_type === 'ORDER_LINE')
                .reduce((sum, o) => sum + (o.amount_with_vat * o.quantity), 0);
            
            results.push({
                date: dateStr,
                sales: Math.round(sales),
                budget: dayBudget,
                hit: sales >= dayBudget
            });
            
        } catch (err) {
            results.push({ date: dateStr, hit: false, error: true });
        }
    }
    
    // Process results to build streak
    for (const r of results) {
        if (r.hit) {
            const yesterday = getYesterday(r.date);
            if (loc.lastHitDate === yesterday || loc.currentStreak === 0) {
                if (loc.lastHitDate !== yesterday && loc.currentStreak > 0) {
                    // Gap - reset streak
                    loc.currentStreak = 1;
                    loc.streakParticipants = {};
                } else {
                    loc.currentStreak++;
                }
                loc.lastHitDate = r.date;
                
                loc.history.push({
                    date: r.date,
                    sales: r.sales,
                    budget: r.budget,
                    streak: loc.currentStreak
                });
            }
        } else if (loc.currentStreak > 0) {
            // Streak broken
            loc.currentStreak = 0;
            loc.streakParticipants = {};
        }
    }
    
    saveStreakData(data);
    console.log(`[Streak] ${location} initialized: ${loc.currentStreak} day streak`);
    
    return loc;
}

module.exports = {
    recordBudgetHit,
    getStreakInfo,
    initializeFromHistory,
    loadStreakData,
    saveStreakData
};
