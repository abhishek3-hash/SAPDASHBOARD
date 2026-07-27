const tabSm50HTML = `
    <!-- SM50 Tab -->
    <div id="view-sm50" style="display:none; flex-direction:column; gap:1.5rem; width:100%;">
        <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:1rem;">
            <div class="card" style="padding:1rem;"><div style="font-size:0.75rem;font-weight:700;color:var(--sap-text-muted);">DIALOG (DIA)</div><div id="wp-dia-stat" style="font-size:1.5rem;font-weight:800;margin-top:0.25rem;">0 / 0 Active</div></div>
            <div class="card" style="padding:1rem;"><div style="font-size:0.75rem;font-weight:700;color:var(--sap-text-muted);">BACKGROUND (BTC)</div><div id="wp-btc-stat" style="font-size:1.5rem;font-weight:800;margin-top:0.25rem;">0 / 0 Active</div></div>
            <div class="card" style="padding:1rem;"><div style="font-size:0.75rem;font-weight:700;color:var(--sap-text-muted);">UPDATE (UPD)</div><div id="wp-upd-stat" style="font-size:1.5rem;font-weight:800;margin-top:0.25rem;">0 / 0 Active</div></div>
            <div class="card" style="padding:1rem;"><div style="font-size:0.75rem;font-weight:700;color:var(--sap-text-muted);">SPOOL (SPO)</div><div id="wp-spo-stat" style="font-size:1.5rem;font-weight:800;margin-top:0.25rem;">0 / 0 Active</div></div>
            <div class="card" style="padding:1rem;"><div style="font-size:0.75rem;font-weight:700;color:var(--sap-text-muted);">UPDATE TASK 2 (UP2)</div><div id="wp-up2-stat" style="font-size:1.5rem;font-weight:800;margin-top:0.25rem;">0 / 0 Active</div></div>
        </div>
        <div class="table-wrapper" style="max-height: 50vh; overflow-y: auto; border-bottom: 1px solid #e2e8f0; position: relative;">
            <table id="table-sm50-current" style="margin-bottom: 0;">
                <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 10;">
                    <tr>
                        <th>Numb.</th>
                        <th>Type</th>
                        <th>Process ID</th>
                        <th>WP Status</th>
                        <th>"On Hold"</th>
                        <th>Failur...</th>
                        <th>LockedSem.</th>
                        <th>Requ.Sem.</th>
                        <th>CPU Time</th>
                        <th>Time</th>
                        <th>Priority</th>
                        <th>Name of Program Being Executed by the Work Process</th>
                        <th>Cli...</th>
                        <th>User ID</th>
                    </tr>
                </thead>
                <tbody><tr><td colspan="14" class="empty-state">Select system profile parameters above to fetch tracking frames.</td></tr></tbody>
            </table>
        </div>
    </div>
`;

function initTabSm50(container) {
    container.insertAdjacentHTML('beforeend', tabSm50HTML);
}

async function syncSM50EngineData() {
    const sel = document.getElementById('system-selector').value;
    if (!ensureCredentials(sel, () => syncSM50EngineData())) return;
    const res = await fetch(`${BACKEND_BASE}/sap-monitoring/sm50`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
        body: JSON.stringify({ connection: getSystemPayload(sel) })
    });
    await handleAPIError(res, sel);
    const data = await res.json();
    
    const cu = data.current_utilization || { totals: {}, active: {}, processes: [] };
    
    document.getElementById('wp-dia-stat').innerText = `${cu.active.DIA || 0} / ${cu.totals.DIA || 0} Active`;
    document.getElementById('wp-btc-stat').innerText = `${cu.active.BTC || 0} / ${cu.totals.BTC || 0} Active`;
    document.getElementById('wp-upd-stat').innerText = `${cu.active.UPD || 0} / ${cu.totals.UPD || 0} Active`;
    document.getElementById('wp-spo-stat').innerText = `${cu.active.SPO || 0} / ${cu.totals.SPO || 0} Active`;
    document.getElementById('wp-up2-stat').innerText = `${cu.active.UP2 || 0} / ${cu.totals.UP2 || 0} Active`;
    
    document.querySelector("#table-sm50-current tbody").innerHTML =
        (!cu.processes || cu.processes.length === 0)
            ? `<tr><td colspan="14" class="empty-state">No active workprocesses detected.</td></tr>`
            : cu.processes.map(p => `<tr>
                <td style="text-align:right;">${p.no}</td>
                <td>${p.type}</td>
                <td style="text-align:right;">${p.pid}</td>
                <td>${p.status}</td>
                <td>${p.on_hold}</td>
                <td>${p.failure}</td>
                <td>${p.locked_sem}</td>
                <td>${p.requ_sem}</td>
                <td>${p.cpu_time}</td>
                <td>${p.time}</td>
                <td>${p.priority}</td>
                <td>${p.report}</td>
                <td>${p.client}</td>
                <td>${p.user}</td>
              </tr>`).join('');
}
