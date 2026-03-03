# KPI UI Integration Examples

## 1. Quick Stats Section (Existing UI)

### Current Location in `index.html`:
Line ~110-140 (`.quick-stats` container)

### Add New KPI Cards:

```html
<!-- After existing quick-stats -->
<div class="quick-stat">
    <div class="quick-icon">🛒</div>
    <div class="quick-content">
        <div class="quick-label">Varer per ordre</div>
        <div class="quick-value" id="items-per-order">2.7</div>
        <div class="quick-target">mål: 3.1</div>
    </div>
</div>

<div class="quick-stat">
    <div class="quick-icon">☕</div>
    <div class="quick-content">
        <div class="quick-label">Kaffe-attach</div>
        <div class="quick-value" id="coffee-attach">34%</div>
        <div class="quick-target">mål: 35%</div>
    </div>
</div>

<div class="quick-stat">
    <div class="quick-icon">🥐</div>
    <div class="quick-content">
        <div class="quick-label">Bakevare-attach</div>
        <div class="quick-value" id="bun-attach">110%</div>
        <div class="quick-target">mål: 100%</div>
    </div>
</div>
```

---

## 2. JavaScript Update Function

### Add to `<script>` section (~line 400+):

```javascript
// Load and update KPI data
async function loadKPIs() {
    try {
        const kpi = await api(`/api/kpi/${currentLocation}`);
        
        // Update items per order
        const itemsEl = document.getElementById('items-per-order');
        if (itemsEl) {
            itemsEl.textContent = kpi.itemsPerOrder.toFixed(1);
            itemsEl.parentElement.classList.toggle('goal-met', kpi.itemsPerOrder >= 3.1);
        }
        
        // Update coffee attach rate
        const coffeeEl = document.getElementById('coffee-attach');
        if (coffeeEl && kpi.coffeeAttachRate !== null) {
            coffeeEl.textContent = kpi.coffeeAttachRate + '%';
            coffeeEl.parentElement.classList.toggle('goal-met', kpi.coffeeAttachRate >= 35);
        }
        
        // Update bun attach rate
        const bunEl = document.getElementById('bun-attach');
        if (bunEl && kpi.bunAttachRate !== null) {
            bunEl.textContent = kpi.bunAttachRate + '%';
            bunEl.parentElement.classList.toggle('goal-met', kpi.bunAttachRate >= 100);
        }
        
    } catch (error) {
        console.error('Load KPIs error:', error);
    }
}

// Call loadKPIs in loadData() function
async function loadData() {
    try {
        // ... existing code ...
        
        // Load KPIs
        await loadKPIs();
        
    } catch (error) {
        console.error('Load data error:', error);
    }
}
```

---

## 3. CSS Styling

### Add to `style.css`:

```css
/* KPI Goal Met Indicator */
.quick-stat .goal-met {
    color: var(--neon-green);
}

.quick-stat .goal-met .quick-value {
    text-shadow: 0 0 8px var(--neon-green);
}

/* KPI Target Label */
.quick-target {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 2px;
}
```

---

## 4. Advanced: KPI Trend Modal

### HTML Modal:

```html
<!-- Add after existing modals -->
<div id="kpi-modal" class="modal">
    <div class="modal-content">
        <span class="close" onclick="closeKpiModal()">&times;</span>
        <h2>📊 KPI Trend - Siste 7 Dager</h2>
        
        <div class="kpi-trend-grid">
            <div class="kpi-trend-card">
                <h3>Snittkurv</h3>
                <canvas id="avgticket-trend"></canvas>
                <div class="kpi-current">Nå: <span id="kpi-avgticket-now">185 kr</span></div>
                <div class="kpi-goal">Mål: 200 kr</div>
            </div>
            
            <div class="kpi-trend-card">
                <h3>Varer per ordre</h3>
                <canvas id="items-trend"></canvas>
                <div class="kpi-current">Nå: <span id="kpi-items-now">2.74</span></div>
                <div class="kpi-goal">Mål: 3.1</div>
            </div>
            
            <div class="kpi-trend-card">
                <h3>Kaffe-attach</h3>
                <canvas id="coffee-trend"></canvas>
                <div class="kpi-current">Nå: <span id="kpi-coffee-now">34%</span></div>
                <div class="kpi-goal">Mål: 35%</div>
            </div>
        </div>
    </div>
</div>
```

### JavaScript:

