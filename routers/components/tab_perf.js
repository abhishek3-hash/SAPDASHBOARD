const tabPerfHTML = `
    <!-- Performance Tab -->
    <div id="view-perf" class="table-wrapper">
        <table id="table-perf-target">
            <thead><tr><th>Instance App Server Name</th><th>Host Machine ID</th><th>Dispatcher Service</th><th>Message Flags</th></tr></thead>
            <tbody><tr><td colspan="4" class="empty-state">Select system profile parameters above to fetch tracking frames.</td></tr></tbody>
        </table>
    </div>
`;

function initTabPerf(container) {
    container.insertAdjacentHTML('beforeend', tabPerfHTML);
}

async function fetchSystemMetrics() {
    const sel = document.getElementById('system-selector').value;
    if (!ensureCredentials(sel, () => fetchSystemMetrics())) return;
    const tag = document.getElementById('sap-status-tag');
    tag.className = "status-indicator status-sync";
    tag.title = "Syncing...";
    tag.innerText = "";
    tag.style.backgroundColor = ""; // reset inline style

    const payload = getSystemPayload(sel);

    try {
        const pRes = await fetch(`${BACKEND_BASE}/performance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
            body: JSON.stringify(payload)
        });
        await handleAPIError(pRes, sel);
        const pData = await pRes.json();
        document.getElementById('sap-instances-count').innerText = pData.active_servers?.length || 0;
        document.getElementById('table-perf-target').querySelector('tbody').innerHTML =
            (pData.active_servers || []).map(s => `<tr><td><b>${s.NAME}</b></td><td>${s.HOST}</td><td>${s.SERV}</td><td>${s.MSGTYPES}</td></tr>`).join('');

        const dRes = await fetch(`${BACKEND_BASE}/dumps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
            body: JSON.stringify(payload)
        });
        await handleAPIError(dRes, sel);
        const dData = await dRes.json();
        document.getElementById('sap-dumps-count').innerText = dData.length;

        tag.className = "status-indicator status-good";
        tag.title = "Connected";
        tag.innerText = "";
        switchTab(activeTab);
    } catch {
        tag.className = "status-indicator status-bad";
        tag.title = "Disconnected";
        tag.innerText = "";
    }
}
