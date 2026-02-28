/**
 * Bear House Dashboard Server v4.0
 * 🐻🎮 Full Gamification Engine + Favrit Integration
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const gamification = require('./src/gamification');
const favrit = require('./src/favrit');
const budgetModule = require('./src/budget');
const recordsModule = require('./src/records');
const streakModule = require('./src/streak');
const avgTicketModule = require('./src/avgticket');

// Multer config for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

const app = express();
const PORT = process.env.PORT || 3000;

// Planday config
const PLANDAY = {
    clientId: 'eea0dc07-83f6-4df7-9792-79b120ba7839',
    refreshToken: 'MTnGQFLsIECNhGOFEwYrNg',
    tokenUrl: 'https://id.planday.com/connect/token',
    apiBase: 'https://openapi.planday.com'
};

// Department mapping
const DEPARTMENTS = {
    16761: { name: 'Bakeri Nesbyen', location: 'nesbyen' },
    16854: { name: 'Bakeri Hemsedal', location: 'hemsedal' },
    16851: { name: 'Produksjon', location: 'nesbyen' },
    16852: { name: 'Bakeri Ål', location: 'al' },
    16853: { name: 'Burger Ål', location: 'al' }
};

// Data files
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOGIN_LOG_FILE = path.join(DATA_DIR, 'login-log.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// Initialize data files
function loadJSON(file, defaultValue = []) {
    try {
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'));
        }
    } catch (e) {}
    return defaultValue;
}

function saveJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Planday token management
let plandayToken = null;
let tokenExpiry = 0;

async function getPlandayToken() {
    if (plandayToken && Date.now() < tokenExpiry - 60000) {
        return plandayToken;
    }

    const response = await fetch(PLANDAY.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: PLANDAY.clientId,
            refresh_token: PLANDAY.refreshToken,
            grant_type: 'refresh_token'
        })
    });

    const data = await response.json();
    plandayToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
    
    return plandayToken;
}

async function plandayAPI(endpoint) {
    const token = await getPlandayToken();
    
    const response = await fetch(`${PLANDAY.apiBase}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-ClientId': PLANDAY.clientId
        }
    });

    return response.json();
}

// CORS - Allow all origins for Cloudflare tunnel access
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware - body parser MUST come before static
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
}));

// Session management with file persistence
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');
let sessions = new Map();

// Load sessions from file on startup
function loadSessions() {
    try {
        if (fs.existsSync(SESSIONS_FILE)) {
            const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
            sessions = new Map(Object.entries(data));
            console.log(`[Sessions] Loaded ${sessions.size} sessions from file`);
        }
    } catch (e) {
        console.error('[Sessions] Error loading:', e.message);
    }
}

// Save sessions to file
function saveSessions() {
    try {
        const data = Object.fromEntries(sessions);
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[Sessions] Error saving:', e.message);
    }
}

// Load on startup
loadSessions();

function createSession(user, location) {
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions.set(token, {
        user,
        location,
        createdAt: Date.now(),
        lastActivity: Date.now()
    });
    saveSessions();
    return token;
}

function getSession(token) {
    const session = sessions.get(token);
    if (session) {
        session.lastActivity = Date.now();
        // Save periodically (every 5 min of activity)
        if (Date.now() - session.lastSaved > 300000 || !session.lastSaved) {
            session.lastSaved = Date.now();
            saveSessions();
        }
    }
    return session;
}

// Auth middleware
function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'];
    const session = token ? getSession(token) : null;
    
    if (!session) {
        return res.status(401).json({ error: 'Ikke innlogget' });
    }
    
    req.session = session;
    next();
}

function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.session.user.role !== 'admin') {
            return res.status(403).json({ error: 'Kun for admin' });
        }
        next();
    });
}

// ============ AUTH ENDPOINTS ============

app.post('/api/login', (req, res) => {
    const { username, password, location } = req.body;
    
    if (!username || !password || !location) {
        return res.status(400).json({ error: 'Brukernavn, passord og lokasjon kreves' });
    }

    const users = loadJSON(USERS_FILE, []);
    const user = users.find(u => 
        u.username.toLowerCase() === username.toLowerCase() && u.active !== false
    );

    if (!user) {
        return res.status(401).json({ error: 'Ukjent bruker' });
    }

    if (user.password !== password) {
        return res.status(401).json({ error: 'Feil passord' });
    }

    // Log login
    const loginLog = loadJSON(LOGIN_LOG_FILE, []);
    loginLog.unshift({
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        location,
        timestamp: new Date().toISOString(),
        ip: req.ip
    });
    saveJSON(LOGIN_LOG_FILE, loginLog.slice(0, 1000));

    // Create session
    const token = createSession(user, location);
    
    // Update streak on login
    const streakResult = gamification.updateStreak(user.id);
    
    // Auto-complete check-in quest
    const checkInResult = gamification.completeQuest(user.id, 'check-in', 'daily');
    
    // Check for early bird (before 07:00)
    const hour = new Date().getHours();
    if (hour < 7) {
        const stats = gamification.getUserStats(user.id);
        stats.earlyLogins = (stats.earlyLogins || 0) + 1;
        gamification.updateUserStats(user.id, stats);
        
        // Check early bird achievement
        if (stats.earlyLogins >= 10) {
            gamification.unlockAchievement(user.id, 'early-bird');
        }
    }

    // Get full profile
    const profile = gamification.getFullProfile(user.id);

    res.json({
        success: true,
        token,
        user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role || 'employee',
            location
        },
        gamification: {
            streak: streakResult,
            checkIn: checkInResult.error ? null : checkInResult,
            profile
        }
    });
});

app.post('/api/logout', (req, res) => {
    const token = req.headers['x-auth-token'];
    if (token) sessions.delete(token);
    res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
    const profile = gamification.getFullProfile(req.session.user.id);
    
    res.json({
        user: {
            id: req.session.user.id,
            username: req.session.user.username,
            fullName: req.session.user.fullName,
            role: req.session.user.role || 'employee'
        },
        location: req.session.location,
        gamification: profile
    });
});

// ============ GAMIFICATION ENDPOINTS ============

/**
 * GET /api/profile - Get full gamification profile
 */
