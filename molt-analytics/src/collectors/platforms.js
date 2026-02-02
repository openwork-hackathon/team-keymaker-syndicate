const axios = require('axios');
const fs = require('fs');
const path = require('path');

const SECRETS_DIR = '/root/.openclaw/secrets';

function loadCredentials(platform) {
    const filePath = path.join(SECRETS_DIR, `${platform}.json`);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return {};
}

async function fetchClawTasks() {
    const creds = loadCredentials('clawtasks');
    const apiKey = creds.api_key || (creds.credentials && creds.credentials.api_key);
    if (!apiKey) return { platform: 'ClawTasks', status: 'no_credentials' };

    try {
        const resp = await axios.get('https://clawtasks.com/api/bounties?status=open', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 10000
        });
        const bounties = Array.isArray(resp.data) ? resp.data : (resp.data.bounties || []);
        return {
            platform: 'ClawTasks',
            status: 'ok',
            open_bounties: bounties.length,
            data: bounties.slice(0, 5)
        };
    } catch (e) {
        return { platform: 'ClawTasks', status: 'error', error: e.message };
    }
}

async function fetchMoltverr() {
    const creds = loadCredentials('moltverr');
    const apiKey = creds.api_key;
    if (!apiKey) return { platform: 'Moltverr', status: 'no_credentials' };

    try {
        const resp = await axios.get('https://www.moltverr.com/api/gigs?status=open', {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            timeout: 10000
        });
        if (resp.data && resp.data.success) {
            const gigs = resp.data.gigs || [];
            const validGigs = gigs.filter(g => !['btc', 'bitcoin', 'send'].some(word => (g.title || '').toLowerCase().includes(word)));
            return {
                platform: 'Moltverr',
                status: 'ok',
                open_gigs: validGigs.length,
                data: validGigs.slice(0, 5)
            };
        }
        return { platform: 'Moltverr', status: 'error', code: resp.status };
    } catch (e) {
        return { platform: 'Moltverr', status: 'error', error: e.message };
    }
}

async function fetchMoltRoad() {
    const creds = loadCredentials('moltroad');
    const apiKey = creds.credentials && creds.credentials.api_key;
    if (!apiKey) return { platform: 'Molt Road', status: 'no_credentials' };

    try {
        const headers = { 'X-API-Key': apiKey };
        const [ordersResp, bountiesResp, balanceResp] = await Promise.all([
            axios.get('https://moltroad.com/api/v1/orders/selling', { headers, timeout: 10000 }).catch(() => ({ data: { orders: [] } })),
            axios.get('https://moltroad.com/api/v1/bounties?status=open', { headers, timeout: 10000 }).catch(() => ({ data: { bounties: [] } })),
            axios.get('https://moltroad.com/api/v1/balance', { headers, timeout: 10000 }).catch(() => ({ data: {} }))
        ]);

        return {
            platform: 'Molt Road',
            status: 'ok',
            pending_orders: (ordersResp.data.orders || []).length,
            open_bounties: (bountiesResp.data.bounties || []).length,
            balance: balanceResp.data
        };
    } catch (e) {
        return { platform: 'Molt Road', status: 'error', error: e.message };
    }
}

async function fetchOpenwork() {
    const creds = loadCredentials('openwork');
    const apiKey = creds.credentials && creds.credentials.api_key;
    if (!apiKey) return { platform: 'Openwork', status: 'no_credentials' };

    try {
        const headers = { 'Authorization': `Bearer ${apiKey}` };
        const [reviewResp, matchResp, subsResp] = await Promise.all([
            axios.get('https://www.openwork.bot/api/jobs/mine?needs_review=true', { headers, timeout: 10000 }).catch(() => ({ data: { total: 0 } })),
            axios.get('https://www.openwork.bot/api/jobs/match', { headers, timeout: 10000 }).catch(() => ({ data: { jobs: [] } })),
            axios.get('https://www.openwork.bot/api/agents/me/submissions', { headers, timeout: 10000 }).catch(() => ({ data: [] }))
        ]);

        const matchingJobs = matchResp.data.jobs || [];
        const paidJobs = matchingJobs.filter(j => (j.reward || 0) > 0);

        return {
            platform: 'Openwork',
            status: 'ok',
            needs_review: reviewResp.data.total || 0,
            matching_jobs: matchingJobs.length,
            paid_jobs: paidJobs.length,
            paid_jobs_data: paidJobs,
            my_submissions: Array.isArray(subsResp.data) ? subsResp.data.length : 0
        };
    } catch (e) {
        return { platform: 'Openwork', status: 'error', error: e.message };
    }
}

module.exports = {
    fetchClawTasks,
    fetchMoltverr,
    fetchMoltRoad,
    fetchOpenwork
};
