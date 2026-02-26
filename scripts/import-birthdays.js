#!/usr/bin/env node
/**
 * Import birthdays from CSV file
 * Usage: node import-birthdays.js birthdays.csv
 * 
 * CSV format (from Planday export):
 * firstName,lastName,birthDate
 * Agnieszka,Nawrot,1989-03-15
 * Martin,Gaze,1985-03-24
 * 
 * Or simpler format:
 * name,birthday
 * Agnieszka,1503
 * Martin,2403
 */

const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function parseCSV(content) {
    const lines = content.trim().split('\n');
    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        header.forEach((h, i) => obj[h] = values[i]);
        return obj;
    });
}

function extractDDMM(dateStr) {
    // Handle various formats
    if (!dateStr) return null;
    
    // Already DDMM format (4 digits)
    if (/^\d{4}$/.test(dateStr)) {
        return dateStr;
    }
    
    // ISO date: 1989-03-15 or 1989/03/15
    const isoMatch = dateStr.match(/\d{4}[-/](\d{2})[-/](\d{2})/);
    if (isoMatch) {
        return isoMatch[2] + isoMatch[1]; // DDMM
    }
    
    // European date: 15-03-1989 or 15/03/1989
    const euMatch = dateStr.match(/(\d{2})[-/](\d{2})[-/]\d{4}/);
    if (euMatch) {
        return euMatch[1] + euMatch[2]; // DDMM
    }
    
    // Just day and month: 15-03 or 15/03
    const dmMatch = dateStr.match(/(\d{2})[-/](\d{2})/);
    if (dmMatch) {
        return dmMatch[1] + dmMatch[2];
    }
    
    return null;
}

function findUserByName(users, firstName, lastName, fullName) {
    firstName = (firstName || '').toLowerCase().trim();
    lastName = (lastName || '').toLowerCase().trim();
    fullName = (fullName || '').toLowerCase().trim();
    
    return users.find(u => {
        const uFirst = (u.firstName || '').toLowerCase();
        const uLast = (u.lastName || '').toLowerCase();
        const uFull = (u.fullName || '').toLowerCase();
        
        // Exact match on first + last name
        if (uFirst === firstName && uLast === lastName) return true;
        
        // Match on full name
        if (uFull === fullName) return true;
        
        // Match on just first name (for simple CSV)
        if (firstName && uFirst === firstName) return true;
        
        return false;
    });
}

function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
Bear House Birthday Importer 🎂

Usage: node import-birthdays.js <csv-file>

CSV format options:

1. Full format (Planday export):
   firstName,lastName,birthDate
   Agnieszka,Nawrot,1989-03-15
   Martin,Gaze,1985-03-24

2. Simple format:
   name,birthday
   Agnieszka,1503
   Martin,2403

3. With full name:
   fullName,birthDate
   Agnieszka Nawrot,15-03-1989
   Martin Stuart Gaze,24-03-1985
`);
        process.exit(0);
    }

    const csvFile = args[0];
    
    if (!fs.existsSync(csvFile)) {
        console.error(`Error: File not found: ${csvFile}`);
        process.exit(1);
    }

    const content = fs.readFileSync(csvFile, 'utf8');
    const rows = parseCSV(content);
    
    console.log(`📄 Read ${rows.length} rows from CSV`);
    
    const users = loadUsers();
    console.log(`👥 Loaded ${users.length} existing users`);
    
    let updated = 0;
    let notFound = 0;
    let noDate = 0;
    
    for (const row of rows) {
        // Try to find name fields
        const firstName = row.firstname || row.first_name || row.fornavn || '';
        const lastName = row.lastname || row.last_name || row.etternavn || '';
        const fullName = row.fullname || row.full_name || row.navn || row.name || '';
        const birthDate = row.birthdate || row.birth_date || row.birthday || row.bursdag || row.fodselsdato || '';
        
        const ddmm = extractDDMM(birthDate);
        
        if (!ddmm) {
            console.log(`⚠️  No valid date for: ${firstName || fullName}`);
            noDate++;
            continue;
        }
        
        const user = findUserByName(users, firstName, lastName, fullName);
        
        if (user) {
            user.password = ddmm;
            user.birthdaySet = new Date().toISOString();
            console.log(`✅ ${user.fullName} → ${ddmm}`);
            updated++;
        } else {
            console.log(`❌ User not found: ${firstName} ${lastName} (${fullName})`);
            notFound++;
        }
    }
    
    saveUsers(users);
    
    console.log(`
📊 Import complete:
   ✅ Updated: ${updated}
   ❌ Not found: ${notFound}
   ⚠️  No date: ${noDate}
`);
}

main();
