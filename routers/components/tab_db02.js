const tabDb02HTML = `
    <!-- DB02 Tab -->
    <div id="view-db02" style="display:none; flex-direction:column; gap:1.5rem; width:100%;">
        <div style="display:flex; border-bottom:2px solid rgba(0,0,0,0.05); gap:1rem; overflow-x:auto;">
            <div id="db02-subtab-tables" class="nav-item active" style="padding:0.25rem 0.75rem; cursor:pointer; background:var(--sap-accent); color:white; border-radius:6px 6px 0 0;" onclick="switchDB02SubTab('tables')">Top Large Tables</div>
            <div id="db02-subtab-history" class="nav-item" style="padding:0.25rem 0.75rem; cursor:pointer; border-radius:6px 6px 0 0;" onclick="switchDB02SubTab('history')">Growth History</div>
            <div id="db02-subtab-indexes" class="nav-item" style="padding:0.25rem 0.75rem; cursor:pointer; border-radius:6px 6px 0 0;" onclick="switchDB02SubTab('indexes')">Missing Indexes</div>
            <div id="db02-subtab-memory" class="nav-item" style="padding:0.25rem 0.75rem; cursor:pointer; border-radius:6px 6px 0 0;" onclick="switchDB02SubTab('memory')">Database Memory</div>
            <div id="db02-subtab-merges" class="nav-item" style="padding:0.25rem 0.75rem; cursor:pointer; border-radius:6px 6px 0 0;" onclick="switchDB02SubTab('merges')">Maintenance</div>
        </div>

        <div id="db02-content-tables" class="table-wrapper" style="display:flex;">
            <table id="table-db02-tables">
                <thead><tr><th>Schema</th><th>Table Name</th><th>Record Count</th><th>Size (GB)</th><th>Table Class</th></tr></thead>
                <tbody><tr><td colspan="5" class="empty-state">No tables monitored in selected system.</td></tr></tbody>
            </table>
        </div>
        <div id="db02-content-history" class="table-wrapper" style="display:none;">
            <table id="table-db02-history">
                <thead><tr><th>Date Snapshot</th><th>Database Size (GB)</th><th>Free Space (GB)</th><th>Growth Rate (%)</th></tr></thead>
                <tbody><tr><td colspan="4" class="empty-state">No historical allocations loaded.</td></tr></tbody>
            </table>
        </div>
        <div id="db02-content-indexes" class="table-wrapper" style="display:none;">
            <table id="table-db02-indexes">
                <thead><tr><th>Schema</th><th>Table Name</th><th>Proposed Index Fields</th><th>Impact Score</th></tr></thead>
                <tbody><tr><td colspan="4" class="empty-state">No missing indexes reported by optimizer.</td></tr></tbody>
            </table>
        </div>
        <div id="db02-content-memory" class="table-wrapper" style="display:none;">
            <table id="table-db02-memory">
                <thead><tr><th>Host</th><th>Service</th><th>Allocation Limit (GB)</th><th>Used Memory (GB)</th><th>Peak Memory (GB)</th></tr></thead>
                <tbody><tr><td colspan="5" class="empty-state">Memory structures unreadable.</td></tr></tbody>
            </table>
        </div>
        <div id="db02-content-merges" class="table-wrapper" style="display:none;">
            <table id="table-db02-merges">
                <thead><tr><th>Timestamp</th><th>Table Name</th><th>Type</th><th>Duration (s)</th><th>Merged Rows</th></tr></thead>
                <tbody><tr><td colspan="5" class="empty-state">No delta merge activity found.</td></tr></tbody>
            </table>
        </div>
    </div>
`;

function initTabDb02(container) {
    container.insertAdjacentHTML('beforeend', tabDb02HTML);
}

async function syncDB02StorageData() {
    const sel = document.getElementById('system-selector').value;
    if (!ensureCredentials(sel, () => syncDB02StorageData())) return;
    const res = await fetch(`${BACKEND_BASE}/sap-monitoring/db02`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ connection: getSystemPayload(sel) })
    });
    await handleAPIError(res, sel);
    const data = await res.json();
    
    // Dynamically rename tabs based on database engine
    const isHana = data.summary && data.summary.db_type && data.summary.db_type.includes("HANA");
    const isOracle = data.summary && data.summary.db_type && data.summary.db_type.includes("ORA");
    document.getElementById("db02-subtab-memory").innerText = isHana ? "HANA Memory" : (isOracle ? "Oracle SGA/PGA" : "Database Memory");
    document.getElementById("db02-subtab-merges").innerText = isHana ? "Delta Merges" : "Table Reorgs/Maintenance";
    
    document.querySelector("#table-db02-tables tbody").innerHTML = (!data.top_tables || data.top_tables.length===0) 
        ? `<tr><td colspan="5" class="empty-state">No tables monitored.</td></tr>`
        : data.top_tables.map(t => `<tr><td>N/A</td><td><b>${t.name}</b></td><td>${parseInt(t.rows).toLocaleString()}</td><td>${(t.size_mb/1024).toFixed(2)}</td><td>${t.type}</td></tr>`).join('');
        
    document.querySelector("#table-db02-history tbody").innerHTML = (!data.history || data.history.length===0) 
        ? `<tr><td colspan="4" class="empty-state">No historical data.</td></tr>`
        : data.history.map(h => `<tr><td>${h.period}</td><td>${h.used_gb}</td><td>${h.free_gb}</td><td style="color:#10b981;font-weight:bold;">N/A</td></tr>`).join('');
        
    document.querySelector("#table-db02-indexes tbody").innerHTML = (!data.indexes || data.indexes.length===0) 
        ? `<tr><td colspan="4" class="empty-state">No missing indexes reported.</td></tr>`
        : data.indexes.map(i => `<tr><td>N/A</td><td><b>${i.table_name}</b></td><td><code>${i.index_name}</code></td><td><span style="background:#fef08a;padding:2px 6px;border-radius:4px;color:#854d0e;">${i.status}</span></td></tr>`).join('');
        
    const mem = data.hana_memory;
    document.querySelector("#table-db02-memory tbody").innerHTML = (!mem) 
        ? `<tr><td colspan="5" class="empty-state">Memory unreadable.</td></tr>`
        : `<tr><td>${data.summary ? data.summary.db_type : 'N/A'}</td><td>indexserver</td><td>${mem.resident_gb || 'N/A'}</td><td>${mem.used_gb || 0}</td><td>${((mem.used_gb || 0) + (mem.heap_gb || 0)).toFixed(2)}</td></tr>`;
        
    document.querySelector("#table-db02-merges tbody").innerHTML = (!data.delta_merges || data.delta_merges.length===0) 
        ? `<tr><td colspan="5" class="empty-state">No delta merge activity.</td></tr>`
        : data.delta_merges.map(d => `<tr><td>${d.START_TIME}</td><td><b>${d.TABLE_NAME}</b></td><td>${d.TYPE}</td><td>${d.DURATION_S}</td><td>${parseInt(d.MERGED_ROWS).toLocaleString()}</td></tr>`).join('');
}
