const tabTransportHTML = `
    <!-- Transport Copy Utility Tab -->
    <div id="view-transport" style="display:none; flex-direction:column; gap:1.25rem; width:100%; flex:1; min-height:0; overflow:hidden;">

        <!-- Header -->
        <div style="display:flex; align-items:center; gap:0.75rem; padding-bottom:0.5rem; border-bottom:1px solid var(--sap-border);">
            <div style="width:36px;height:36px;background:linear-gradient(135deg,#0a6ed1,#054a91);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i data-lucide="copy" style="width:18px;height:18px;color:white;"></i>
            </div>
            <div>
                <div style="font-size:1rem;font-weight:700;color:var(--sap-text);">Transport Copy Utility</div>
                <div style="font-size:0.72rem;color:var(--sap-text-muted);">Copy cofiles &amp; data files between SAP transport directories via SSH/SCP</div>
            </div>
        </div>

        <!-- Two-column layout: form left, status right -->
        <div style="display:grid;grid-template-columns:340px 1fr;gap:1.25rem;flex:1;min-height:0;overflow:hidden;">

            <!-- LEFT: Input Form (scrollable independently if content overflows) -->
            <div class="card" style="padding:1.25rem;display:flex;flex-direction:column;gap:1rem;overflow-y:auto;">
                <div style="font-size:0.8rem;font-weight:700;color:var(--sap-text-muted);letter-spacing:0.05em;text-transform:uppercase;">Transport Parameters</div>

                <div class="form-group">
                    <label style="font-size:0.75rem;font-weight:600;color:var(--sap-text-muted);">Transport Request #</label>
                    <input id="tp-trkorr" type="text" placeholder="e.g. EH8K900319" style="font-family:monospace;text-transform:uppercase;"
                        oninput="this.value=this.value.toUpperCase(); tpDeriveSID();">
                    <div id="tp-sid-badge" style="display:none;margin-top:0.35rem;font-size:0.72rem;color:#0a6ed1;font-weight:600;">
                        <i data-lucide="tag" style="width:11px;height:11px;"></i>
                        SID: <span id="tp-sid-val"></span> &nbsp;|&nbsp; Cofile: <span id="tp-cofile-val"></span> &nbsp;|&nbsp; Data: <span id="tp-datafile-val"></span>
                    </div>
                </div>

                <div class="form-group">
                    <label style="font-size:0.75rem;font-weight:600;color:var(--sap-text-muted);">Source Host</label>
                    <div style="display:flex;gap:0.5rem;">
                        <input id="tp-src-host" type="text" placeholder="SSH alias, e.g. S22" style="flex:1;">
                        <button onclick="tpValidateHost('src')" id="btn-validate-src"
                            style="padding:0.4rem 0.6rem;font-size:0.72rem;white-space:nowrap;background:rgba(10,110,209,0.1);color:#0a6ed1;border:1px solid rgba(10,110,209,0.25);border-radius:6px;cursor:pointer;">
                            <i data-lucide="plug" style="width:12px;height:12px;"></i> Test
                        </button>
                    </div>
                    <div id="tp-src-status" style="font-size:0.72rem;margin-top:0.3rem;display:none;"></div>
                </div>

                <div class="form-group">
                    <label style="font-size:0.75rem;font-weight:600;color:var(--sap-text-muted);">Target Host(s) <span style="font-weight:400;">(comma-separated)</span></label>
                    <input id="tp-tgt-hosts" type="text" placeholder="e.g. S4H, S21, EH8">
                </div>

                <div class="form-group">
                    <label style="font-size:0.75rem;font-weight:600;color:var(--sap-text-muted);">Base Transport Directory</label>
                    <input id="tp-base-dir" type="text" value="/usr/sap/trans">
                </div>

                <details style="cursor:pointer;">
                    <summary style="font-size:0.75rem;font-weight:600;color:var(--sap-text-muted);user-select:none;">
                        Local Mount Hosts (Windows/SMB) — optional
                    </summary>
                    <div style="margin-top:0.6rem;">
                        <label style="font-size:0.72rem;color:var(--sap-text-muted);">JSON map of host → mount path</label>
                        <textarea id="tp-local-mounts" rows="2"
                            placeholder='{"EH8": "/Volumes/trans"}'
                            style="width:100%;font-family:monospace;font-size:0.75rem;padding:0.5rem;border:1px solid var(--sap-border);border-radius:6px;background:rgba(255,255,255,0.6);resize:vertical;margin-top:0.35rem;"></textarea>
                    </div>
                </details>

                <details style="cursor:pointer;" id="tp-smb-details">
                    <summary style="font-size:0.75rem;font-weight:600;color:#0a6ed1;user-select:none;display:flex;align-items:center;gap:0.3rem;">
                        <i data-lucide="hard-drive" style="width:13px;height:13px;"></i> SMB Auto-Mount Control &amp; Saved Profiles
                    </summary>
                    <div style="margin-top:0.6rem;display:flex;flex-direction:column;gap:0.5rem;background:rgba(10,110,209,0.04);padding:0.75rem;border-radius:8px;border:1px solid rgba(10,110,209,0.15);">
                        <div style="font-size:0.72rem;color:var(--sap-text-muted);">Save &amp; auto-mount SMB shares (e.g. EH8):</div>
                        
                        <!-- Saved Profiles Selection Dropdown -->
                        <div style="display:flex;gap:0.4rem;align-items:center;">
                            <select id="smb-profile-select" onchange="tpLoadSMBProfile()" style="flex:1;font-size:0.75rem;padding:0.4rem;border-radius:6px;border:1px solid var(--sap-border);background:white;">
                                <option value="">-- Select Saved SMB Profile --</option>
                            </select>
                            <button onclick="tpDeleteSMBProfile()" style="padding:0.4rem 0.55rem;font-size:0.72rem;background:rgba(220,38,38,0.1);color:#dc2626;border:1px solid rgba(220,38,38,0.2);border-radius:6px;cursor:pointer;" title="Delete selected profile">
                                Delete
                            </button>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">
                            <input id="smb-system-name" type="text" placeholder="System SID / Name (e.g. EH8)" style="font-size:0.75rem;padding:0.4rem;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase();">
                            <input id="smb-server" type="text" placeholder="SMB Server IP / Host, e.g. 52.52.3.97" style="font-size:0.75rem;padding:0.4rem;">
                        </div>

                        <input id="smb-share" type="text" placeholder="Share Name, e.g. trans or saploc/trans" style="font-size:0.75rem;padding:0.4rem;">

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">
                            <input id="smb-user" type="text" placeholder="Username" style="font-size:0.75rem;padding:0.4rem;">
                            <input id="smb-pass" type="password" placeholder="Password" style="font-size:0.75rem;padding:0.4rem;">
                        </div>

                        <input id="smb-mountpoint" type="text" value="/tmp/trans" placeholder="Mount Point, e.g. /tmp/trans or ~/trans" style="font-size:0.75rem;padding:0.4rem;font-family:monospace;">
                        
                        <div style="display:flex;gap:0.4rem;margin-top:0.2rem;">
                            <button onclick="tpMountSMB()" style="flex:1;padding:0.4rem;font-size:0.72rem;font-weight:600;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.3rem;">
                                <i data-lucide="link" style="width:11px;height:11px;"></i> Mount Share
                            </button>
                            <button onclick="tpSaveSMBProfile()" style="padding:0.4rem 0.6rem;font-size:0.72rem;font-weight:600;background:#0a6ed1;color:white;border:none;border-radius:6px;cursor:pointer;">
                                Save Profile
                            </button>
                            <button onclick="tpUnmountSMB()" style="padding:0.4rem 0.6rem;font-size:0.72rem;background:rgba(220,38,38,0.1);color:#dc2626;border:1px solid rgba(220,38,38,0.2);border-radius:6px;cursor:pointer;">
                                Unmount
                            </button>
                            <button onclick="tpCheckSMBStatus()" style="padding:0.4rem 0.6rem;font-size:0.72rem;background:rgba(100,116,139,0.1);color:#64748b;border:1px solid rgba(100,116,139,0.2);border-radius:6px;cursor:pointer;">
                                Status
                            </button>
                        </div>
                        <div id="smb-status-msg" style="font-size:0.72rem;margin-top:0.2rem;display:none;"></div>
                    </div>
                </details>

                <div style="display:flex;gap:0.5rem;margin-top:0.25rem;">
                    <button id="btn-tp-run" onclick="tpRunCopy()"
                        style="flex:1;padding:0.6rem;font-size:0.82rem;font-weight:600;background:linear-gradient(135deg,#0a6ed1,#054a91);color:white;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem;transition:opacity 0.2s;">
                        <i data-lucide="play" style="width:14px;height:14px;"></i> Run Copy
                    </button>
                    <button onclick="tpReset()"
                        style="padding:0.6rem 0.75rem;font-size:0.82rem;background:rgba(0,0,0,0.05);color:var(--sap-text-muted);border:1px solid var(--sap-border);border-radius:8px;cursor:pointer;"
                        title="Clear log and reset">
                        <i data-lucide="rotate-ccw" style="width:14px;height:14px;"></i>
                    </button>
                </div>
            </div>

            <!-- RIGHT: Live log + target badges -->
            <div style="display:flex;flex-direction:column;gap:1rem;min-height:0;overflow:hidden;">

                <!-- Target status badges -->
                <div id="tp-target-badges" style="display:flex;flex-wrap:wrap;gap:0.5rem;"></div>

                <!-- Live log terminal -->
                <div class="card" style="flex:1;padding:0;overflow:hidden;display:flex;flex-direction:column;min-height:0;">
                    <div style="padding:0.6rem 1rem;border-bottom:1px solid var(--sap-border);display:flex;align-items:center;gap:0.5rem;background:rgba(15,23,42,0.04);">
                        <div style="width:10px;height:10px;border-radius:50%;background:#ff5f56;"></div>
                        <div style="width:10px;height:10px;border-radius:50%;background:#ffbd2e;"></div>
                        <div style="width:10px;height:10px;border-radius:50%;background:#27c93f;"></div>
                        <span style="font-size:0.72rem;color:var(--sap-text-muted);margin-left:0.5rem;font-family:monospace;">transport_copy — live output</span>
                        <div id="tp-spinner" style="display:none;margin-left:auto;">
                            <div style="width:14px;height:14px;border:2px solid rgba(10,110,209,0.2);border-top-color:#0a6ed1;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
                        </div>
                    </div>
                    <pre id="tp-log" style="flex:1;overflow-y:auto;padding:1rem;margin:0;background:#0f172a;color:#e2e8f0;font-size:0.75rem;font-family:'Cascadia Code','Fira Code',monospace;line-height:1.6;white-space:pre-wrap;word-break:break-all;min-height:0;">Waiting for input...</pre>
                </div>
            </div>
        </div>
    </div>
`;

