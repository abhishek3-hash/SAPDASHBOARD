const tabSu53HTML = `
    <!-- SU53 Tab -->
    <div id="view-su53" style="display:none; flex-direction:column; gap:1.25rem; width:100%;">
        <div style="display:flex; align-items:center; gap:0.65rem;">
            <input type="text" id="su53-user-input" placeholder="Enter SAP Username to investigate authorization logs..." class="search-input" style="margin-bottom:0; flex:1;">
            <button class="primary" onclick="fetchSU53AuthorizationReport()">Audit Log Buffer</button>
        </div>
        <div class="table-wrapper">
            <table id="table-su53-report">
                <thead><tr><th>Authorization Object</th><th>Technical Field Name</th><th>Checked Value Parameter</th></tr></thead>
                <tbody><tr><td colspan="3" class="empty-state">Input target operator ID and trigger authorization audit trace strings.</td></tr></tbody>
            </table>
        </div>
    </div>
`;

function initTabSu53(container) {
    container.insertAdjacentHTML('beforeend', tabSu53HTML);
}

async function fetchSU53AuthorizationReport() {
    const sel  = document.getElementById('system-selector').value;
    if (!ensureCredentials(sel, () => fetchSU53AuthorizationReport())) return;
    const user = document.getElementById('su53-user-input').value.trim();
    if (!user) { alert("Please input a target user."); return; }

    const res = await fetch(`${BACKEND_BASE}/sap-users/su53`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ connection: getSystemPayload(sel), target_sap_user: user })
    });
    await handleAPIError(res, sel);
    const data = await res.json();
    document.querySelector("#table-su53-report tbody").innerHTML =
        (!data.report || data.report.length === 0)
            ? `<tr><td colspan="3" class="empty-state">No recent authorization failures found for ${user}.</td></tr>`
            : data.report.map(r => `<tr><td><b>${r.OBJCT}</b></td><td>${r.FIELD}</td><td><code>${r.VALUE}</code></td></tr>`).join('');
}
