/**
 * Bear House Gamification Engine v4.0
 * 🎮 Comprehensive Quest System with Categories
 * - Daily, Weekly, Monthly, Quarterly, Seasonal quests
 * - 18 quest categories
 * - 40+ achievements
 * - Team challenges
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const GAMIFICATION_FILE = path.join(DATA_DIR, 'gamification.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ACTIVITY_LOG_FILE = path.join(DATA_DIR, 'activity-log.json');

// ============ DATA MANAGEMENT ============

function loadJSON(file, defaultValue = {}) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {
        console.error(`Error loading ${file}:`, e);
    }
    return defaultValue;
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getGamificationData() {
    return loadJSON(GAMIFICATION_FILE, { users: {}, quests: {}, achievements: [], levels: {} });
}

function saveGamificationData(data) {
    data.meta = data.meta || {};
    data.meta.lastUpdated = new Date().toISOString();
    saveJSON(GAMIFICATION_FILE, data);
}

// ============ USER STATS ============

function getUserStats(userId) {
    const data = getGamificationData();
    const userIdStr = String(userId);
    
    if (!data.users[userIdStr]) {
        data.users[userIdStr] = createNewUserStats(userId);
        saveGamificationData(data);
    }
    
    return data.users[userIdStr];
}

function createNewUserStats(userId) {
    const users = loadJSON(USERS_FILE, []);
    const user = users.find(u => u.id === userId);
    
    return {
        odatUserId: userId,
        username: user?.username || 'unknown',
        fullName: user?.fullName || 'Unknown User',
        location: user?.location || 'nesbyen',
        
        // XP & Level
        totalXp: 0,
        level: 1,
        xpToNextLevel: 100,
        
        // Streaks
        currentStreak: 0,
        longestStreak: 0,
        lastLoginDate: null,
        
        // Quest tracking
        questsCompleted: 0,
        questHistory: [],
        
        // Achievement tracking
        achievements: ['first-login'],
        achievementDates: { 'first-login': new Date().toISOString() },
        
        // Special counters
        fiveStarReviews: 0,
        badReviews: 0,
        teamWins: 0,
        earlyLogins: 0,
        closingRoutines: 0,
        cleaningQuests: 0,
        budgetDays: 0,
        recordDays: 0,
        mentorSessions: 0,
        problemsSolved: 0,
        perfectWeeks: 0,
        perfectMonths: 0,
        haccpStreak: 0,
        zeroWasteDays: 0,
        
        // Category counters
        categoryStats: {
            basis: 0, drift: 0, renhold: 0, utstyr: 0, haccp: 0,
            salg: 0, service: 0, admin: 0, team: 0, opplæring: 0,
            markedsføring: 0, uteområde: 0, miljø: 0, sikkerhet: 0,
            produksjon: 0, innovasjon: 0, bærekraft: 0, sesong: 0
        },
        
        // Daily tracking
        dailyQuestsToday: [],
        dailyXpToday: 0,
        lastDailyReset: new Date().toISOString().split('T')[0],
        
        // Weekly tracking
        weeklyQuestsThisWeek: [],
        weeklyXpThisWeek: 0,
        lastWeeklyReset: getWeekStart(),
        
        // Monthly tracking
        monthlyQuestsThisMonth: [],
        monthlyXpThisMonth: 0,
        lastMonthlyReset: new Date().toISOString().slice(0, 7),
        
        // Quarterly tracking
        quarterlyQuestsThisQuarter: [],
        quarterlyXpThisQuarter: 0,
        lastQuarterlyReset: getQuarterStart(),
        
        // Timestamps
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function updateUserStats(userId, updates) {
    const data = getGamificationData();
    const userIdStr = String(userId);
    
    if (!data.users[userIdStr]) {
        data.users[userIdStr] = createNewUserStats(userId);
    }
    
    Object.assign(data.users[userIdStr], updates, {
        updatedAt: new Date().toISOString()
    });
    
    saveGamificationData(data);
    return data.users[userIdStr];
}

// ============ XP & LEVELING ============

function addXp(userId, amount, reason) {
    const data = getGamificationData();
    const stats = getUserStats(userId);
    const levels = data.levels || {};
    const xpPerLevel = levels.xpPerLevel || [];
    
    // Add XP
    const oldLevel = stats.level;
    stats.totalXp = Math.max(0, stats.totalXp + amount); // Can't go below 0
    
    // Daily/weekly/monthly XP tracking
    resetPeriodIfNeeded(stats);
    if (amount > 0) {
        stats.dailyXpToday += amount;
        stats.weeklyXpThisWeek += amount;
        stats.monthlyXpThisMonth += amount;
    }
    
    // Calculate new level
    let newLevel = 1;
    for (let i = 1; i < xpPerLevel.length; i++) {
        if (stats.totalXp >= xpPerLevel[i]) {
            newLevel = i + 1;
        } else {
            break;
        }
    }
    stats.level = Math.min(newLevel, 30);
    
    // Calculate XP to next level
    if (stats.level < 30) {
        stats.xpToNextLevel = xpPerLevel[stats.level] - stats.totalXp;
    } else {
        stats.xpToNextLevel = 0;
    }
    
    // Log activity
    logActivity(userId, 'xp', { amount, reason, newTotal: stats.totalXp, level: stats.level });
    
    // Check for level up
    const leveledUp = stats.level > oldLevel;
    if (leveledUp) {
        checkLevelAchievements(userId, stats);
    }
    
    updateUserStats(userId, stats);
    
    return {
        xpAdded: amount,
        totalXp: stats.totalXp,
        level: stats.level,
        xpToNextLevel: stats.xpToNextLevel,
        leveledUp,
        newLevel: leveledUp ? stats.level : null,
        reward: leveledUp ? getLevelReward(stats.level) : null
    };
}

function getLevelReward(level) {
    const data = getGamificationData();
    const rewards = data.levels?.rewards || {};
    return rewards[String(level)] || null;
}

function getLevelTitle(level) {
    const data = getGamificationData();
    const titles = data.levels?.titles || [];
    return titles[level - 1] || 'Nybegynner';
}

// ============ STREAKS ============

function updateStreak(userId) {
    const stats = getUserStats(userId);
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (stats.lastLoginDate === today) {
        // Already logged in today
        return { streak: stats.currentStreak, extended: false };
    }
    
    let extended = false;
    let bonusXp = 0;
    
    if (stats.lastLoginDate === yesterday) {
        // Continuing streak!
        stats.currentStreak++;
        extended = true;
        
        // Check streak milestones
        if (stats.currentStreak === 7) {
            bonusXp = 75;
            addXp(userId, 75, '7-dagers streak bonus! 🔥');
        } else if (stats.currentStreak === 30) {
            bonusXp = 200;
            addXp(userId, 200, '30-dagers streak bonus! 💎');
        }
        
        if (stats.currentStreak > stats.longestStreak) {
            stats.longestStreak = stats.currentStreak;
        }
    } else {
        // Streak broken (or first login)
        if (stats.currentStreak > 0) {
            logActivity(userId, 'streak_lost', { oldStreak: stats.currentStreak });
        }
        stats.currentStreak = 1;
    }
    
    stats.lastLoginDate = today;
    updateUserStats(userId, stats);
    
    // Check streak achievements
    checkStreakAchievements(userId, stats);
    
    return {
        streak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        extended,
        bonusXp
    };
}

// ============ QUEST COMPLETION ============

function completeQuest(userId, questId, category) {
    const data = getGamificationData();
    const stats = getUserStats(userId);
    const quests = data.quests || {};
    
    // Find the quest
    const categoryQuests = quests[category] || [];
    const quest = categoryQuests.find(q => q.id === questId);
    
    if (!quest) {
        return { error: 'Quest ikke funnet' };
    }
    
    // Reset periods if needed
    resetPeriodIfNeeded(stats);
    
    // Check if already completed in this period
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisWeek = getWeekStart();
    const thisMonth = now.toISOString().slice(0, 7);
    
    if (category === 'daily' && stats.dailyQuestsToday.includes(questId)) {
        return { error: 'Allerede fullført i dag', alreadyCompleted: true };
    }
    if (category === 'weekly' && stats.weeklyQuestsThisWeek.includes(questId)) {
        return { error: 'Allerede fullført denne uken', alreadyCompleted: true };
    }
    if (category === 'monthly' && stats.monthlyQuestsThisMonth.includes(questId)) {
        return { error: 'Allerede fullført denne måneden', alreadyCompleted: true };
    }
    if (category === 'quarterly' && (stats.quarterlyQuestsThisQuarter || []).includes(questId)) {
        return { error: 'Allerede fullført dette kvartalet', alreadyCompleted: true };
    }
    
    // Complete the quest
    stats.questsCompleted++;
    stats.questHistory.push({
        questId,
        category,
        xp: quest.xp,
        completedAt: now.toISOString()
    });
    
    // Keep history to last 100 entries
    if (stats.questHistory.length > 100) {
        stats.questHistory = stats.questHistory.slice(-100);
    }
    
    // Track by period
    if (category === 'daily') {
        stats.dailyQuestsToday.push(questId);
    } else if (category === 'weekly') {
        stats.weeklyQuestsThisWeek.push(questId);
    } else if (category === 'monthly') {
        stats.monthlyQuestsThisMonth.push(questId);
    } else if (category === 'quarterly') {
        stats.quarterlyQuestsThisQuarter = stats.quarterlyQuestsThisQuarter || [];
        stats.quarterlyQuestsThisQuarter.push(questId);
    }
    // Seasonal and special can be completed multiple times
    
    // Track special counters
    if (questId === 'closing-routine') stats.closingRoutines++;
    
    // Track cleaning quests
    const cleaningQuests = [
        'clean-tables', 'clean-counter', 'clean-floor-sweep', 'clean-floor-mop',
        'clean-toilet', 'empty-trash', 'table-legs', 'chair-clean', 'laundry',
        'toilet-deep', 'windows-inside', 'mirrors', 'bins-clean', 'sink-descale',
        'drain-clean', 'fridge-organize', 'fridge-wipe', 'freezer-organize',
        'storage-organize', 'fridge-deep-clean', 'freezer-defrost', 'cabinet-organize',
        'deep-clean-floor', 'walls-clean', 'ceiling-clean', 'light-fixtures',
        'behind-equipment', 'under-equipment', 'windows-outside', 'grease-trap',
        'floor-strip-wax'
    ];
    if (cleaningQuests.includes(questId)) {
        stats.cleaningQuests = (stats.cleaningQuests || 0) + 1;
    }
    
    // Track category stats
    if (quest.category && stats.categoryStats) {
        stats.categoryStats[quest.category] = (stats.categoryStats[quest.category] || 0) + 1;
    }
    
    updateUserStats(userId, stats);
    
    // Add XP
    const xpResult = addXp(userId, quest.xp, `Quest: ${quest.name}`);
    
    // Check achievements
    checkQuestAchievements(userId, stats);
    
    // Log activity
    logActivity(userId, 'quest_complete', { questId, category, xp: quest.xp });
    
    return {
        success: true,
        quest: quest.name,
        xpEarned: quest.xp,
        ...xpResult,
        questsCompleted: stats.questsCompleted
    };
}

function getAvailableQuests(userId) {
    const data = getGamificationData();
    const stats = getUserStats(userId);
    
    resetPeriodIfNeeded(stats);
    
    const currentSeason = getCurrentSeason();
    
    const result = {
        daily: [],
        weekly: [],
        monthly: [],
        quarterly: [],
        seasonal: [],
        special: []
    };
    
    // Daily quests
    for (const quest of (data.quests.daily || [])) {
        result.daily.push({
            ...quest,
            completed: stats.dailyQuestsToday.includes(quest.id)
        });
    }
    
    // Weekly quests
    for (const quest of (data.quests.weekly || [])) {
        // Check seasonal availability
        if (quest.seasonal) {
            const now = new Date();
            const month = now.getMonth() + 1;
            if (quest.seasonal === 'winter' && (month < 11 && month > 3)) continue;
            if (quest.seasonal === 'summer' && (month < 5 || month > 9)) continue;
        }
        result.weekly.push({
            ...quest,
            completed: stats.weeklyQuestsThisWeek.includes(quest.id)
        });
    }
    
    // Monthly quests
    for (const quest of (data.quests.monthly || [])) {
        if (quest.seasonal) {
            const now = new Date();
            const month = now.getMonth() + 1;
            if (quest.seasonal === 'spring-summer' && (month < 4 || month > 9)) continue;
        }
        result.monthly.push({
            ...quest,
            completed: stats.monthlyQuestsThisMonth.includes(quest.id)
        });
    }
    
    // Quarterly quests
    for (const quest of (data.quests.quarterly || [])) {
        result.quarterly.push({
            ...quest,
            completed: (stats.quarterlyQuestsThisQuarter || []).includes(quest.id)
        });
    }
    
    // Seasonal quests (filtered by current season/month)
    for (const quest of (data.quests.seasonal || [])) {
        const season = quest.season || '';
        if (season.includes(currentSeason) || season.includes('-')) {
            // Check if current month is in range (e.g., "november-december")
            const months = season.split('-');
            const monthMap = {
                january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
                july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
            };
            const currentMonth = new Date().getMonth() + 1;
            
            if (months.length === 2) {
                const startMonth = monthMap[months[0]] || 1;
                const endMonth = monthMap[months[1]] || 12;
                if (currentMonth >= startMonth && currentMonth <= endMonth) {
                    result.seasonal.push({ ...quest, completed: false });
                }
            } else if (monthMap[season] === currentMonth) {
                result.seasonal.push({ ...quest, completed: false });
            }
        }
    }
    
    // Special quests (always available)
    for (const quest of (data.quests.special || [])) {
        if (!quest.autoTrack) {
            result.special.push({
                ...quest,
                completed: false // Special quests can be completed multiple times
            });
        }
    }
    
    return result;
}

// ============ ACHIEVEMENTS ============

function checkQuestAchievements(userId, stats) {
    const thresholds = [10, 50, 100];
    const badges = ['quest-master-10', 'quest-master-50', 'quest-master-100'];
    
    for (let i = 0; i < thresholds.length; i++) {
        if (stats.questsCompleted >= thresholds[i] && !stats.achievements.includes(badges[i])) {
            unlockAchievement(userId, badges[i]);
        }
    }
}

function checkStreakAchievements(userId, stats) {
    if (stats.currentStreak >= 7 && !stats.achievements.includes('streak-warrior')) {
        unlockAchievement(userId, 'streak-warrior');
    }
    if (stats.currentStreak >= 30 && !stats.achievements.includes('streak-champion')) {
        unlockAchievement(userId, 'streak-champion');
    }
}

function checkLevelAchievements(userId, stats) {
    const levelBadges = {
        5: 'level-5',
        10: 'level-10',
        15: 'level-15',
        20: 'level-20',
        25: 'level-25',
        30: 'level-30'
    };
    
    for (const [level, badge] of Object.entries(levelBadges)) {
        if (stats.level >= parseInt(level) && !stats.achievements.includes(badge)) {
            unlockAchievement(userId, badge);
        }
    }
}

function unlockAchievement(userId, achievementId) {
    const data = getGamificationData();
    const stats = getUserStats(userId);
    
    if (stats.achievements.includes(achievementId)) {
        return { alreadyUnlocked: true };
    }
    
    const achievement = data.achievements.find(a => a.id === achievementId);
    if (!achievement) {
        return { error: 'Achievement not found' };
    }
    
    stats.achievements.push(achievementId);
    stats.achievementDates[achievementId] = new Date().toISOString();
    
    updateUserStats(userId, stats);
    logActivity(userId, 'achievement_unlock', { achievementId, name: achievement.name });
    
    return {
        success: true,
        achievement: {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon
        }
    };
}

function getUserAchievements(userId) {
    const data = getGamificationData();
    const stats = getUserStats(userId);
    
    return data.achievements.map(achievement => ({
        ...achievement,
        unlocked: stats.achievements.includes(achievement.id),
        unlockedAt: stats.achievementDates?.[achievement.id] || null
    }));
}

// ============ LEADERBOARDS ============

function updateLeaderboards() {
    const data = getGamificationData();
    const users = loadJSON(USERS_FILE, []);
    
    // Build leaderboard entries
    const entries = [];
    
    for (const [userId, stats] of Object.entries(data.users || {})) {
        const user = users.find(u => String(u.id) === userId);
        if (!user) continue;  // Admins can be on leaderboard too
        
        entries.push({
            userId: parseInt(userId),
            username: stats.username,
            fullName: stats.fullName,
            location: stats.location,
            totalXp: stats.totalXp,
            level: stats.level,
            dailyXp: stats.dailyXpToday || 0,
            weeklyXp: stats.weeklyXpThisWeek || 0,
            monthlyXp: stats.monthlyXpThisMonth || 0,
            streak: stats.currentStreak || 0,
            questsCompleted: stats.questsCompleted || 0
        });
    }
    
    // Sort and create leaderboards
    data.leaderboard = {
        daily: [...entries].sort((a, b) => b.dailyXp - a.dailyXp).slice(0, 10),
        weekly: [...entries].sort((a, b) => b.weeklyXp - a.weeklyXp).slice(0, 10),
        monthly: [...entries].sort((a, b) => b.monthlyXp - a.monthlyXp).slice(0, 10),
        allTime: [...entries].sort((a, b) => b.totalXp - a.totalXp).slice(0, 10)
    };
    
    saveGamificationData(data);
    return data.leaderboard;
}

function getLeaderboard(type = 'weekly', location = null) {
    const data = getGamificationData();
    let board = data.leaderboard?.[type] || [];
    
    if (location) {
        board = board.filter(e => e.location === location);
    }
    
    return board.map((entry, index) => ({
        rank: index + 1,
        ...entry
    }));
}

// ============ TEAM CHALLENGES ============

function getTeamStats() {
    const data = getGamificationData();
    const users = loadJSON(USERS_FILE, []);
    
    const teams = {
        nesbyen: { name: 'Nesbyen', emoji: '🐻', totalXp: 0, weeklyXp: 0, members: 0, avgLevel: 0 },
        hemsedal: { name: 'Hemsedal', emoji: '⛷️', totalXp: 0, weeklyXp: 0, members: 0, avgLevel: 0 }
    };
    
    for (const [userId, stats] of Object.entries(data.users || {})) {
        const user = users.find(u => String(u.id) === userId);
        if (!user) continue;
        
        const loc = stats.location;
        if (teams[loc]) {
            teams[loc].totalXp += stats.totalXp || 0;
            teams[loc].weeklyXp += stats.weeklyXpThisWeek || 0;
            teams[loc].members++;
            teams[loc].avgLevel += stats.level || 1;
        }
    }
    
    // Calculate averages
    for (const team of Object.values(teams)) {
        if (team.members > 0) {
            team.avgLevel = Math.round(team.avgLevel / team.members * 10) / 10;
            team.avgWeeklyXp = Math.round(team.weeklyXp / team.members);
        }
    }
    
    // Determine leader
    const leader = teams.nesbyen.weeklyXp >= teams.hemsedal.weeklyXp ? 'nesbyen' : 'hemsedal';
    const diff = Math.abs(teams.nesbyen.weeklyXp - teams.hemsedal.weeklyXp);
    
    return {
        teams,
        leader,
        difference: diff,
        weekStart: getWeekStart()
    };
}

// ============ SPECIAL EVENTS ============

function recordReview(userId, stars) {
    const stats = getUserStats(userId);
    
    let xp = 0;
    let message = '';
    
    if (stars === 5) {
        xp = 50;
        stats.fiveStarReviews++;
        message = '⭐ 5-stjerners anmeldelse!';
    } else if (stars === 4) {
        xp = -15;
        stats.badReviews++;
        message = '😐 4-stjerners anmeldelse (trekker ned snittet)';
    } else if (stars === 3) {
        xp = -40;
        stats.badReviews++;
        message = '😕 3-stjerners anmeldelse';
    } else {
        xp = -80;
        stats.badReviews++;
        message = '😱 Dårlig anmeldelse mottatt';
    }
    
    updateUserStats(userId, stats);
    const xpResult = addXp(userId, xp, message);
    
    // Check review achievements
    if (stats.fiveStarReviews >= 5 && !stats.achievements.includes('review-hunter')) {
        unlockAchievement(userId, 'review-hunter');
    }
    if (stats.fiveStarReviews >= 20 && !stats.achievements.includes('review-legend')) {
        unlockAchievement(userId, 'review-legend');
    }
    
    return { stars, xp, message, ...xpResult };
}

function recordBudgetHit(userIds) {
    const results = [];
    
    for (const userId of userIds) {
        const stats = getUserStats(userId);
        stats.budgetDays++;
        updateUserStats(userId, stats);
        
        const xpResult = addXp(userId, 25, '🎯 Budsjett nådd!');
        results.push({ userId, ...xpResult });
        
        // Check achievement
        if (stats.budgetDays >= 10 && !stats.achievements.includes('sales-star')) {
            unlockAchievement(userId, 'sales-star');
        }
    }
    
    return results;
}

function recordNewRecord(userIds) {
    const results = [];
    
    for (const userId of userIds) {
        const stats = getUserStats(userId);
        stats.recordDays++;
        updateUserStats(userId, stats);
        
        const xpResult = addXp(userId, 100, '🏆 NY REKORD!');
        results.push({ userId, ...xpResult });
        
        // Check achievement
        if (stats.recordDays >= 3 && !stats.achievements.includes('record-breaker')) {
            unlockAchievement(userId, 'record-breaker');
        }
    }
    
    return results;
}

function recordAvgTicketHit(userIds, location, avgTicket, goal) {
    const results = [];
    
    for (const userId of userIds) {
        const stats = getUserStats(userId);
        stats.avgTicketDays = (stats.avgTicketDays || 0) + 1;
        updateUserStats(userId, stats);
        
        const xpResult = addXp(userId, 10, `💰 Høyt snitt! ${avgTicket} kr (mål: ${goal} kr)`);
        results.push({ userId, ...xpResult });
        
        // Unlock achievement at 5 high-ticket days
        if (stats.avgTicketDays >= 5 && !stats.achievements?.includes('upsell-master')) {
            unlockAchievement(userId, 'upsell-master');
        }
    }
    
    console.log(`[Gamification] Avg ticket hit for ${location}: ${userIds.length} users got 10 XP each`);
    return results;
}

// ============ HELPERS ============

function resetPeriodIfNeeded(stats) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const thisWeek = getWeekStart();
    const thisMonth = now.toISOString().slice(0, 7);
    const thisQuarter = getQuarterStart();
    
    // Daily reset
    if (stats.lastDailyReset !== today) {
        stats.dailyQuestsToday = [];
        stats.dailyXpToday = 0;
        stats.lastDailyReset = today;
    }
    
    // Weekly reset
    if (stats.lastWeeklyReset !== thisWeek) {
        stats.weeklyQuestsThisWeek = [];
        stats.weeklyXpThisWeek = 0;
        stats.lastWeeklyReset = thisWeek;
    }
    
    // Monthly reset
    if (stats.lastMonthlyReset !== thisMonth) {
        stats.monthlyQuestsThisMonth = [];
        stats.monthlyXpThisMonth = 0;
        stats.lastMonthlyReset = thisMonth;
    }
    
    // Quarterly reset
    if (stats.lastQuarterlyReset !== thisQuarter) {
        stats.quarterlyQuestsThisQuarter = stats.quarterlyQuestsThisQuarter || [];
        stats.quarterlyQuestsThisQuarter = [];
        stats.quarterlyXpThisQuarter = 0;
        stats.lastQuarterlyReset = thisQuarter;
    }
}

function getWeekStart() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
}

function getQuarterStart() {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    return `${now.getFullYear()}-Q${quarter + 1}`;
}

function getCurrentSeason() {
    const month = new Date().getMonth() + 1;
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                        'july', 'august', 'september', 'october', 'november', 'december'];
    return monthNames[month - 1];
}

function logActivity(userId, type, data) {
    const log = loadJSON(ACTIVITY_LOG_FILE, []);
    
    log.unshift({
        userId,
        type,
        data,
        timestamp: new Date().toISOString()
    });
    
    // Keep last 5000 entries
    saveJSON(ACTIVITY_LOG_FILE, log.slice(0, 5000));
}

function getActivityLog(userId = null, limit = 50) {
    const log = loadJSON(ACTIVITY_LOG_FILE, []);
    
    if (userId !== null && userId !== undefined) {
        return log.filter(e => e.userId === userId).slice(0, limit);
    }
    
    return log.slice(0, limit);
}

// ============ FULL USER PROFILE ============

function getFullProfile(userId) {
    const data = getGamificationData();
    const stats = getUserStats(userId);
    const users = loadJSON(USERS_FILE, []);
    const user = users.find(u => u.id === userId);
    
    resetPeriodIfNeeded(stats);
    updateUserStats(userId, stats);
    
    return {
        user: {
            id: userId,
            username: stats.username,
            fullName: stats.fullName,
            location: stats.location,
            avatar: user?.avatar || null
        },
        
        level: {
            current: stats.level,
            title: getLevelTitle(stats.level),
            totalXp: stats.totalXp,
            xpToNextLevel: stats.xpToNextLevel,
            progress: stats.level < 30 
                ? Math.round((1 - (stats.xpToNextLevel / (data.levels.xpPerLevel[stats.level] - data.levels.xpPerLevel[stats.level - 1]))) * 100)
                : 100
        },
        
        streak: {
            current: stats.currentStreak,
            longest: stats.longestStreak,
            lastLogin: stats.lastLoginDate,
            multiplier: stats.currentStreak >= 7 ? 2 : 1
        },
        
        xp: {
            today: stats.dailyXpToday,
            thisWeek: stats.weeklyXpThisWeek,
            thisMonth: stats.monthlyXpThisMonth,
            allTime: stats.totalXp
        },
        
        quests: {
            completed: stats.questsCompleted,
            todayCount: stats.dailyQuestsToday?.length || 0,
            weekCount: stats.weeklyQuestsThisWeek?.length || 0,
            monthCount: stats.monthlyQuestsThisMonth?.length || 0
        },
        
        achievements: {
            unlocked: stats.achievements?.length || 0,
            total: data.achievements?.length || 0,
            recent: stats.achievements?.slice(-3) || []
        },
        
        stats: {
            fiveStarReviews: stats.fiveStarReviews,
            teamWins: stats.teamWins,
            budgetDays: stats.budgetDays,
            recordDays: stats.recordDays
        }
    };
}

// ============ EXPORTS ============

module.exports = {
    // User stats
    getUserStats,
    updateUserStats,
    getFullProfile,
    
    // XP & Levels
    addXp,
    getLevelTitle,
    getLevelReward,
    
    // Streaks
    updateStreak,
    
    // Quests
    completeQuest,
    getAvailableQuests,
    
    // Achievements
    unlockAchievement,
    getUserAchievements,
    
    // Leaderboards
    updateLeaderboards,
    getLeaderboard,
    
    // Team challenges
    getTeamStats,
    
    // Special events
    recordReview,
    recordBudgetHit,
    recordNewRecord,
    recordAvgTicketHit,
    
    // Activity
    getActivityLog,
    
    // Data
    getGamificationData
};