function initTabTransport(container) {
    container.insertAdjacentHTML('beforeend', tabTransportHTML);
    tpRenderSMBProfileDropdown();
}

// --------------------------------------------------------------------------
// Derive SID/names live as user types
// --------------------------------------------------------------------------
function tpDeriveSID() {
    const val = document.getElementById('tp-trkorr').value.trim().toUpperCase();
    const m = val.match(/^([A-Z0-9]+)[KT](\d{6})$/);
    const badge = document.getElementById('tp-sid-badge');
    if (m) {
        document.getElementById('tp-sid-val').textContent = m[1];
        document.getElementById('tp-cofile-val').textContent = `K${m[2]}.${m[1]}`;
        document.getElementById('tp-datafile-val').textContent = `R${m[2]}.${m[1]}`;
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.gap = '0.25rem';
        if (window.lucide) lucide.createIcons();
    } else {
        badge.style.display = 'none';
    }
}

// --------------------------------------------------------------------------
// Validate a single host via the backend
// --------------------------------------------------------------------------
async function tpValidateHost(which) {
    const host = document.getElementById(which === 'src' ? 'tp-src-host' : 'tp-tgt-hosts').value.trim();
    const statusEl = document.getElementById(`tp-${which}-status`);
    const localMounts = tpParseLocalMounts();
    const baseDir = document.getElementById('tp-base-dir').value.trim() || '/usr/sap/trans';

    if (!host) return;
    statusEl.style.display = 'block';
    statusEl.innerHTML = '<span style="color:#64748b;">Testing connection...</span>';

    try {
        const res = await fetch(`${BACKEND_BASE}/transport/validate-host`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
            body: JSON.stringify({ host, base_trans_dir: baseDir, local_mount_hosts: localMounts })
        });

        let data;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            data = await res.json();
        } else {
            // Non-JSON response (e.g. plain-text 500) — surface raw text
            const raw = await res.text();
            statusEl.innerHTML = `<span style="color:#dc2626;">✗ Server error (${res.status}): ${raw.substring(0, 200)}</span>`;
            return;
        }

        if (data.reachable) {
            statusEl.innerHTML = `<span style="color:#16a34a;">✓ ${data.message}</span>`;
        } else {
            statusEl.innerHTML = `<span style="color:#dc2626;">✗ ${data.message}</span>`;
        }
    } catch (e) {
        statusEl.innerHTML = `<span style="color:#dc2626;">✗ Request failed: ${e.message}</span>`;
    }
    if (window.lucide) lucide.createIcons();
}

