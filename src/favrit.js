/**
 * Favrit POS Integration for Bear House Dashboard
 * Real-time sales data from Favrit kassesystem
 */

const fs = require('fs');
const path = require('path');

// Favrit API Config
const FAVRIT_CONFIG = {
    clientId: '41rs3j3jpsvu6sn1lrdqo9ba1o',
    secretId: 'ma2ea8mkngesknm1lcehhu0mgh8okl29e6cjeleebrrncd580de',
    authUrl: 'https://accounting-api-auth.favrit.com/oauth2/token',
    apiBase: 'https://favrit.com/ws/accounting-api-service'
};

// Location IDs
const LOCATIONS = {
    nesbyen: 113593088,
    hemsedal: 248457994,
    hemsedal_takeaway: 252780678,
    al_bakeri: 114571637,
    al_bearhouse: 146824761,
    nesbyen_pizzeria: 136213164
};

// Token cache
let tokenCache = {
    accessToken: null,
    expiresAt: 0
};

/**
 * Get access token (with caching)
 */
async function getAccessToken() {
    // Return cached token if still valid (with 5 min buffer)
    if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 300000) {
        return tokenCache.accessToken;
    }

    const authString = Buffer.from(`${FAVRIT_CONFIG.clientId}:${FAVRIT_CONFIG.secretId}`).toString('base64');

    const response = await fetch(FAVRIT_CONFIG.authUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials&scope=prod/user prod/accounting prod/transaction'
    });

    const data = await response.json();

    if (data.access_token) {
        tokenCache.accessToken = data.access_token;
        tokenCache.expiresAt = Date.now() + (data.expires_in * 1000);
        console.log('[Favrit] Token refreshed, expires in', data.expires_in, 'seconds');
    }

    return tokenCache.accessToken;
}

/**
 * Get locations
 */
async function getLocations() {
    const token = await getAccessToken();
    
    const response = await fetch(`${FAVRIT_CONFIG.apiBase}/v1/api/user/locations`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();
    return data.data?.locations || [];
}

/**
 * Get order lines for a location and date range
 * @param {number} locationId - Favrit location ID
 * @param {string} fromDate - ISO date string (UTC)
 * @param {string} toDate - ISO date string (UTC)
 */
async function getOrderLines(locationId, fromDate, toDate) {
    const token = await getAccessToken();
    
    const url = `${FAVRIT_CONFIG.apiBase}/api/orderlines/v3/${locationId}?from-date=${fromDate}&to-date=${toDate}`;
    
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const csvText = await response.text();
    return parseOrderLinesCSV(csvText);
}

/**
 * Parse CSV order lines to JSON
 */
function parseOrderLinesCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(';');
    const orders = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(';');
        const order = {};
        
        headers.forEach((header, index) => {
            order[header] = values[index] || '';
        });

        // Convert numeric fields
        order.quantity = parseFloat(order.quantity) || 0;
        order.amount_with_vat = parseFloat(order.amount_with_vat) || 0;
        order.amount_without_vat = parseFloat(order.amount_without_vat) || 0;
        order.vat_percentage = parseFloat(order.vat_percentage) || 0;

        orders.push(order);
    }

    return orders;
}

/**
 * Get today's sales summary for a location
 */
async function getTodaySales(locationName) {
    const locationId = LOCATIONS[locationName];
    if (!locationId) {
        throw new Error(`Unknown location: ${locationName}`);
    }

    // Today's date range in UTC
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const fromDate = startOfDay.toISOString().replace('Z', '');
    const toDate = now.toISOString().replace('Z', '');

    const orderLines = await getOrderLines(locationId, fromDate, toDate);

    // Calculate totals (only count ORDER_LINE, not OPTIONS)
    const mainOrders = orderLines.filter(o => o.order_line_type === 'ORDER_LINE');
    
    const totalSales = mainOrders.reduce((sum, o) => sum + (o.amount_with_vat * o.quantity), 0);
    const totalItems = mainOrders.reduce((sum, o) => sum + o.quantity, 0);
    const uniqueOrders = new Set(mainOrders.map(o => o.order_reference)).size;

    // Group by product for bestsellers
    const productSales = {};
    mainOrders.forEach(o => {
        const name = o.item_name.split(' (')[0]; // Remove variant info
        if (!productSales[name]) {
            productSales[name] = { name, quantity: 0, revenue: 0 };
        }
        productSales[name].quantity += o.quantity;
        productSales[name].revenue += o.amount_with_vat * o.quantity;
    });

    const bestsellers = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

    // Hourly breakdown
    const hourlyData = {};
    mainOrders.forEach(o => {
        const hour = new Date(o.order_line_created_utc + 'Z').getUTCHours();
        if (!hourlyData[hour]) {
            hourlyData[hour] = { sales: 0, orders: 0 };
        }
        hourlyData[hour].sales += o.amount_with_vat * o.quantity;
        hourlyData[hour].orders++;
    });

    // Rolling 60-minute sales (last 60 minutes, not fixed hour)
    const sixtyMinutesAgo = new Date(now.getTime() - 60 * 60 * 1000);
    let last60MinSales = 0;
    
    mainOrders.forEach(o => {
        const orderTime = new Date(o.order_line_created_utc + 'Z');
        if (orderTime >= sixtyMinutesAgo && orderTime <= now) {
            last60MinSales += o.amount_with_vat * o.quantity;
        }
    });

    return {
        location: locationName,
        locationId,
        date: now.toISOString().split('T')[0],
        timestamp: Date.now(),
        
        summary: {
            totalSales: Math.round(totalSales),
            totalItems,
            uniqueOrders,
            averageTicket: uniqueOrders > 0 ? Math.round(totalSales / uniqueOrders) : 0
        },

        currentHour: {
            hour: now.getHours(),
            sales: Math.round(last60MinSales)
        },

        bestsellers,
        hourlyData,

        raw: {
            orderCount: orderLines.length,
            firstOrder: orderLines[0]?.order_line_created_utc,
            lastOrder: orderLines[orderLines.length - 1]?.order_line_created_utc
        }
    };
}

/**
 * Get combined sales for all main locations
 */
async function getAllLocationsSales() {
    const mainLocations = ['nesbyen', 'hemsedal'];
    const results = {};

    for (const loc of mainLocations) {
        try {
            results[loc] = await getTodaySales(loc);
        } catch (error) {
            console.error(`[Favrit] Error fetching ${loc}:`, error.message);
            results[loc] = { error: error.message };
        }
    }

    return results;
}

/**
 * Get settlements for a location
 */
async function getSettlements(locationId) {
    const token = await getAccessToken();
    
    const response = await fetch(
        `${FAVRIT_CONFIG.apiBase}/v1/api/accounting/locations/${locationId}/settlements`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );

    return response.json();
}

module.exports = {
    getAccessToken,
    getLocations,
    getOrderLines,
    getTodaySales,
    getAllLocationsSales,
    getSettlements,
    LOCATIONS
};
