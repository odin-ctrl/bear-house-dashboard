# KPI Endpoint Documentation

## Endpoint

```
GET /api/kpi/:location?date=YYYY-MM-DD
```

**Auth required:** Yes (session cookie)

---

## Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `location` | path | Yes | Location name: `nesbyen` or `hemsedal` |
| `date` | query | No | Date in YYYY-MM-DD format (defaults to today) |

---

## Response

```json
{
  "date": "2026-02-28",
  "location": "nesbyen",
  "isLive": true,
  "sales": 38120,
  "orders": 206,
  "avgTicket": 185,
  "itemsPerOrder": 2.74,
  "coffeeAttachRate": 34,
  "bunAttachRate": 110,
  "note": "Attach rates are approximations based on product totals"
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | Date of the KPIs (YYYY-MM-DD) |
| `location` | string | Location name |
| `isLive` | boolean | `true` if today (live data), `false` if historical |
| `sales` | number | Total sales in kr |
| `orders` | number | Number of unique orders |
| `avgTicket` | number | Average order value in kr |
| `itemsPerOrder` | number | Average items per order |
| `coffeeAttachRate` | number | % of orders with coffee (approximation) |
| `bunAttachRate` | number | % of orders with buns/bakery (approximation) |
| `note` | string | Data quality note |

---

## Data Source

**Today (live):**
- Uses `favrit.getTodaySales()` for real-time data
- Attach rates calculated from bestseller totals (approximation)

**Historical:**
- Uses `favrit.getDaySales()` via favrit-data-service
- Attach rates: `null` (requires data-service implementation)

---

## Example Usage

### JavaScript (fetch)

```javascript
// Get today's KPIs
const today = await fetch('/api/kpi/nesbyen');
const kpi = await today.json();

// Get specific date
const historical = await fetch('/api/kpi/nesbyen?date=2026-02-20');
const kpi2 = await historical.json();
```

### UI Integration Points

#### 1. **Dashboard Hero Section**
```javascript
// Show real-time KPIs
const kpi = await api('/api/kpi/nesbyen');
document.getElementById('avg-ticket').textContent = kpi.avgTicket + ' kr';
document.getElementById('items-per-order').textContent = kpi.itemsPerOrder;
```

#### 2. **KPI Card Widget**
```html
<div class="kpi-card">
  <h3>📊 Dagens Nøkkeltall</h3>
  <div class="kpi-row">
    <span>Snittkurv:</span>
    <span id="kpi-avg-ticket">185 kr</span>
    <span class="target">(mål: 200 kr)</span>
  </div>
  <div class="kpi-row">
    <span>Varer per ordre:</span>
    <span id="kpi-items-per-order">2.74</span>
    <span class="target">(mål: 3.1)</span>
  </div>
  <div class="kpi-row">
    <span>Kaffe-attach:</span>
    <span id="kpi-coffee-attach">34%</span>
    <span class="target">(mål: 35%)</span>
  </div>
</div>
```

#### 3. **Week Comparison**
```javascript
// Compare this week vs last week
const promises = [];
for (let i = 0; i < 7; i++) {
  const date = getDaysAgo(i);
  promises.push(fetch(`/api/kpi/nesbyen?date=${date}`));
}
const weekKpis = await Promise.all(promises);
// Calculate weekly averages
```

#### 4. **Goal Progress Bar**
```javascript
const kpi = await api('/api/kpi/nesbyen');
const avgTicketGoal = 200;
const progress = Math.min(100, (kpi.avgTicket / avgTicketGoal) * 100);

// Update progress bar
document.getElementById('avg-ticket-progress').style.width = progress + '%';
```

---

## KPI Goals (Reference)

| KPI | Current | Goal | Gap |
|-----|---------|------|-----|
| Snittkurv | 185 kr | 200 kr | +15 kr |
| Varer per ordre | 2.74 | 3.1 | +0.36 |
| Kaffe-attach | 34% | 35% | +1% |
| Rundstykke-attach | 20% | 20% | 0% |
| Google reviews/uke | ? | 15 | ? |

---

## Limitations

### Attach Rate Accuracy

**Current implementation (approximation):**
```
coffeeAttachRate = (total coffee quantity / total orders) * 100
```

**Problem:** This counts total coffee sold, not unique orders with coffee.

**Example:**
- 100 orders
- 70 coffees sold
- Current: 70% attach rate
- Reality: Could be 35 orders with 2 coffees each = 35% attach rate

**Solution (future):**
- Extend favrit-data-service to track product pairs
- Use `product_pairs` table for accurate attach rates
- Query order-level data for precise calculations

### Historical Data

Historical attach rates return `null` until favrit-data-service implements:
1. Order-level ingestion
2. Product co-occurrence analysis
3. Attach rate pre-calculation

---

## Next Steps

1. ✅ Basic KPI endpoint (done)
2. ⏳ Add to dashboard UI
3. ⏳ Extend favrit-data-service for accurate attach rates
4. ⏳ Add caching (5-minute TTL for today's data)
5. ⏳ Add trend calculation (vs yesterday, vs last week)
6. ⏳ Add Google Reviews tracking endpoint