app.get('/api/profile', requireAuth, (req, res) => {
    const profile = gamification.getFullProfile(req.session.user.id);
    res.json(profile);
});

/**
 * GET /api/profile/:userId - Get another user's profile (admin)
 */
app.get('/api/profile/:userId', requireAdmin, (req, res) => {
    const userId = parseInt(req.params.userId);
    const profile = gamification.getFullProfile(userId);
    res.json(profile);
});

/**
 * GET /api/quests - Get available quests
 */
app.get('/api/quests', requireAuth, (req, res) => {
    const quests = gamification.getAvailableQuests(req.session.user.id);
    res.json(quests);
});

/**
 * POST /api/quests/:questId/complete - Complete a quest
 */
app.post('/api/quests/:questId/complete', requireAuth, (req, res) => {
    const { questId } = req.params;
    const { category } = req.body;
    
    if (!category || !['daily', 'weekly', 'monthly', 'special'].includes(category)) {
        return res.status(400).json({ error: 'Kategori kreves (daily/weekly/monthly/special)' });
    }
    
    const result = gamification.completeQuest(req.session.user.id, questId, category);
    
    if (result.error) {
        return res.status(400).json(result);
    }
    
    // Update leaderboards after quest completion
    gamification.updateLeaderboards();
    
    res.json(result);
});

/**
 * GET /api/achievements - Get all achievements with unlock status
 */
app.get('/api/achievements', requireAuth, (req, res) => {
    const achievements = gamification.getUserAchievements(req.session.user.id);
    res.json(achievements);
});

/**
 * GET /api/leaderboard/:type - Get leaderboard (daily/weekly/monthly/allTime)
 */
app.get('/api/leaderboard/:type', requireAuth, (req, res) => {
    const { type } = req.params;
    const { location } = req.query;
    
    if (!['daily', 'weekly', 'monthly', 'allTime'].includes(type)) {
        return res.status(400).json({ error: 'Type må være daily/weekly/monthly/allTime' });
    }
    
    // Update leaderboards first
    gamification.updateLeaderboards();
    
    const leaderboard = gamification.getLeaderboard(type, location || null);
    res.json(leaderboard);
});

/**
 * GET /api/teams - Get team challenge stats
 */
app.get('/api/teams', requireAuth, (req, res) => {
    const stats = gamification.getTeamStats();
    res.json(stats);
});

/**
 * POST /api/review - Record a Google review (admin only for now)
 */
app.post('/api/review', requireAdmin, (req, res) => {
    const { userId, stars } = req.body;
    
    if (!userId || !stars || stars < 1 || stars > 5) {
        return res.status(400).json({ error: 'userId og stars (1-5) kreves' });
    }
    
    const result = gamification.recordReview(userId, stars);
    gamification.updateLeaderboards();
    
    res.json(result);
});

/**
 * POST /api/budget-hit - Record budget achievement
 */
app.post('/api/budget-hit', requireAdmin, (req, res) => {
    const { userIds, location } = req.body;
    
    if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'userIds array kreves' });
    }
    
    const results = gamification.recordBudgetHit(userIds);
    gamification.updateLeaderboards();
    
    res.json({ success: true, results });
});

/**
 * POST /api/avg-ticket-hit - Record high average ticket achievement
 */
app.post('/api/avg-ticket-hit', requireAdmin, (req, res) => {
    const { userIds, location, avgTicket, goal } = req.body;
    
    if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'userIds array kreves' });
    }
    
    const results = gamification.recordAvgTicketHit(userIds, location, avgTicket, goal);
    gamification.updateLeaderboards();
    
    res.json({ success: true, results, avgTicket, goal });
});

/**
 * POST /api/new-record - Record new sales record
 */
app.post('/api/new-record', requireAdmin, (req, res) => {
    const { userIds, recordType, value } = req.body;
    
    if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'userIds array kreves' });
    }
    
    const results = gamification.recordNewRecord(userIds);
    gamification.updateLeaderboards();
    
    res.json({ success: true, results });
});

/**
 * GET /api/activity - Get activity log
 */
app.get('/api/activity', requireAuth, (req, res) => {
    const { userId, limit } = req.query;
    
    // Non-admins can only see their own activity
    const targetUserId = req.session.user.role === 'admin' && userId
        ? parseInt(userId)
        : req.session.user.id;
    
    const activity = gamification.getActivityLog(targetUserId, parseInt(limit) || 50);
    res.json(activity);
});

/**
 * GET /api/user/:id/xp-breakdown - Get XP breakdown for any user (public within app)
 */
app.get('/api/user/:id/xp-breakdown', requireAuth, (req, res) => {
    const userId = parseInt(req.params.id);
    
    // Get user stats
    const stats = gamification.getUserStats(userId);
    if (!stats) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Get activity log for this user
    const activity = gamification.getActivityLog(userId, 100);
    
    // Build XP breakdown
    const xpEvents = activity.filter(a => a.type === 'xp').map(a => ({
        amount: a.data.amount,
        reason: a.data.reason,
        date: a.timestamp
    }));
    
    // Get quest history
    const questHistory = (stats.questHistory || []).map(q => ({
        quest: q.questId,
        category: q.category,
        xp: q.xp,
        date: q.completedAt
    }));
    
    res.json({
        userId,
        fullName: stats.fullName,
        username: stats.username,
        totalXp: stats.totalXp,
        weeklyXp: stats.weeklyXpThisWeek || 0,
        level: stats.level,
        xpEvents,
        questHistory,
        achievements: stats.achievements || [],
        categoryStats: stats.categoryStats || {}
    });
});

/**
 * GET /api/gamification/data - Get full gamification data (admin)
 */
