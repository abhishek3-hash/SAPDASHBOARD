const tabSu01HTML = `
    <!-- SU01 Tab -->
    <div id="view-su01" style="display:none; flex-direction:column; width:100%; height: 100%;">
        <input type="text" id="sap-user-search-input" oninput="filterSAPUsersList()" placeholder="Fuzzy filter by Username ID..." class="search-input">
        <div class="table-wrapper" style="max-height: 60vh; overflow-y: auto; border-bottom: 1px solid #e2e8f0; position: relative;">
            <table id="table-sap-users" style="margin-bottom: 0;">
                <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 10;"><tr><th>SAP Username ID</th><th>First Name</th><th>Last Name</th><th>Maintenance Actions</th></tr></thead>
                <tbody><tr><td colspan="4" class="empty-state">Select an active landscape profile to load the SU01 user list.</td></tr></tbody>
            </table>
        </div>
    </div>
`;

function initTabSu01(container) {
    container.insertAdjacentHTML('beforeend', tabSu01HTML);
}

let cachedSAPUsersList = [];

async function fetchSAPSystemUsersList(silent = false) {
    const sel = document.getElementById('system-selector').value;
    if (!ensureCredentials(sel, () => fetchSAPSystemUsersList(silent))) return;
    const res = await fetch(`${BACKEND_BASE}/sap-users/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify(getSystemPayload(sel))
    });
    await handleAPIError(res, sel);
    const data = await res.json();
    cachedSAPUsersList = data.users || [];
    renderSAPUsersTable(cachedSAPUsersList);
}

function renderSAPUsersTable(arr) {
    document.querySelector("#table-sap-users tbody").innerHTML =
        arr.length === 0
            ? `<tr><td colspan="4" class="empty-state">No matching account rows parsed from user directory.</td></tr>`
            : arr.map(u => `<tr><td><b style="color:var(--sap-accent);">${u.USERNAME}</b></td><td>${u.FIRSTNAME||'N/A'}</td><td>${u.LASTNAME||'N/A'}</td><td><div class="mgmt-actions"><button onclick="executeBAPIUserAction('lock','${u.USERNAME}')">Lock</button><button onclick="executeBAPIUserAction('unlock','${u.USERNAME}')" style="margin-left:4px;">Unlock</button></div></td></tr>`).join('');
}

function filterSAPUsersList() {
    const kw = document.getElementById('sap-user-search-input').value.trim().toLowerCase();
    renderSAPUsersTable(cachedSAPUsersList.filter(u => (u.USERNAME || "").toLowerCase().includes(kw)));
}

async function executeBAPIUserAction(act, usr) {
    const sel = document.getElementById('system-selector').value;
    if (!ensureCredentials(sel, () => executeBAPIUserAction(act, usr))) return;
    const res = await fetch(`${BACKEND_BASE}/sap-users/${act}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ connection: getSystemPayload(sel), target_sap_user: usr })
    });
    await handleAPIError(res, sel);
    const data = await res.json();
    alert(data.sap_log?.MESSAGE || "BAPI Sequence complete.");
    fetchSAPSystemUsersList();
}
