// Bear House Dashboard - Main JavaScript
// 🐻 Motiverende sanntids dashboard for medarbeiderne

class BearHouseDashboard {
    constructor() {
        this.currentLocation = 'nesbyen';
        this.data = {
            nesbyen: { sales: 0, budget: 0, hourly: 0, streak: 0 },
            hemsedal: { sales: 0, budget: 0, hourly: 0, streak: 0 }
        };
        this.records = {
            day: { value: 125000, date: '15. des 2025' },
            saturday: { value: 98000, date: '21. des 2025' },
            hour: { value: 18500, date: '24. des kl 11' }
        };
        this.funFacts = [
            'I januar solgte vi 2.340 kanelboller! Det er nok til å stable dem 35 meter høyt 🏔️',
            'Våre bakverk har reist over 10.000 km med fornøyde kunder! 🚗',
            'Vi har bakt over 50.000 croissanter siden vi åpnet! 🥐',
            'Gjennomsnittlig bruker vi 200 kg mel per uke! 🌾',
            'Vår mest populære dag er lørdager - vi selger 40% mer enn hverdager! 📈',
            'Kantarellsuppen vår har fått 5 stjerner av 127 gjester! ⭐'
        ];
        
        this.init();
    }

    init() {
        this.authToken = localStorage.getItem('auth_token');
        
        this.setupClock();
        this.setupLocationToggle();
        this.loadBudgetData();
        this.loadSalesData();
        this.loadWeather();
        this.updateWeekOverview();
        this.rotateFunFacts();
        this.loadCelebrations();
        
        // Auto-refresh every 60 seconds
        setInterval(() => this.refresh(), 60000);
        
        // Rotate fun facts every 30 seconds
        setInterval(() => this.rotateFunFacts(), 30000);
    }

    async loadStaff() {
        try {
            const response = await fetch(`/api/staff/${this.currentLocation}`, {
                headers: { 'X-Auth-Token': this.authToken }
            });
            const staff = await response.json();
            
            const staffList = document.getElementById('staff-list');
            if (staff.length > 0) {
                staffList.innerHTML = staff.map(s => `
                    <div class="staff-member">
                        <span class="staff-avatar">👤</span>
                        <span class="staff-name">${s.name}</span>
                        <span class="staff-shift" style="color: var(--text-secondary); font-size: 0.875rem;">${s.shift}</span>
                    </div>
                `).join('');
            } else {
                staffList.innerHTML = '<div class="staff-member"><span class="staff-name" style="color: var(--text-secondary);">Ingen vakter i dag</span></div>';
            }
        } catch (e) {
            console.error('Failed to load staff:', e);
        }
    }

    async loadCelebrations() {
        try {
            const [anniversaries, birthdays] = await Promise.all([
                fetch('/api/anniversaries', { headers: { 'X-Auth-Token': this.authToken } }).then(r => r.json()),
                fetch('/api/birthdays', { headers: { 'X-Auth-Token': this.authToken } }).then(r => r.json())
            ]);
            
            const celebrations = [...anniversaries, ...birthdays];
            
            if (celebrations.length > 0) {
                const card = document.getElementById('celebrations-card');
                const list = document.getElementById('celebrations-list');
                
                card.style.display = 'block';
                list.innerHTML = celebrations.map(c => `
                    <div class="celebration-item" style="padding: 0.75rem; background: rgba(255, 215, 0, 0.1); border-radius: 0.5rem; margin-bottom: 0.5rem; border-left: 3px solid var(--accent-yellow);">
                        ${c.message}
                    </div>
                `).join('');
            }
        } catch (e) {
            // Silent fail - not critical
        }
    }

    setupClock() {
        const updateClock = () => {
            const now = new Date();
            const options = { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long',
                hour: '2-digit', 
                minute: '2-digit'
            };
            document.getElementById('clock').textContent = now.toLocaleDateString('nb-NO', options);
        };
        updateClock();
        setInterval(updateClock, 1000);
    }

