/**
 * Planday API Integration
 * Handles authentication and employee data
 */

const PLANDAY_CONFIG = {
    clientId: 'eea0dc07-83f6-4df7-9792-79b120ba7839',
    refreshToken: 'MTnGQFLsIECNhGOFEwYrNg',
    tokenUrl: 'https://id.planday.com/connect/token',
    apiBase: 'https://openapi.planday.com'
};

// Department mapping
const DEPARTMENTS = {
    16761: { name: 'Nesbyen', location: 'nesbyen' },
    16854: { name: 'Hemsedal', location: 'hemsedal' },
    16851: { name: 'Produksjon', location: 'nesbyen' },
    16852: { name: 'Bakeri Ål', location: 'al' },
    16853: { name: 'Burger Ål', location: 'al' }
};

let accessToken = null;
let tokenExpiry = 0;

/**
 * Get a valid access token (refreshes if expired)
 */
async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpiry - 60000) {
        return accessToken;
    }

    const response = await fetch(PLANDAY_CONFIG.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: PLANDAY_CONFIG.clientId,
            refresh_token: PLANDAY_CONFIG.refreshToken,
            grant_type: 'refresh_token'
        })
    });

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000);
    
    return accessToken;
}

/**
 * Make an authenticated API request
 */
async function apiRequest(endpoint) {
    const token = await getAccessToken();
    
    const response = await fetch(`${PLANDAY_CONFIG.apiBase}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-ClientId': PLANDAY_CONFIG.clientId
        }
    });

    return response.json();
}

/**
 * Get all employees
 */
async function getEmployees() {
    const data = await apiRequest('/hr/v1/employees?limit=100');
    return data.data || [];
}

/**
 * Get departments
 */
async function getDepartments() {
    const data = await apiRequest('/hr/v1/departments');
    return data.data || [];
}

/**
 * Get shifts for today
 */
async function getTodayShifts() {
    const today = new Date().toISOString().split('T')[0];
    const data = await apiRequest(`/scheduling/v1/shifts?from=${today}&to=${today}`);
    return data.data || [];
}

/**
 * Get shifts for a date range, optionally filtered by department
 */
async function getShifts(fromDate, toDate, departmentId = null) {
    let endpoint = `/scheduling/v1/shifts?from=${fromDate}&to=${toDate}&limit=1000`;
    if (departmentId) {
        endpoint += `&departmentId=${departmentId}`;
    }
    const data = await apiRequest(endpoint);
    return data.data || [];
}

/**
 * Get employee's primary location based on departments
 */
function getEmployeeLocation(employee) {
    const depts = employee.departments || [];
    
    // Priority: Hemsedal > Nesbyen > Ål
    if (depts.includes(16854)) return 'hemsedal';
    if (depts.includes(16761)) return 'nesbyen';
    if (depts.includes(16852) || depts.includes(16853)) return 'al';
    
    return 'nesbyen'; // Default
}

/**
 * Process employees into a user-friendly format
 */
function processEmployees(employees) {
    return employees.map(emp => ({
        id: emp.id,
        firstName: emp.firstName?.trim() || '',
        lastName: emp.lastName || '',
        fullName: `${emp.firstName?.trim() || ''} ${emp.lastName || ''}`.trim(),
        username: (emp.firstName?.trim() || '').toLowerCase().replace(/\s+/g, ''),
        email: emp.email || '',
        phone: emp.cellPhone || '',
        location: getEmployeeLocation(emp),
        departments: emp.departments || [],
        hiredDate: emp.hiredDate,
        // Password will be set from birthdate or manually
        password: null
    }));
}

module.exports = {
    PLANDAY_CONFIG,
    DEPARTMENTS,
    getAccessToken,
    getEmployees,
    getDepartments,
    getTodayShifts,
    getShifts,
    getEmployeeLocation,
    processEmployees
};