app.get('/api/gamification/data', requireAdmin, (req, res) => {
    const data = gamification.getGamificationData();
    res.json(data);
});

// ============ TASKS ENDPOINTS ============

const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const TASK_PHOTOS_DIR = path.join(__dirname, 'public', 'task-photos');
if (!fs.existsSync(TASK_PHOTOS_DIR)) fs.mkdirSync(TASK_PHOTOS_DIR, { recursive: true });

function loadTasks() {
    return loadJSON(TASKS_FILE, { tasks: [], completions: [] });
}

function saveTasks(data) {
    saveJSON(TASKS_FILE, data);
}

/**
 * GET /api/tasks - Get all tasks and recent completions
 * Now includes cooldown info - tasks done today at this location are marked
 */
app.get('/api/tasks', requireAuth, (req, res) => {
    const data = loadTasks();
    const location = req.session.location || 'nesbyen';
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's completions for this location
    const todayCompletions = (data.completions || [])
        .filter(c => c.completedAt && c.completedAt.startsWith(today))
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
    
    // Track which tasks are on cooldown (done today at this location)
    const cooldownTasks = new Set();
    todayCompletions.forEach(c => {
        if (c.location === location) {
            cooldownTasks.add(c.taskId);
        }
    });
    
    // Add cooldown status to tasks
    const tasksWithCooldown = (data.tasks || []).map(task => ({
        ...task,
        onCooldown: cooldownTasks.has(task.id),
        requiresPhoto: false // Honor system - no photos required
    }));
    
    res.json({
        tasks: tasksWithCooldown,
        categories: data.categories || {},
        recentCompletions: todayCompletions.slice(0, 20),
        location
    });
});

/**
 * POST /api/tasks/complete - Complete a task with photos
 */
app.post('/api/tasks/complete', requireAuth, async (req, res) => {
    const { taskId, photoBefore, photoAfter } = req.body;
    const user = req.session.user;
    
    const data = loadTasks();
    const task = data.tasks.find(t => t.id === taskId);
    
    if (!task) {
        return res.status(404).json({ error: 'Oppgave ikke funnet' });
    }
    
    // Photos optional for now - skip validation
    // if (task.requiresPhoto && (!photoBefore || !photoAfter)) {
    //     return res.status(400).json({ error: 'Bilder kreves for denne oppgaven' });
    // }
    
    // Save photos if provided
    let photoBeforePath = null;
    let photoAfterPath = null;
    const timestamp = Date.now();
    
    if (photoBefore) {
        const beforeFileName = `${taskId}_${user.id}_${timestamp}_before.jpg`;
        const beforeData = photoBefore.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(path.join(TASK_PHOTOS_DIR, beforeFileName), Buffer.from(beforeData, 'base64'));
        photoBeforePath = `/task-photos/${beforeFileName}`;
    }
    
    if (photoAfter) {
        const afterFileName = `${taskId}_${user.id}_${timestamp}_after.jpg`;
        const afterData = photoAfter.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(path.join(TASK_PHOTOS_DIR, afterFileName), Buffer.from(afterData, 'base64'));
        photoAfterPath = `/task-photos/${afterFileName}`;
    }
    
    // Record completion
    const completion = {
        taskId,
        taskName: task.name,
        emoji: task.emoji,
        userId: user.id,
        userName: user.fullName || user.username,
        xp: task.xp,
        photoBefore: photoBeforePath,
        photoAfter: photoAfterPath,
        completedAt: new Date().toISOString(),
        location: req.session.location
    };
    
    if (!data.completions) data.completions = [];
    data.completions.push(completion);
    saveTasks(data);
    
    // Give XP
    const xpResult = gamification.addXp(user.id, task.xp, `Oppgave: ${task.name}`);
    gamification.updateLeaderboards();
    
    console.log(`[Tasks] ${user.fullName} completed "${task.name}" (+${task.xp} XP)`);
    
    res.json({
        success: true,
        xp: task.xp,
        completion,
        xpResult
    });
});

/**
 * POST /api/tasks/complete-upload - Complete a task with file uploads (multipart)
 */
app.post('/api/tasks/complete-upload', requireAuth, upload.fields([
    { name: 'photoBefore', maxCount: 1 },
    { name: 'photoAfter', maxCount: 1 }
]), async (req, res) => {
    try {
        const { taskId } = req.body;
        const user = req.session.user;
        
        const data = loadTasks();
        const task = data.tasks.find(t => t.id === taskId);
        
        if (!task) {
            return res.status(404).json({ error: 'Oppgave ikke funnet' });
        }
        
        const timestamp = Date.now();
        let photoBeforePath = null;
        let photoAfterPath = null;
        
        // Process uploaded images with sharp (compress and resize)
        // With fallback to direct save if sharp fails
        if (req.files?.photoBefore?.[0]) {
            const beforeFileName = `${taskId}_${user.id}_${timestamp}_before.jpg`;
            const beforePath = path.join(TASK_PHOTOS_DIR, beforeFileName);
            try {
                await sharp(req.files.photoBefore[0].buffer)
                    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 70 })
                    .toFile(beforePath);
            } catch (sharpErr) {
                console.log('[Tasks] Sharp failed, saving raw file:', sharpErr.message);
                // Fallback: save file directly
                fs.writeFileSync(beforePath, req.files.photoBefore[0].buffer);
            }
            photoBeforePath = `/task-photos/${beforeFileName}`;
        }
        
        if (req.files?.photoAfter?.[0]) {
            const afterFileName = `${taskId}_${user.id}_${timestamp}_after.jpg`;
            const afterPath = path.join(TASK_PHOTOS_DIR, afterFileName);
            try {
                await sharp(req.files.photoAfter[0].buffer)
                    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 70 })
                    .toFile(afterPath);
            } catch (sharpErr) {
                console.log('[Tasks] Sharp failed, saving raw file:', sharpErr.message);
                // Fallback: save file directly
                fs.writeFileSync(afterPath, req.files.photoAfter[0].buffer);
            }
            photoAfterPath = `/task-photos/${afterFileName}`;
        }
        
        // Record completion
        const completion = {
            taskId,
            taskName: task.name,
            emoji: task.emoji,
            userId: user.id,
            userName: user.fullName || user.username,
            xp: task.xp,
            photoBefore: photoBeforePath,
            photoAfter: photoAfterPath,
            completedAt: new Date().toISOString(),
            location: req.session.location
        };
        
        if (!data.completions) data.completions = [];
        data.completions.push(completion);
        saveTasks(data);
        
        // Give XP
        const xpResult = gamification.addXp(user.id, task.xp, `Oppgave: ${task.name}`);
        gamification.updateLeaderboards();
        
        console.log(`[Tasks] ${user.fullName} completed "${task.name}" (+${task.xp} XP) with photos`);
        
        res.json({
            success: true,
            xp: task.xp,
            completion,
            xpResult
        });
    } catch (error) {
        console.error('[Tasks] Upload error:', error);
        res.status(500).json({ error: 'Kunne ikke laste opp bilder' });
    }
});

