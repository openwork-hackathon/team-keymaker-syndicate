const db = require('../db');

function getStats() {
    const totalAgents = db.get('SELECT COUNT(*) as count FROM agents').count;
    const platformStats = db.query('SELECT * FROM platform_stats ORDER BY collected_at DESC LIMIT 4');
    
    // Aggregates for 24h
    const volume24h = db.get('SELECT SUM(volume_24h) as total FROM platform_stats WHERE collected_at > datetime("now", "-1 day")').total || 0;
    const transactions24h = db.get('SELECT SUM(transactions_24h) as total FROM platform_stats WHERE collected_at > datetime("now", "-1 day")').total || 0;

    const topAgents = db.query('SELECT * FROM agents ORDER BY total_earned DESC LIMIT 5');
    
    return {
        summary: {
            agents_active: totalAgents,
            volume_24h: volume24h,
            transactions_24h: transactions24h
        },
        platforms: platformStats,
        top_agents: topAgents
    };
}

module.exports = {
    getStats
};
