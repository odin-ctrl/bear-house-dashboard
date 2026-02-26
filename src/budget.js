/**
 * Budget Integration - Fetches from Google Sheets
 * Bear House Dashboard
 */

// Google Sheets export URLs
const SHEETS = {
    nesbyen: 'https://docs.google.com/spreadsheets/d/1YxuhNZVscP-TFwuuRmIqR5Z4iYRJuiIvVfYGjEeD-ss/export?format=csv',
    hemsedal: 'https://docs.google.com/spreadsheets/d/1shNAXvDNcvHk60Z5LdFIfldTXH0tVFulg0z0XGyVJHE/export?format=csv'
};

// Cache for budget data (refresh every 30 minutes)
let budgetCache = {
    nesbyen: { data: null, timestamp: 0 },
    hemsedal: { data: null, timestamp: 0 }
};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Parse Norwegian number format (space as thousand separator)
 */
function parseNorwegianNumber(str) {
    if (!str || str === 'Stengt') return 0;
    const cleaned = str.toString().replace(/\s/g, '').replace(/,/g, '.');
    return parseInt(cleaned) || 0;
}

/**
 * Get current ISO week number
 */
function getWeekNumber(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Fetch and parse budget data from Google Sheets
 */
async function fetchBudgetData(location) {
    const sheetUrl = SHEETS[location];
    if (!sheetUrl) {
        console.error(`[Budget] No sheet URL for location: ${location}`);
        return null;
    }

    // Return cache if valid
    if (budgetCache[location]?.data && Date.now() - budgetCache[location].timestamp < CACHE_TTL) {
        return budgetCache[location].data;
    }

    try {
        const response = await fetch(sheetUrl);
        const csvText = await response.text();
        
        const lines = csvText.split('\n');
        const budgets = {};

        // Find the BUDSJETT 2026 section (not FAKTISK)
        let inBudgetSection = false;
        let weekRow = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const cols = line.split(',');
            
            // Detect budget section start
            if (line.includes('BUDSJETT 2026') && !line.includes('FAKTISK')) {
                inBudgetSection = true;
                continue;
            }
            
            // Detect section end (FAKTISK or empty)
            if (inBudgetSection && (line.includes('FAKTISK') || line.includes('Kommentar'))) {
                break;
            }
            
            if (!inBudgetSection) continue;
            
            // Find week row
            if (cols[0]?.trim() === 'UKE') {
                weekRow = cols;
                continue;
            }
            
            // Parse daily budgets
            const day = cols[0]?.trim();
            if (['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'].includes(day)) {
                for (let w = 1; w < cols.length && w < 54; w++) {
                    const weekNum = parseInt(weekRow?.[w]) || w;
                    const value = parseNorwegianNumber(cols[w]);
                    
                    if (!budgets[weekNum]) {
                        budgets[weekNum] = {};
                    }
                    budgets[weekNum][day] = value;
                }
            }
            
            // Stop at SUM row
            if (cols[0]?.trim() === 'SUM') {
                break;
            }
        }

        // Cache the result
        budgetCache[location] = {
            data: budgets,
            timestamp: Date.now()
        };
        
        console.log(`[Budget] Fetched ${location} from Google Sheets, week 9:`, budgets[9]);
        
        return budgets;
    } catch (error) {
        console.error(`[Budget] Error fetching ${location} from Sheets:`, error.message);
        return null;
    }
}

/**
 * Get budget for a specific location and date
 */
async function getBudget(location, date = new Date()) {
    const weekNum = getWeekNumber(date);
    const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
    const dayName = dayNames[date.getDay()];
    
    // Try to get from Google Sheets
    const budgets = await fetchBudgetData(location);
    
    if (budgets && budgets[weekNum]) {
        const budget = budgets[weekNum][dayName];
        if (budget && budget > 0) {
            console.log(`[Budget] ${location} ${dayName} uke ${weekNum}: ${budget} kr`);
            return budget;
        }
    }
    
    // Fallback to hardcoded values
    console.log(`[Budget] Using fallback for ${location} ${dayName}`);
    const fallback = {
        nesbyen: { Mandag: 25000, Tirsdag: 25000, Onsdag: 25000, Torsdag: 30000, Fredag: 45000, Lørdag: 45000, Søndag: 40000 },
        hemsedal: { Mandag: 35000, Tirsdag: 40000, Onsdag: 40000, Torsdag: 50000, Fredag: 50000, Lørdag: 60000, Søndag: 35000 }
    };
    
    return fallback[location]?.[dayName] || 25000;
}

/**
 * Get weekly budget summary
 */
async function getWeeklyBudget(location, weekNum) {
    const budgets = await fetchBudgetData(location);
    return budgets?.[weekNum] || null;
}

module.exports = {
    getBudget,
    getWeeklyBudget,
    getWeekNumber,
    fetchBudgetData
};
