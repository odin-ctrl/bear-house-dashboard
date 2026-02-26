/**
 * Records & Year-over-Year Comparison
 * Bear House Dashboard
 * 
 * Handles historical records and compares with same period last year
 * Special handling for Easter (floating holiday)
 */

// Historical records from actual data
const RECORDS = {
    nesbyen: {
        bestDay: {
            amount: 127140,
            date: '2025-04-16',  // Onsdag påsken 2025
            description: 'Onsdag påsken 2025 (uke 16)',
            staff: [
                'Martin Gaze',
                'Torstein Johnsen', 
                'Maneewan Gaze',
                'Oskar Tomasz Jachym',
                'Geralyn Esta Bratteng',
                'Mats Gertsjan Lover',
                'Iryna Andriienko',
                'Julie Gullingsrud Juvhaugen',
                'Albert Morallos Villanueva'
            ]
        },
        bestWeek: {
            amount: 627371,
            week: 16,
            year: 2025,
            description: 'Påskeuka 2025',
            staff: [
                'Martin Gaze',
                'Torstein Johnsen',
                'Maneewan Gaze', 
                'Oskar Tomasz Jachym',
                'Geralyn Esta Bratteng',
                'Mats Gertsjan Lover',
                'Iryna Andriienko',
                'Julie Gullingsrud Juvhaugen',
                'Albert Morallos Villanueva',
                'Agnieszka Nawrot',
                'Frances Rexie Joy Bonilla Cabangon'
            ]
        },
        bestHour: {
            amount: 20621,  // Verified from Favrit data
            date: '2025-04-16',
            hour: 12,
            description: 'Kl 12:00 onsdag påsken 2025 (243 ordre)',
            staff: [
                'Martin Gaze',
                'Torstein Johnsen',
                'Maneewan Gaze',
                'Oskar Tomasz Jachym',
                'Geralyn Esta Bratteng',
                'Mats Gertsjan Lover',
                'Iryna Andriienko',
                'Julie Gullingsrud Juvhaugen',
                'Albert Morallos Villanueva'
            ]
        }
    },
    hemsedal: {
        bestDay: {
            amount: 60503,
            date: '2025-04-16',
            description: 'Onsdag påsken 2025 (uke 16)',
            staff: ['Ella Ryno Petersson', 'William Scott Brix Foster']
        },
        bestWeek: {
            amount: 365000,
            week: 16,
            year: 2025,
            description: 'Påskeuka 2025',
            staff: ['Ella Ryno Petersson', 'William Scott Brix Foster', 'Tilde Plejdrup-Skillestad']
        },
        bestHour: {
            amount: 11162,  // Verified from Favrit data
            date: '2025-04-17',
            hour: 12,
            description: 'Kl 12:00 skjærtorsdag påsken 2025',
            staff: ['Ella Ryno Petersson', 'William Scott Brix Foster']
        }
    }
};

/**
 * Get Easter Sunday for a given year (Anonymous Gregorian algorithm)
 */
function getEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    
    return new Date(year, month - 1, day);
}

/**
 * Get ISO week number
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get Easter week number for a given year
 */
function getEasterWeek(year) {
    const easter = getEasterSunday(year);
    return getWeekNumber(easter);
}

/**
 * Check if a week is Easter week
 */
function isEasterWeek(week, year) {
    return week === getEasterWeek(year);
}

/**
 * Get the equivalent week from last year for comparison
 * Handles Easter specially - compares Easter to Easter
 */
function getComparisonWeek(week, year) {
    const currentEasterWeek = getEasterWeek(year);
    const lastYearEasterWeek = getEasterWeek(year - 1);
    
    // If current week is Easter, compare with last year's Easter
    if (week === currentEasterWeek) {
        return {
            week: lastYearEasterWeek,
            year: year - 1,
            isEaster: true
        };
    }
    
    // If current week is near Easter (±1 week), adjust accordingly
    if (week === currentEasterWeek - 1) {
        // Week before Easter (Palmehelgen)
        return {
            week: lastYearEasterWeek - 1,
            year: year - 1,
            isEaster: false,
            note: 'Palmehelgen'
        };
    }
    
    if (week === currentEasterWeek + 1) {
        // Week after Easter
        return {
            week: lastYearEasterWeek + 1,
            year: year - 1,
            isEaster: false
        };
    }
    
    // Regular week - compare with same week number
    return {
        week: week,
        year: year - 1,
        isEaster: false
    };
}

/**
 * Get records for a location
 */
function getRecords(location) {
    return RECORDS[location] || null;
}

/**
 * Check if a new record was set
 */
function checkNewRecord(location, type, amount) {
    const records = RECORDS[location];
    if (!records || !records[type]) return false;
    
    return amount > records[type].amount;
}

/**
 * Get comparison info for current date
 */
function getYearOverYearInfo(date = new Date()) {
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const comparison = getComparisonWeek(week, year);
    
    return {
        currentWeek: week,
        currentYear: year,
        compareWeek: comparison.week,
        compareYear: comparison.year,
        isEasterComparison: comparison.isEaster,
        note: comparison.note || null,
        easterInfo: {
            currentYearEaster: getEasterSunday(year).toISOString().split('T')[0],
            lastYearEaster: getEasterSunday(year - 1).toISOString().split('T')[0]
        }
    };
}

// Easter dates for reference
console.log('[Records] Easter 2025:', getEasterSunday(2025).toISOString().split('T')[0], '(week', getEasterWeek(2025) + ')');
console.log('[Records] Easter 2026:', getEasterSunday(2026).toISOString().split('T')[0], '(week', getEasterWeek(2026) + ')');

module.exports = {
    getRecords,
    checkNewRecord,
    getYearOverYearInfo,
    getEasterSunday,
    getEasterWeek,
    getWeekNumber,
    getComparisonWeek,
    RECORDS
};
