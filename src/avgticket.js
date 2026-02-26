/**
 * Average Ticket Goals - Snittsalg per kunde
 * Bear House Dashboard
 * 
 * XP reward: 10 XP when daily average ticket reaches the goal
 * Goals are based on top 5 best days (stretch goals)
 */

// Target average ticket per location (based on top 5 days analysis)
const AVG_TICKET_GOALS = {
    nesbyen: 210,   // Top 5 avg: 209 kr
    hemsedal: 225   // Top 5 avg: 223 kr
};

// XP reward for hitting the goal
const AVG_TICKET_XP = 10;

/**
 * Check if average ticket goal is met
 * @param {string} location - 'nesbyen' or 'hemsedal'
 * @param {number} avgTicket - Today's average ticket
 * @returns {object} - { goalMet, goal, actual, xp }
 */
function checkAvgTicketGoal(location, avgTicket) {
    const goal = AVG_TICKET_GOALS[location];
    if (!goal) {
        return { goalMet: false, goal: 0, actual: avgTicket, xp: 0 };
    }
    
    const goalMet = avgTicket >= goal;
    
    return {
        goalMet,
        goal,
        actual: avgTicket,
        xp: goalMet ? AVG_TICKET_XP : 0,
        percentOfGoal: Math.round((avgTicket / goal) * 100)
    };
}

/**
 * Get goal for a location
 */
function getAvgTicketGoal(location) {
    return AVG_TICKET_GOALS[location] || 0;
}

/**
 * Update goals (for admin adjustment)
 */
function setAvgTicketGoal(location, goal) {
    if (AVG_TICKET_GOALS.hasOwnProperty(location)) {
        AVG_TICKET_GOALS[location] = goal;
        console.log(`[AvgTicket] Updated ${location} goal to ${goal} kr`);
        return true;
    }
    return false;
}

module.exports = {
    AVG_TICKET_GOALS,
    AVG_TICKET_XP,
    checkAvgTicketGoal,
    getAvgTicketGoal,
    setAvgTicketGoal
};