// --------------------------------------------------------------------------
// Parse the optional local mounts JSON field
// --------------------------------------------------------------------------
function tpParseLocalMounts() {
    const raw = (document.getElementById('tp-local-mounts').value || '').trim();
    if (!raw) return {};
    try { return JSON.parse(raw); }
    catch(e) { alert('Local Mount Hosts JSON is invalid: ' + e.message); return null; }
}

// --------------------------------------------------------------------------
// Reset the log panel and badges
// --------------------------------------------------------------------------
function tpReset() {
    document.getElementById('tp-log').textContent = 'Waiting for input...';
    document.getElementById('tp-log').style.color = '#e2e8f0';
    document.getElementById('tp-target-badges').innerHTML = '';
    document.getElementById('tp-spinner').style.display = 'none';
    document.getElementById('btn-tp-run').disabled = false;
    document.getElementById('btn-tp-run').style.opacity = '1';
    const srcStatus = document.getElementById('tp-src-status');
    srcStatus.style.display = 'none';
}

// --------------------------------------------------------------------------
// Render target host badges
// --------------------------------------------------------------------------
function tpRenderBadges(targets) {
    const container = document.getElementById('tp-target-badges');
    container.innerHTML = '';
    targets.forEach(t => {
        const badge = document.createElement('div');
        badge.id = `tp-badge-${t.replace(/[^a-zA-Z0-9]/g, '_')}`;
        badge.style.cssText = `display:inline-flex;align-items:center;gap:0.4rem;padding:0.35rem 0.75rem;border-radius:20px;font-size:0.75rem;font-weight:600;background:rgba(100,116,139,0.1);color:#64748b;border:1px solid rgba(100,116,139,0.2);transition:all 0.3s;`;
        badge.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:#64748b;"></div> ${t} <span style="font-weight:400;">(Pending)</span>`;
        container.appendChild(badge);
    });
}

