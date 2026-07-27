const tabDumpsHTML = `
    <!-- Dumps Tab -->
    <div id="view-dumps" class="table-wrapper" style="display:none;">
        <table id="table-dumps-target">
            <thead><tr><th>Current Date</th><th>Time</th><th>Application Server</th><th>User</th><th>Client ID</th><th>Keep</th><th>Runtime Error</th><th>Exception</th><th>Canceled Program</th><th>WP Index</th><th>Transaction ID</th></tr></thead>
            <tbody><tr><td colspan="11" class="empty-state">No runtime entries caught inside target tables.</td></tr></tbody>
        </table>
    </div>
`;

function initTabDumps(container) {
    container.insertAdjacentHTML('beforeend', tabDumpsHTML);
}

async function fetchST22ShortDumpsOnly() {
    const sel = document.getElementById('system-selector').value;
    if (!ensureCredentials(sel, () => fetchST22ShortDumpsOnly())) return;
    const res = await fetch(`${BACKEND_BASE}/dumps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify(getSystemPayload(sel))
    });
    await handleAPIError(res, sel);
    const data = await res.json();
    document.getElementById('table-dumps-target').querySelector('tbody').innerHTML =
        data.length === 0
            ? `<tr><td colspan="11" class="empty-state">No runtime entries logged inside system table space buffers.</td></tr>`
            : data.map(d => `<tr onclick="openDumpDetails('${d.datum}','${d.uzeit}','${d.ahost}','${d.uname}','${d.seqno}','${d.errid}','${d.progname}')" style="cursor:pointer;">
                <td><b>${d.datum}</b></td>
                <td><code>${d.uzeit}</code></td>
                <td>${d.ahost}</td>
                <td>${d.uname}</td>
                <td>${d.mandt || ''}</td>
                <td>${d.xhold || 'C'}</td>
                <td style="color:#b91c1c; font-weight:bold;">${d.errid || 'Unknown'}</td>
                <td></td>
                <td>${d.progname || ''}</td>
                <td>${d.wp_index || d.seqno || ''}</td>
                <td><code>${d.tid || ''}</code></td>
               </tr>`).join('');
}