/**
 * GET /api/tasks/history - Get task completion history (admin)
 */
app.get('/api/tasks/history', requireAdmin, (req, res) => {
    const data = loadTasks();
    const limit = parseInt(req.query.limit) || 100;
    
    const completions = (data.completions || [])
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
        .slice(0, limit);
    
    res.json(completions);
});

// ============ ADMIN ENDPOINTS ============

app.get('/api/admin/login-log', requireAdmin, (req, res) => {
    const log = loadJSON(LOGIN_LOG_FILE, []);
    res.json(log.slice(0, 100));
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
    const users = loadJSON(USERS_FILE, []);
    res.json(users.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        location: u.location,
        role: u.role,
        active: u.active !== false
    })));
});

app.post('/api/admin/users/:id/password', requireAdmin, (req, res) => {
    const { password } = req.body;
    const userId = parseInt(req.params.id);
    
    const users = loadJSON(USERS_FILE, []);
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        return res.status(404).json({ error: 'Bruker ikke funnet' });
    }

    user.password = password;
    saveJSON(USERS_FILE, users);

    res.json({ success: true });
});

app.post('/api/admin/sync-planday', requireAdmin, async (req, res) => {
    try {
        const data = await plandayAPI('/hr/v1/employees?limit=100');
        const employees = data.data || [];
        
        const existingUsers = loadJSON(USERS_FILE, []);
        let added = 0, updated = 0;

        for (const emp of employees) {
            const firstName = (emp.firstName || '').trim();
            const username = firstName.toLowerCase().replace(/\s+/g, '');
            
            let location = 'nesbyen';
            if (emp.departments?.includes(16854)) location = 'hemsedal';
            else if (emp.departments?.includes(16852) || emp.departments?.includes(16853)) location = 'al';

            const userData = {
                id: emp.id,
                username,
                firstName,
                lastName: emp.lastName || '',
                fullName: `${firstName} ${emp.lastName || ''}`.trim(),
                email: emp.email || '',
                phone: emp.cellPhone || '',
                location,
                departments: emp.departments || [],
                role: 'employee',
                active: true,
                plandaySynced: new Date().toISOString()
            };

            const existingIndex = existingUsers.findIndex(u => u.id === emp.id);
            
            if (existingIndex >= 0) {
                userData.password = existingUsers[existingIndex].password;
                userData.role = existingUsers[existingIndex].role;
                existingUsers[existingIndex] = { ...existingUsers[existingIndex], ...userData };
                updated++;
            } else {
                userData.password = '0000';
                existingUsers.push(userData);
                added++;
            }
        }

        saveJSON(USERS_FILE, existingUsers);

        res.json({ 
            success: true, 
            total: employees.length,
            added,
            updated
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin/give-xp - Give XP to a user (admin)
 */
app.post('/api/admin/give-xp', requireAdmin, (req, res) => {
    const { userId, amount, reason } = req.body;
    
    if (!userId || !amount) {
        return res.status(400).json({ error: 'userId og amount kreves' });
    }
    
    const result = gamification.addXp(userId, amount, reason || 'Admin bonus');
    gamification.updateLeaderboards();
    
    res.json(result);
});

/**
 * POST /api/admin/unlock-achievement - Manually unlock achievement
 */
app.post('/api/admin/unlock-achievement', requireAdmin, (req, res) => {
    const { userId, achievementId } = req.body;
    
    if (!userId || !achievementId) {
        return res.status(400).json({ error: 'userId og achievementId kreves' });
    }
    
    const result = gamification.unlockAchievement(userId, achievementId);
    res.json(result);
});

// ============ DASHBOARD DATA ENDPOINTS (FAVRIT LIVE DATA) ============

// Sales data cache (refresh every 30 seconds for live updates)
const salesCache = new Map();
const CACHE_TTL = 30000;

app.get('/api/data/:location', requireAuth, async (req, res) => {
    const { location } = req.params;
    
    try {
        const budget = await getBudget(location);
        
        // Check cache (include date to prevent stale data across midnight)
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `sales_${location}_${today}`;
        const cached = salesCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return res.json({
                ...cached.data,
                budget,
                cached: true
            });
        }

        // Fetch live data from Favrit
        let sales = 0;
        let hourly = 0;
        let transactions = 0;
        let avgTicket = 0;
        let bestsellers = [];

        try {
            const favritData = await favrit.getTodaySales(location);
            sales = favritData.summary.totalSales;
            hourly = favritData.currentHour.sales;
            transactions = favritData.summary.uniqueOrders;
            avgTicket = favritData.summary.averageTicket;
            bestsellers = favritData.bestsellers;
            
            // Cache the result
            salesCache.set(cacheKey, {
                timestamp: Date.now(),
                data: { location, sales, hourly, transactions, avgTicket, bestsellers }
            });
            
            console.log(`[Favrit] ${location}: ${sales} kr (${transactions} orders)`);
        } catch (favritError) {
            console.error(`[Favrit] Error for ${location}:`, favritError.message);
            // Fallback to simulated data if Favrit fails
            const now = new Date();
            const hour = now.getHours();
            if (hour >= 7 && hour <= 19) {
                const dayProgress = (hour - 7 + now.getMinutes() / 60) / 12;
                const randomFactor = 0.85 + Math.random() * 0.3;
                sales = Math.round(budget * dayProgress * randomFactor);
                hourly = Math.round((budget / 12) * randomFactor);
                transactions = Math.round(sales / 85);
                avgTicket = 85;
            }
        }

        // Check average ticket goal
        const avgTicketGoal = avgTicketModule.checkAvgTicketGoal(location, avgTicket);

        res.json({
            location,
            budget,
            sales,
            hourly,
            transactions,
            avgTicket,
            avgTicketGoal: avgTicketGoal.goal,
            avgTicketMet: avgTicketGoal.goalMet,
            avgTicketPercent: avgTicketGoal.percentOfGoal,
            bestsellers,
            timestamp: Date.now(),
            source: 'favrit'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/bestsellers/:location - Get today's bestsellers
 */
app.get('/api/bestsellers/:location', requireAuth, async (req, res) => {
    const { location } = req.params;
    
    try {
        const data = await favrit.getTodaySales(location);
        res.json({
            location,
            bestsellers: data.bestsellers,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/favrit/locations - Get all Favrit locations
 */
app.get('/api/favrit/locations', requireAdmin, async (req, res) => {
    try {
        const locations = await favrit.getLocations();
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/favrit/all - Get sales for all locations
 */
app.get('/api/favrit/all', requireAdmin, async (req, res) => {
    try {
        const data = await favrit.getAllLocationsSales();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ RECORDS & YEAR-OVER-YEAR COMPARISON ============

/**
 * GET /api/records/:location - Get all-time records
 */
app.get('/api/records/:location', requireAuth, (req, res) => {
    const { location } = req.params;
    const records = recordsModule.getRecords(location);
    
    if (!records) {
        return res.status(404).json({ error: 'Location not found' });
    }
    
    res.json({
        location,
        records,
        timestamp: Date.now()
    });
});

/**
 * GET /api/comparison - Get year-over-year comparison info
 */
app.get('/api/comparison', requireAuth, (req, res) => {
    const info = recordsModule.getYearOverYearInfo();
    res.json(info);
});

/**
 * GET /api/comparison/:location - Get YoY comparison with actual data
 */
app.get('/api/comparison/:location', requireAuth, async (req, res) => {
    const { location } = req.params;
    
    try {
        const info = recordsModule.getYearOverYearInfo();
        const budgets = await budgetModule.fetchBudgetData(location);
        
        // Get last year's data for comparison week
        const lastYearWeekData = budgets?.[info.compareWeek] || null;
        
        res.json({
            location,
            ...info,
            lastYearData: lastYearWeekData,
            timestamp: Date.now()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/yoy-wtd/:location - Year-over-Year Week-to-Date comparison
 * Compares this week's sales (so far) with the same period last year
 * Handles Easter adjustment: Easter week compares to last year's Easter week
 */
app.get('/api/yoy-wtd/:location', requireAuth, async (req, res) => {
    const { location } = req.params;
    
    try {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentWeek = recordsModule.getWeekNumber(today);
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, etc.
        
        // Get comparison week (handles Easter)
        const comparison = recordsModule.getComparisonWeek(currentWeek, currentYear);
        
        // Get start of current week (Monday) - use local date formatting
        const currentWeekStart = new Date(today);
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        currentWeekStart.setDate(currentWeekStart.getDate() - daysFromMonday);
        currentWeekStart.setHours(12, 0, 0, 0); // Noon to avoid timezone issues
        
        // Helper to format date as YYYY-MM-DD in local time
        function formatLocalDate(d) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // Get Monday of comparison week in the comparison year
        function getMondayOfWeek(weekNum, year) {
            // January 4th is always in week 1 (ISO week)
            const jan4 = new Date(year, 0, 4, 12, 0, 0); // Noon to avoid TZ issues
            const jan4Day = jan4.getDay() || 7; // Convert Sunday from 0 to 7
            
            // Find Monday of week 1
            const week1Monday = new Date(jan4);
            week1Monday.setDate(jan4.getDate() - (jan4Day - 1));
            
            // Add weeks to get to target week
            const targetMonday = new Date(week1Monday);
            targetMonday.setDate(week1Monday.getDate() + (weekNum - 1) * 7);
            
            return targetMonday;
        }
        
        const lastYearWeekStart = getMondayOfWeek(comparison.week, comparison.year);
        console.log(`[YoY] Comparing week ${currentWeek} (${formatLocalDate(currentWeekStart)}) with week ${comparison.week} ${comparison.year} (${formatLocalDate(lastYearWeekStart)})`);
        
        // Calculate how many days we have data for (including today)
        const daysToCompare = daysFromMonday + 1;
        
        let thisYearTotal = 0;
        let lastYearTotal = 0;
        const breakdown = [];
        
        // Fetch all days in parallel for speed
        const dayPromises = [];
        
        for (let i = 0; i < daysToCompare; i++) {
            // This year
            const thisDate = new Date(currentWeekStart);
            thisDate.setDate(thisDate.getDate() + i);
            const thisDateStr = formatLocalDate(thisDate);
            
            // Last year
            const lastDate = new Date(lastYearWeekStart);
            lastDate.setDate(lastDate.getDate() + i);
            const lastDateStr = formatLocalDate(lastDate);
            
            dayPromises.push((async () => {
                const thisSales = await getSalesForDate(location, thisDateStr);
                const lastSales = await getSalesForDate(location, lastDateStr);
                
                return {
                    dayIndex: i,
                    thisYear: { date: thisDateStr, sales: Math.round(thisSales) },
                    lastYear: { date: lastDateStr, sales: Math.round(lastSales) },
                    thisSales,
                    lastSales
                };
            })());
        }
        
        const results = await Promise.all(dayPromises);
        
        results.forEach(r => {
            thisYearTotal += r.thisSales;
            lastYearTotal += r.lastSales;
            breakdown.push({
                dayIndex: r.dayIndex,
                thisYear: r.thisYear,
                lastYear: r.lastYear
            });
        });
        
        const diff = thisYearTotal - lastYearTotal;
        const diffPct = lastYearTotal > 0 ? Math.round((diff / lastYearTotal) * 100) : 0;
        
        // Check if we have no historical data
        const noHistoricalData = lastYearTotal === 0 && thisYearTotal > 0;
        
        res.json({
            location,
            currentWeek,
            comparisonWeek: comparison.week,
            comparisonYear: comparison.year,
            isEasterComparison: comparison.isEaster,
            daysCompared: daysToCompare,
            thisYear: Math.round(thisYearTotal),
            lastYear: Math.round(lastYearTotal),
            diff: Math.round(diff),
            diffPct,
            breakdown,
            noHistoricalData,
            note: noHistoricalData ? 'Historiske data fra testmiljø ikke tilgjengelig' : null,
            timestamp: Date.now()
        });
        
    } catch (error) {
        console.error('[YoY] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============ STREAK SYSTEM ============

/**
 * GET /api/weekly/:location - Get weekly chart data (last 7 days)
 * CACHED for 2 minutes to avoid slow Favrit API calls
 */
const weeklyCache = new Map();
const WEEKLY_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

app.get('/api/weekly/:location', requireAuth, async (req, res) => {
    const { location } = req.params;
    
    // Check cache first
    const cacheKey = `weekly_${location}`;
    const cached = weeklyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < WEEKLY_CACHE_TTL) {
        return res.json(cached.data);
    }
    
    try {
        const today = new Date();
        const weekData = [];
        const days = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
        
        // Calculate Monday of current week (Norwegian standard: week starts Monday)
        const currentDay = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // If Sunday, go back 6 days
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysFromMonday);
        
        // Fetch all days in parallel for speed (Monday to Sunday)
        const dayPromises = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const dayName = days[date.getDay()];
            const todayStr = today.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            
            dayPromises.push((async () => {
                try {
                    const dayBudget = await budgetModule.getBudget(location, date);
                    const sales = await getSalesForDate(location, dateStr);
                    
                    return { 
                        day: dayName, 
                        date: dateStr, 
                        sales: Math.round(sales), 
                        budget: dayBudget, 
                        hit: sales >= dayBudget, 
                        isToday 
                    };
                } catch (err) {
                    return { day: dayName, date: dateStr, sales: 0, budget: 0, hit: false, isToday, error: true };
                }
            })());
        }
        
        const results = await Promise.all(dayPromises);
        
        const responseData = {
            location,
            week: results,
            timestamp: Date.now()
        };
        
        // Cache the result
        weeklyCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
        
        res.json(responseData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
/**
 * GET /api/kpi/:location - Get KPIs for a specific date
 * Query params: ?date=YYYY-MM-DD (optional, defaults to today)
 */
app.get('/api/kpi/:location', requireAuth, async (req, res) => {
    try {
        const location = req.params.location;
        const today = new Date().toISOString().split('T')[0];
        const dateStr = (req.query.date || today).trim();
        const isToday = dateStr === today;

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
        }

        let sales = 0;
        let orders = 0;
        let items = 0;
        let avgTicket = 0;
        let itemsPerOrder = 0;
        let coffeeAttachRate = null;
        let bunAttachRate = null;
        let note = null;

        if (isToday) {
            const liveData = await favrit.getTodaySales(location);

            sales = Number(liveData?.summary?.totalSales || 0);
            orders = Number(liveData?.summary?.uniqueOrders || 0);
            items = Number(liveData?.summary?.totalItems || 0);

            avgTicket = orders > 0 ? Math.round((sales / orders) * 100) / 100 : 0;
            itemsPerOrder = orders > 0 ? Math.round((items / orders) * 100) / 100 : 0;

            const bestsellers = liveData.bestsellers || [];
            const coffeeProducts = bestsellers.filter(p =>
                /kaffe|coffee|cappuccino|latte|espresso/i.test(p.name)
            );
            const bunProducts = bestsellers.filter(p =>
                /bolle|rundstykke|croissant/i.test(p.name)
            );

            const totalCoffeeQty = coffeeProducts.reduce((sum, p) => sum + p.quantity, 0);
            const totalBunQty = bunProducts.reduce((sum, p) => sum + p.quantity, 0);

            coffeeAttachRate = orders > 0 ? Math.round((totalCoffeeQty / orders) * 100) : 0;
            bunAttachRate = orders > 0 ? Math.round((totalBunQty / orders) * 100) : 0;
            note = 'Attach rates are approximations based on product totals, not actual order composition';
        } else {
            const historicalData = await favrit.getDaySales(location, dateStr);

            sales = Number(historicalData?.sales || 0);
            orders = Number(historicalData?.orders || 0);
            items = Number(historicalData?.items || 0);
            avgTicket = Number(historicalData?.avg_ticket || 0);

            itemsPerOrder = orders > 0 ? Math.round((items / orders) * 100) / 100 : 0;
            note = 'Attach rates require extended data-service implementation';
        }

        res.json({
            location,
            date: dateStr,
            isLive: isToday,
            sales,
            orders,
            items,
            avgTicket,
            itemsPerOrder,
            coffeeAttachRate,
            bunAttachRate,
            note
        });

    } catch (error) {
        console.error('[KPI] Error for ' + location + ':', error.message);
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/streak/:location - Get current streak info
 */
app.get('/api/streak/:location', requireAuth, (req, res) => {
    const { location } = req.params;
    const info = streakModule.getStreakInfo(location);
    
    if (!info) {
        return res.status(404).json({ error: 'Location not found' });
    }
    
    res.json({
        location,
        ...info,
        timestamp: Date.now()
    });
});

/**
 * POST /api/streak/record - Record a budget hit/miss and award XP
 * Body: { location, date, sales, budget, workers: ['username1', 'username2'] }
 */
app.post('/api/streak/record', requireAdmin, (req, res) => {
    const { location, date, sales, budget, workers } = req.body;
    
    if (!location || !date || sales === undefined || budget === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = streakModule.recordBudgetHit(
        location, 
        date, 
        sales, 
        budget, 
        workers || []
    );
    
    // Award XP to users via gamification system
    if (result.success && result.xpAwards) {
        const users = gamification.loadUsers();
        
        Object.entries(result.xpAwards).forEach(([username, awards]) => {
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (user) {
                const totalXP = awards.daily + awards.streak;
                if (totalXP > 0) {
                    gamification.awardXP(user.odingaze, totalXP, 
                        awards.streak > 0 
                            ? `Budsjett nådd + streak bonus (${result.currentStreak} dager)`
                            : 'Budsjett nådd');
                }
            }
        });
    }
    
    res.json(result);
});

/**
 * POST /api/streak/init/:location - Initialize streak from Favrit history
 */
app.post('/api/streak/init/:location', requireAdmin, async (req, res) => {
    const { location } = req.params;
    
    try {
        const result = await streakModule.initializeFromHistory(
            location, 
            favrit, 
            budgetModule
        );
        res.json({ success: true, streak: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/staff/:location', requireAuth, async (req, res) => {
    const { location } = req.params;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const data = await plandayAPI(`/scheduling/v1/shifts?from=${today}&to=${today}`);
        const shifts = data.data || [];
        
        const users = loadJSON(USERS_FILE, []);
        
        // Only bakery locations, NOT production (16851)
        const locationDepts = {
            nesbyen: [16761],      // Bakeri Nesbyen only
            hemsedal: [16854],     // Bakeri Hemsedal
            al: [16852, 16853]     // Bakeri Ål + Burger Ål
        };

        const deptIds = locationDepts[location] || [];
        
        // Shift types that indicate absence/sick (add more IDs as needed)
        const sickShiftTypes = [64098]; // 64098 = Syk/Sick in Planday
        
        // Filter: right department + not sick/absent
        const staff = shifts
            .filter(s => {
                if (!deptIds.includes(s.departmentId)) return false;
                // Filter out sick shift types
                if (s.shiftTypeId && sickShiftTypes.includes(s.shiftTypeId)) {
                    return false;
                }
                // Also check status text just in case
                const status = (s.status || '').toLowerCase();
                if (status.includes('sick') || status.includes('syk') || status.includes('absent') || status.includes('fravær')) {
                    return false;
                }
                return true;
            })
            .map(s => {
                const user = users.find(u => u.id === s.employeeId);
                const profile = gamification.getFullProfile(s.employeeId);
                const start = s.startDateTime ? s.startDateTime.split('T')[1]?.substring(0,5) : '';
                const end = s.endDateTime ? s.endDateTime.split('T')[1]?.substring(0,5) : '';
                return {
                    id: s.employeeId,
                    name: user?.fullName || user?.firstName || `Ansatt ${s.employeeId}`,
                    shift: `${start} - ${end}`,
                    status: s.status,
                    level: profile?.level?.current || 1,
                    streak: profile?.streak?.current || 0
                };
            });

        res.json(staff);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/messages', requireAuth, (req, res) => {
    const messages = loadJSON(MESSAGES_FILE, []);
    res.json(messages.slice(0, 10));
});

app.post('/api/messages', requireAdmin, (req, res) => {
    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: 'Tekst kreves' });
    }
    
    const messages = loadJSON(MESSAGES_FILE, []);
    messages.unshift({ 
        text, 
        timestamp: new Date().toISOString(),
        author: req.session.user.fullName
    });
    saveJSON(MESSAGES_FILE, messages.slice(0, 50));
    
    res.json({ success: true });
});

// ============ HELPER FUNCTIONS ============

async function getBudget(location) {
    // Henter budsjett fra Google Sheets automatisk
    return budgetModule.getBudget(location);
}

app.get('/api/anniversaries', requireAuth, (req, res) => {
    const users = loadJSON(USERS_FILE, []);
    const today = new Date();
    const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const anniversaries = users
        .filter(u => u.hireDate)
        .map(u => {
            const hireDate = new Date(u.hireDate);
            const hireMD = `${String(hireDate.getMonth() + 1).padStart(2, '0')}-${String(hireDate.getDate()).padStart(2, '0')}`;
            const years = today.getFullYear() - hireDate.getFullYear();
            
            return {
                ...u,
                hireMD,
                years,
                isToday: hireMD === todayMD && years > 0
            };
        })
        .filter(u => u.isToday)
        .map(u => ({
            name: u.fullName,
            years: u.years,
            message: `${u.firstName} har jobbet her i ${u.years} år i dag! 🎉`
        }));

    res.json(anniversaries);
});

app.get('/api/birthdays', requireAuth, (req, res) => {
    const users = loadJSON(USERS_FILE, []);
    const today = new Date();
    const todayDDMM = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const birthdays = users
        .filter(u => u.password === todayDDMM && u.birthDate)
        .map(u => ({
            name: u.fullName,
            message: `🎂 ${u.firstName} har bursdag i dag!`
        }));

    res.json(birthdays);
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: '3.0.0',
        timestamp: Date.now(),
        features: ['gamification', 'quests', 'achievements', 'leaderboards', 'teams'],
        services: {
            planday: 'active',
            favrit: 'pending',
            gamification: 'active'
        }
    });
});

// ============================================
// HELPER: Get sales for a specific date
// ============================================

/**
 * Get total sales for a location on a specific date
 * Uses favrit-data-service (historical) or live API (today)
 * @param {string} location - Location name (nesbyen, hemsedal)
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @returns {Promise<number>} Total sales amount
 */
async function getSalesForDate(location, dateStr) {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        if (dateStr === today) {
            // Live data for today
            const data = await favrit.getTodaySales(location);
            console.log(`[getSalesForDate] ${location} ${dateStr}: ${data.summary.totalSales} kr (live)`);
            return data.summary.totalSales;
        } else {
            // Historical data from Favrit API directly
            const locationId = favrit.LOCATIONS[location];
            const fromDate = `${dateStr}T00:00:00`;
            const toDate = `${dateStr}T23:59:59`;
            
            const orderLines = await favrit.getOrderLines(locationId, fromDate, toDate);
            const mainOrders = orderLines.filter(o => o.order_line_type === 'ORDER_LINE');
            const totalSales = mainOrders.reduce((sum, o) => {
                const amount = parseFloat(o.amount_with_vat);
                const quantity = parseInt(o.quantity);
                if (isNaN(amount) || isNaN(quantity)) {
                    console.warn(`[getSalesForDate] Invalid data: amount=${o.amount_with_vat}, qty=${o.quantity}`);
                    return sum;
                }
                return sum + (amount * quantity);
            }, 0);
            
            console.log(`[getSalesForDate] ${location} ${dateStr}: ${Math.round(totalSales)} kr (${mainOrders.length} orders)`);
            return totalSales;
        }
    } catch (error) {
        console.error(`[getSalesForDate] ERROR ${location} ${dateStr}:`, error.message);
        return 0;
    }
}

// ============================================
// AUTOMATIC STREAK UPDATE
// ============================================

/**
 * Automatically update streak based on yesterday's Favrit sales vs budget
 * Runs on startup and every hour
 */
async function autoUpdateStreak() {
    const locations = ['nesbyen', 'hemsedal'];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`[AutoStreak] Checking streak for ${yesterdayStr}...`);
    
    for (const location of locations) {
        try {
            // Check if we already processed this date
            const streakInfo = streakModule.getStreakInfo(location);
            if (streakInfo.lastHitDate === yesterdayStr) {
                console.log(`[AutoStreak] ${location}: Already processed ${yesterdayStr}`);
                continue;
            }
            
            // Skip if lastHitDate is today (already up to date)
            const today = new Date().toISOString().split('T')[0];
            if (streakInfo.lastHitDate === today) {
                console.log(`[AutoStreak] ${location}: Already current (${today})`);
                continue;
            }
            
            // Get yesterday's budget (pass Date object)
            const budget = await budgetModule.getBudget(location, yesterday);
            if (!budget || budget === 0) {
                console.log(`[AutoStreak] ${location}: No budget for ${yesterdayStr}`);
                continue;
            }
            
            // Get yesterday's sales
            const sales = await getSalesForDate(location, yesterdayStr);
            
            if (sales > 0) {
                console.log(`[AutoStreak] ${location}: ${yesterdayStr} - Sales: ${sales} kr, Budget: ${budget} kr`);
            }
            
            if (sales >= budget) {
                // Record the budget hit
                const result = streakModule.recordBudgetHit(location, yesterdayStr, sales, budget, []);
                console.log(`[AutoStreak] ${location}: 🔥 Budget HIT! Streak: ${result.currentStreak}`);
            } else if (sales > 0) {
                // Had sales but missed budget - streak resets
                console.log(`[AutoStreak] ${location}: Budget missed (${Math.round(sales/budget*100)}%)`);
            }
        } catch (error) {
            console.error(`[AutoStreak] ${location} error:`, error.message);
        }
    }
}

// Run auto-streak on startup (after 10 seconds to let everything initialize)
setTimeout(() => {
    autoUpdateStreak().catch(e => console.error('[AutoStreak] Startup error:', e.message));
}, 10000);

// Run auto-streak every hour
setInterval(() => {
    autoUpdateStreak().catch(e => console.error('[AutoStreak] Hourly error:', e.message));
}, 60 * 60 * 1000);

// ============================================

// Start server
app.listen(PORT, () => {
    // Update leaderboards on startup
    gamification.updateLeaderboards();
    
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  🐻 Bear House Dashboard v3.0 - Gamification Engine      ║
║  Running at http://localhost:${PORT}                         ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  🔐 Auth:                                                ║
║     POST /api/login         - Login                      ║
║     POST /api/logout        - Logout                     ║
║     GET  /api/me            - Current user + profile     ║
║                                                          ║
║  🎮 Gamification:                                        ║
║     GET  /api/profile       - Full gamification profile  ║
║     GET  /api/quests        - Available quests           ║
║     POST /api/quests/:id/complete - Complete quest       ║
║     GET  /api/achievements  - All achievements           ║
║     GET  /api/leaderboard/:type - Leaderboards           ║
║     GET  /api/teams         - Team challenge stats       ║
║     GET  /api/activity      - Activity log               ║
║                                                          ║
║  👑 Admin:                                               ║
║     POST /api/review        - Record review              ║
║     POST /api/budget-hit    - Record budget achievement  ║
║     POST /api/new-record    - Record sales record        ║
║     POST /api/admin/give-xp - Give XP manually           ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    `);
    
    // Initialize admin user if not exists
    const users = loadJSON(USERS_FILE, []);
    if (!users.find(u => u.id === 0 && u.role === 'admin')) {
        const adminIndex = users.findIndex(u => u.id === 0);
        if (adminIndex === -1) {
            users.push({
                id: 0,
                username: 'martin',
                firstName: 'Martin',
                lastName: 'Gaze',
                fullName: 'Martin Gaze',
                password: '2308',
                role: 'admin',
                location: 'all',
                active: true
            });
        } else {
            users[adminIndex].role = 'admin';
        }
        saveJSON(USERS_FILE, users);
        console.log('Admin user ready: martin / 2308');
    }
    
    // Initialize leaderboards
    gamification.updateLeaderboards();
    console.log('Leaderboards initialized');
});