function tpUpdateBadge(host, state) {
    const id = `tp-badge-${host.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const badge = document.getElementById(id);
    if (!badge) return;
    const styles = {
        'running': { bg: 'rgba(234,179,8,0.1)', color: '#854d0e', border: 'rgba(234,179,8,0.4)', dot: '#eab308', label: 'In Progress' },
        'ok':      { bg: 'rgba(22,163,74,0.1)',  color: '#15803d', border: 'rgba(22,163,74,0.3)',  dot: '#16a34a', label: '✓ Done' },
        'fail':    { bg: 'rgba(220,38,38,0.1)',  color: '#b91c1c', border: 'rgba(220,38,38,0.3)',  dot: '#dc2626', label: '✗ Failed' },
    };
    const s = styles[state];
    if (!s) return;
    badge.style.background = s.bg;
    badge.style.color = s.color;
    badge.style.border = `1px solid ${s.border}`;
    badge.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:${s.dot};${state==='running'?'animation:pulse 1s infinite;':''}"></div> ${host} <span style="font-weight:400;">(${s.label})</span>`;
}

// --------------------------------------------------------------------------
// Append a coloured log line to the terminal panel
// --------------------------------------------------------------------------
function tpAppendLog(line, logEl) {
    const lower = line.toLowerCase();
    let color = '#e2e8f0';
    if (lower.includes('error')) color = '#f87171';
    else if (lower.includes('success') || lower.includes('successfully') || lower.includes('copied successfully') || lower.includes('done.')) color = '#4ade80';
    else if (lower.includes('warning') || lower.includes('skipping') || lower.includes('failed')) color = '#fbbf24';
    else if (lower.includes('-----')) color = '#94a3b8';

    const span = document.createElement('span');
    span.style.color = color;
    span.style.display = 'block';
    span.textContent = line;
    logEl.appendChild(span);
    logEl.scrollTop = logEl.scrollHeight;
}