    setupLocationToggle() {
        document.querySelectorAll('.location-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.location-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentLocation = btn.dataset.location;
                this.updateDisplay();
            });
        });
    }

    async loadBudgetData() {
        // Get current week and day
        const now = new Date();
        const weekNumber = this.getWeekNumber(now);
        const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Budget data from Google Sheets (pre-loaded for demo)
        // In production, this would fetch from the server API
        const budgets = {
            nesbyen: {
                // Week 9 budget (current week for 24 Feb 2026)
                9: [30710, 0, 0, 0, 0, 0, 0], // Mon-Sun
                8: [55000, 55000, 55000, 55000, 70000, 80000, 50000]
            },
            hemsedal: {
                9: [20000, 15000, 20000, 25000, 35000, 35000, 30000],
                8: [35000, 40000, 40000, 50000, 50000, 60000, 35000]
            }
        };

        // Map JS day (0=Sun) to our array (0=Mon)
        const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        
        this.data.nesbyen.budget = budgets.nesbyen[weekNumber]?.[dayIndex] || 25000;
        this.data.hemsedal.budget = budgets.hemsedal[weekNumber]?.[dayIndex] || 20000;
        
        this.updateDisplay();
    }

    async loadSalesData() {
        // Mock sales data - will be replaced with Favrit API
        // Simulating real-time sales
        const hour = new Date().getHours();
        const minute = new Date().getMinutes();
        
        // Simulate daily progression (more sales as day goes on)
        const dayProgress = (hour - 7) / 12; // 7am to 7pm
        const randomFactor = 0.8 + Math.random() * 0.4; // 80-120%
        
        if (hour >= 7 && hour <= 19) {
            this.data.nesbyen.sales = Math.round(this.data.nesbyen.budget * dayProgress * randomFactor);
            this.data.hemsedal.sales = Math.round(this.data.hemsedal.budget * dayProgress * randomFactor);
            
            // Hourly sales (mock)
            this.data.nesbyen.hourly = Math.round((this.data.nesbyen.budget / 12) * randomFactor);
            this.data.hemsedal.hourly = Math.round((this.data.hemsedal.budget / 12) * randomFactor);
        }

        // Streak (mock - would be calculated from historical data)
        this.data.nesbyen.streak = 5;
        this.data.hemsedal.streak = 3;

        this.updateDisplay();
    }

    async loadWeather() {
        // Mock weather - would use weather skill in production
        const weatherTips = {
            cold: 'Perfekt for varm kakao og kanelboller! ☕',
            nice: 'Flott dag for uteservering! ☀️',
            rain: 'Folk søker ly - perfekt for kaffe! ☔',
            snow: 'Skifolket trenger energi! ⛷️'
        };

        const temp = -5 + Math.round(Math.random() * 10);
        const conditions = ['Lettskyet', 'Sol', 'Snø', 'Overskyet'];
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        
        let tip = weatherTips.cold;
        if (temp > 5) tip = weatherTips.nice;
        if (condition === 'Snø') tip = weatherTips.snow;

        document.getElementById('weather-info').innerHTML = `
            <span class="weather-temp">${temp}°C</span>
            <span class="weather-desc">${condition}</span>
            <span class="weather-tip">${tip}</span>
        `;
    }

    updateDisplay() {
        const loc = this.currentLocation;
        const data = this.data[loc];
        
        // Update progress bar
        const percent = data.budget > 0 ? Math.round((data.sales / data.budget) * 100) : 0;
        const progressFill = document.getElementById('progress-fill');
        progressFill.style.width = `${Math.min(percent, 100)}%`;
        
        // Update colors based on progress
        progressFill.classList.remove('warning', 'danger');
        if (percent < 50) progressFill.classList.add('danger');
        else if (percent < 80) progressFill.classList.add('warning');
        
        // Update numbers
        document.getElementById('current-sales').textContent = this.formatCurrency(data.sales);
        document.getElementById('budget-target').textContent = this.formatCurrency(data.budget);
        document.getElementById('progress-percent').textContent = `${percent}%`;
        document.getElementById('streak-count').textContent = data.streak;
        
        // Hourly
        const avgHourly = Math.round(data.budget / 12);
        const hourlyDiff = data.hourly - avgHourly;
        const hourlyPercent = avgHourly > 0 ? Math.round((data.hourly / avgHourly) * 100) : 100;
        
        document.getElementById('hourly-current').textContent = this.formatCurrency(data.hourly);
        document.getElementById('hourly-comparison').textContent = `${hourlyPercent}% av snitt`;
        document.getElementById('hourly-indicator').textContent = hourlyPercent >= 100 ? '📈' : '📉';
        
        // Beat yesterday (mock comparison with last week same day)
        const lastWeekSales = Math.round(data.budget * 0.85);
        const diff = data.sales - lastWeekSales;
        const diffEl = document.getElementById('yesterday-diff');
        diffEl.textContent = `${diff >= 0 ? '+' : ''}${this.formatCurrency(diff)}`;
        diffEl.style.color = diff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
        
        // Competition
        this.updateCompetition();
    }

    updateCompetition() {
        const nesbyenPercent = this.data.nesbyen.budget > 0 
            ? (this.data.nesbyen.sales / this.data.nesbyen.budget) * 100 : 0;
        const hemsedalPercent = this.data.hemsedal.budget > 0 
            ? (this.data.hemsedal.sales / this.data.hemsedal.budget) * 100 : 0;
        
        document.getElementById('nesbyen-score').style.width = `${Math.min(nesbyenPercent, 100)}%`;
        document.getElementById('hemsedal-score').style.width = `${Math.min(hemsedalPercent, 100)}%`;
        document.getElementById('nesbyen-value').textContent = `${Math.round(nesbyenPercent)}%`;
        document.getElementById('hemsedal-value').textContent = `${Math.round(hemsedalPercent)}%`;
        
        const winner = nesbyenPercent >= hemsedalPercent ? 'Nesbyen' : 'Hemsedal';
        document.getElementById('competition-winner').textContent = `🏆 ${winner} leder!`;
    }

    updateWeekOverview() {
        const days = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
        const today = new Date().getDay();
        const todayIndex = today === 0 ? 6 : today - 1;
        
        // Mock week data
        const weekData = [
            { actual: 28000, budget: 25000 },
            { actual: 0, budget: 25000 }, // Today
            { actual: 0, budget: 30000 },
            { actual: 0, budget: 30000 },
            { actual: 0, budget: 45000 },
            { actual: 0, budget: 50000 },
            { actual: 0, budget: 40000 }
        ];
        
        // Update today with current data
        weekData[todayIndex].actual = this.data[this.currentLocation].sales;
        weekData[todayIndex].budget = this.data[this.currentLocation].budget;
        
        const weekBarsEl = document.getElementById('week-bars');
        weekBarsEl.innerHTML = days.map((day, i) => {
            const data = weekData[i];
            const percent = data.budget > 0 ? Math.round((data.actual / data.budget) * 100) : 0;
            const isToday = i === todayIndex;
            const isPast = i < todayIndex;
            
            return `
                <div class="week-day ${isToday ? 'today' : ''}">
                    <div class="week-bar-container">
                        <div class="week-bar-fill budget" style="height: 100%"></div>
                        ${isPast || isToday ? `<div class="week-bar-fill" style="height: ${Math.min(percent, 100)}%; background: ${percent >= 100 ? 'var(--accent-green)' : 'var(--accent-blue)'}"></div>` : ''}
                    </div>
                    <span class="week-day-label">${day}</span>
                </div>
            `;
        }).join('');
    }

    rotateFunFacts() {
        const fact = this.funFacts[Math.floor(Math.random() * this.funFacts.length)];
        document.getElementById('funfact-text').textContent = fact;
    }

    showCelebration(type, value) {
        const overlay = document.getElementById('celebration-overlay');
        document.getElementById('celebration-value').textContent = this.formatCurrency(value);
        document.getElementById('celebration-type').textContent = type;
        
        overlay.classList.add('active');
        this.createConfetti();
        
        setTimeout(() => {
            overlay.classList.remove('active');
        }, 5000);
    }

    createConfetti() {
        const container = document.getElementById('confetti');
        container.innerHTML = '';
        
        const colors = ['#00d26a', '#ffd93d', '#ff4757', '#4a9eff', '#a855f7'];
        
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = `${Math.random() * 2}s`;
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            container.appendChild(confetti);
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('nb-NO', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount) + ' kr';
    }

    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    async refresh() {
        await this.loadSalesData();
        await this.loadWeather();
        this.updateWeekOverview();
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new BearHouseDashboard();
});

// API endpoint for receiving messages from Telegram (via Odin)
window.addMessage = function(message) {
    const messagesList = document.getElementById('messages-list');
    const messageEl = document.createElement('div');
    messageEl.className = 'message-item';
    messageEl.innerHTML = `<span class="message-text">${message}</span>`;
    messagesList.prepend(messageEl);
    
    // Keep only last 5 messages
    while (messagesList.children.length > 5) {
        messagesList.lastChild.remove();
    }
};

// API for triggering celebration
window.triggerCelebration = function(type, value) {
    window.dashboard.showCelebration(type, value);
};

// API for updating sales (called by server when Favrit data comes in)
window.updateSales = function(location, sales, hourly) {
    if (window.dashboard.data[location]) {
        window.dashboard.data[location].sales = sales;
        window.dashboard.data[location].hourly = hourly;
        window.dashboard.updateDisplay();
    }
};