```javascript
async function showKpiTrend() {
    const modal = document.getElementById('kpi-modal');
    modal.style.display = 'block';
    
    // Fetch last 7 days
    const promises = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        promises.push(api(`/api/kpi/${currentLocation}?date=${dateStr}`));
    }
    
    const kpis = await Promise.all(promises);
    kpis.reverse(); // Oldest first
    
    // Extract data
    const dates = kpis.map(k => k.date.substring(5)); // MM-DD
    const avgTickets = kpis.map(k => k.avgTicket);
    const itemsPerOrder = kpis.map(k => k.itemsPerOrder);
    const coffeeAttach = kpis.map(k => k.coffeeAttachRate || 0);
    
    // Draw charts (using Chart.js or simple canvas)
    drawTrendChart('avgticket-trend', dates, avgTickets, 200);
    drawTrendChart('items-trend', dates, itemsPerOrder, 3.1);
    drawTrendChart('coffee-trend', dates, coffeeAttach, 35);
}

function closeKpiModal() {
    document.getElementById('kpi-modal').style.display = 'none';
}
```

---

## 5. Simplified: Just Show Current KPIs

### Minimal Integration (No Charts):

```javascript
// In existing loadData() function, add:
const kpi = await api(`/api/kpi/${currentLocation}`);

// Update avg ticket (if not already shown elsewhere)
const avgTicketEl = document.querySelector('#avg-ticket-value');
if (avgTicketEl) {
    avgTicketEl.textContent = kpi.avgTicket + ' kr';
    avgTicketEl.classList.toggle('goal-met', kpi.avgTicket >= 200);
}

// Add items per order to hero section
const itemsInfo = document.querySelector('#items-per-order-info');
if (itemsInfo) {
    itemsInfo.textContent = `${kpi.itemsPerOrder} varer per ordre`;
}
```

---

## 6. Where to Add in Existing UI

### Option A: Quick Stats Row (Recommended)
**Location:** After line ~140 in `index.html`  
**Impact:** Minimal, just adds 2-3 new cards  
**Benefit:** Consistent with existing design

### Option B: New "KPI Section"
**Location:** After "Weekly Vibes" section (~line 160)  
**Impact:** New section  
**Benefit:** Dedicated KPI area

### Option C: Modal/Popup
**Location:** Triggered by button click  
**Impact:** None until user clicks  
**Benefit:** Keeps dashboard clean

---

## 7. Real-Time Updates

### Auto-refresh KPIs every 30 seconds:

```javascript
// Add to existing auto-refresh interval
setInterval(() => {
    loadKPIs(); // Refresh KPIs
    loadData(); // Refresh sales data
}, 30000);
```

---

## Example: Complete Quick Stat Integration

### 1. Add HTML (after existing quick-stats):

```html
<div class="quick-stat">
    <div class="quick-icon">🛒</div>
    <div class="quick-content">
        <div class="quick-label">Varer/ordre</div>
        <div class="quick-value" id="kpi-items">2.7</div>
    </div>
</div>

<div class="quick-stat">
    <div class="quick-icon">☕</div>
    <div class="quick-content">
        <div class="quick-label">Kaffe</div>
        <div class="quick-value" id="kpi-coffee">34%</div>
    </div>
</div>
```

### 2. Add JavaScript (in loadData):

```javascript
// Load KPI data
const kpi = await api(`/api/kpi/${currentLocation}`);

// Update UI
document.getElementById('kpi-items').textContent = kpi.itemsPerOrder.toFixed(1);
document.getElementById('kpi-coffee').textContent = kpi.coffeeAttachRate + '%';

// Highlight if goal met
if (kpi.itemsPerOrder >= 3.1) {
    document.getElementById('kpi-items').classList.add('goal-met');
}
if (kpi.coffeeAttachRate >= 35) {
    document.getElementById('kpi-coffee').classList.add('goal-met');
}
```

### 3. Add CSS:

```css
.quick-value.goal-met {
    color: #39ff14;
    text-shadow: 0 0 10px rgba(57, 255, 20, 0.5);
}
```

---

## Testing

```bash
# Start server
npm start

# Open browser
open http://localhost:3000

# Check console for KPI data
# Should see: { avgTicket: 185, itemsPerOrder: 2.74, ... }
```

---

## Next Steps

1. Choose integration point (Quick Stats recommended)
2. Add HTML for new KPI cards
3. Add JavaScript to fetch and update
4. Test with live data
5. Add styling/animations
6. Deploy to Fly.io