// --------------------------------------------------------------------------
// Main: run transport copy via SSE streaming
// --------------------------------------------------------------------------
async function tpRunCopy() {
    const trkorr = document.getElementById('tp-trkorr').value.trim().toUpperCase();
    const srcHost = document.getElementById('tp-src-host').value.trim();
    const tgtRaw = document.getElementById('tp-tgt-hosts').value.trim();
    const baseDir = document.getElementById('tp-base-dir').value.trim() || '/usr/sap/trans';
    const localMounts = tpParseLocalMounts();
    if (localMounts === null) return; // JSON parse error already alerted

    if (!trkorr || !srcHost || !tgtRaw) {
        alert('Please fill in: Transport Request #, Source Host, and Target Host(s).');
        return;
    }

    const tgtHosts = tgtRaw.split(',').map(h => h.trim()).filter(Boolean);
    if (!tgtHosts.length) { alert('No valid target hosts provided.'); return; }

    // Prepare UI
    const logEl = document.getElementById('tp-log');
    logEl.textContent = '';
    logEl.style.color = '#e2e8f0';
    document.getElementById('btn-tp-run').disabled = true;
    document.getElementById('btn-tp-run').style.opacity = '0.5';
    document.getElementById('tp-spinner').style.display = 'flex';
    tpRenderBadges(tgtHosts);
    if (window.lucide) lucide.createIcons();

    const payload = {
        src_host: srcHost,
        tgt_hosts: tgtHosts,
        trkorr: trkorr,
        base_trans_dir: baseDir,
        local_mount_hosts: localMounts
    };

    try {
        const res = await fetch(`${BACKEND_BASE}/transport/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            tpAppendLog(`ERROR: ${err.detail || res.statusText}`, logEl);
            return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line

            for (const raw of lines) {
                if (!raw.startsWith('data: ')) continue;
                const line = raw.slice(6); // strip 'data: '

                // Sentinel signals
                if (line === '__DONE__') {
                    document.getElementById('tp-spinner').style.display = 'none';
                    document.getElementById('btn-tp-run').disabled = false;
                    document.getElementById('btn-tp-run').style.opacity = '1';
                    continue;
                }
                if (line.startsWith('__TARGET_START__')) {
                    tpUpdateBadge(line.replace('__TARGET_START__', ''), 'running');
                    continue;
                }
                if (line.startsWith('__TARGET_OK__')) {
                    tpUpdateBadge(line.replace('__TARGET_OK__', ''), 'ok');
                    continue;
                }
                if (line.startsWith('__TARGET_FAIL__')) {
                    tpUpdateBadge(line.replace('__TARGET_FAIL__', ''), 'fail');
                    continue;
                }

                tpAppendLog(line, logEl);
            }
        }
    } catch (e) {
        tpAppendLog(`ERROR: ${e.message}`, logEl);
        document.getElementById('tp-spinner').style.display = 'none';
        document.getElementById('btn-tp-run').disabled = false;
        document.getElementById('btn-tp-run').style.opacity = '1';
    }
}

// --------------------------------------------------------------------------
// SMB Auto-Mount JS Handlers
// --------------------------------------------------------------------------
async function tpMountSMB() {
    const server = document.getElementById('smb-server').value.trim();
    let share = document.getElementById('smb-share').value.trim();
    // Clean leading/trailing slashes if user typed /saploc/trans or /trans
    share = share.replace(/^\/+|\/+$/g, '');
    const user = document.getElementById('smb-user').value.trim();
    const pass = document.getElementById('smb-pass').value;
    const mountpoint = document.getElementById('smb-mountpoint').value.trim() || '/tmp/trans';
    const statusMsg = document.getElementById('smb-status-msg');

    if (!server || !share || !user || !pass) {
        alert('Please fill in SMB Server IP/Host, Share name, Username, and Password.');
        return;
    }

    statusMsg.style.display = 'block';
    statusMsg.innerHTML = '<span style="color:#64748b;">Mounting SMB share...</span>';

    try {
        const res = await fetch(`${BACKEND_BASE}/transport/smb-mount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
            body: JSON.stringify({
                smb_server: server,
                smb_share: share,
                smb_user: user,
                smb_password: pass,
                mount_point: mountpoint
            })
        });
        const data = await res.json();
        if (data.success) {
            statusMsg.innerHTML = `<span style="color:#16a34a;">✓ ${data.message}</span>`;
            // Auto update local mounts field if empty
            const lm = document.getElementById('tp-local-mounts');
            if (!lm.value.trim()) {
                lm.value = `{"EH8": "${mountpoint}"}`;
            }
        } else {
            statusMsg.innerHTML = `<span style="color:#dc2626;">✗ ${data.message}</span>`;
        }
    } catch (e) {
        statusMsg.innerHTML = `<span style="color:#dc2626;">✗ Mount request failed: ${e.message}</span>`;
    }
}

async function tpUnmountSMB() {
    const mountpoint = document.getElementById('smb-mountpoint').value.trim() || '/tmp/trans';
    const statusMsg = document.getElementById('smb-status-msg');
    statusMsg.style.display = 'block';
    statusMsg.innerHTML = '<span style="color:#64748b;">Unmounting SMB share...</span>';

    try {
        const res = await fetch(`${BACKEND_BASE}/transport/smb-unmount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SESSION_TOKEN}` },
            body: JSON.stringify({ mount_point: mountpoint })
        });
        const data = await res.json();
        if (data.success) {
            statusMsg.innerHTML = `<span style="color:#16a34a;">✓ ${data.message}</span>`;
        } else {
            statusMsg.innerHTML = `<span style="color:#dc2626;">✗ ${data.message}</span>`;
        }
    } catch (e) {
        statusMsg.innerHTML = `<span style="color:#dc2626;">✗ Unmount failed: ${e.message}</span>`;
    }
}

async function tpCheckSMBStatus() {
    const mountpoint = document.getElementById('smb-mountpoint').value.trim() || '/tmp/trans';
    const statusMsg = document.getElementById('smb-status-msg');
    statusMsg.style.display = 'block';
    statusMsg.innerHTML = '<span style="color:#64748b;">Checking status...</span>';

    try {
        const res = await fetch(`${BACKEND_BASE}/transport/smb-status?mount_point=${encodeURIComponent(mountpoint)}`, {
            headers: { 'Authorization': `Bearer ${SESSION_TOKEN}` }
        });
        const data = await res.json();
        if (data.mounted) {
            statusMsg.innerHTML = `<span style="color:#16a34a;">✓ Mounted: ${data.mount_point}</span>`;
        } else {
            statusMsg.innerHTML = `<span style="color:#f59e0b;">⚠ Not mounted: ${data.mount_point}</span>`;
        }
    } catch (e) {
        statusMsg.innerHTML = `<span style="color:#dc2626;">✗ Status check failed: ${e.message}</span>`;
    }
}

// --------------------------------------------------------------------------
// SMB Profile Storage & Dropdown Management
// --------------------------------------------------------------------------
function tpGetSavedSMBProfiles() {
    try {
        const raw = localStorage.getItem('sap_smb_profiles_v1');
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function tpRenderSMBProfileDropdown() {
    const select = document.getElementById('smb-profile-select');
    if (!select) return;
    const profiles = tpGetSavedSMBProfiles();
    
    select.innerHTML = '<option value="">-- Select Saved SMB Profile --</option>';
    const keys = Object.keys(profiles);
    
    keys.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = `${k} (${profiles[k].server}/${profiles[k].share})`;
        select.appendChild(opt);
    });
}

function tpLoadSMBProfile() {
    const select = document.getElementById('smb-profile-select');
    const sysName = select.value;
    if (!sysName) return;

    const profiles = tpGetSavedSMBProfiles();
    const p = profiles[sysName];
    if (!p) return;

    document.getElementById('smb-system-name').value = sysName;
    document.getElementById('smb-server').value = p.server || '';
    document.getElementById('smb-share').value = p.share || '';
    document.getElementById('smb-user').value = p.user || '';
    document.getElementById('smb-pass').value = p.pass || '';
    document.getElementById('smb-mountpoint').value = p.mountpoint || '/tmp/trans';

    // Auto populate Local Mount Hosts JSON input
    const lm = document.getElementById('tp-local-mounts');
    let lmObj = tpParseLocalMounts() || {};
    lmObj[sysName] = p.mountpoint || '/tmp/trans';
    lm.value = JSON.stringify(lmObj, null, 2);

    // Auto set Source Host if empty
    const srcInput = document.getElementById('tp-src-host');
    if (!srcInput.value.trim()) {
        srcInput.value = sysName;
    }

    const statusMsg = document.getElementById('smb-status-msg');
    statusMsg.style.display = 'block';
    statusMsg.innerHTML = `<span style="color:#0a6ed1;">Loaded profile '${sysName}'. Click 'Mount Share' to connect.</span>`;
}

function tpSaveSMBProfile() {
    const sysName = document.getElementById('smb-system-name').value.trim().toUpperCase();
    const server = document.getElementById('smb-server').value.trim();
    const share = document.getElementById('smb-share').value.trim();
    const user = document.getElementById('smb-user').value.trim();
    const pass = document.getElementById('smb-pass').value;
    const mountpoint = document.getElementById('smb-mountpoint').value.trim() || '/tmp/trans';
    const statusMsg = document.getElementById('smb-status-msg');

    if (!sysName || !server || !share || !user || !pass) {
        alert('Please fill in System SID/Name, Server IP, Share name, Username, and Password to save profile.');
        return;
    }

    const profiles = tpGetSavedSMBProfiles();
    profiles[sysName] = { server, share, user, pass, mountpoint };

    localStorage.setItem('sap_smb_profiles_v1', JSON.stringify(profiles));
    tpRenderSMBProfileDropdown();
    document.getElementById('smb-profile-select').value = sysName;

    // Auto update Local Mount Hosts JSON map
    const lm = document.getElementById('tp-local-mounts');
    let lmObj = tpParseLocalMounts() || {};
    lmObj[sysName] = mountpoint;
    lm.value = JSON.stringify(lmObj, null, 2);

    statusMsg.style.display = 'block';
    statusMsg.innerHTML = `<span style="color:#16a34a;">✓ Profile '${sysName}' saved successfully!</span>`;
}

function tpDeleteSMBProfile() {
    const select = document.getElementById('smb-profile-select');
    const sysName = select.value || document.getElementById('smb-system-name').value.trim().toUpperCase();
    if (!sysName) {
        alert('Please select a profile to delete.');
        return;
    }

    if (!confirm(`Are you sure you want to delete SMB profile '${sysName}'?`)) return;

    const profiles = tpGetSavedSMBProfiles();
    delete profiles[sysName];
    localStorage.setItem('sap_smb_profiles_v1', JSON.stringify(profiles));

    document.getElementById('smb-system-name').value = '';
    document.getElementById('smb-server').value = '';
    document.getElementById('smb-share').value = '';
    document.getElementById('smb-user').value = '';
    document.getElementById('smb-pass').value = '';
    
    tpRenderSMBProfileDropdown();

    const statusMsg = document.getElementById('smb-status-msg');
    statusMsg.style.display = 'block';
    statusMsg.innerHTML = `<span style="color:#dc2626;">Deleted profile '${sysName}'.</span>`;
}


