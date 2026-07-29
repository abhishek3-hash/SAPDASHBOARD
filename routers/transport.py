import re
import subprocess
import shutil
import tempfile
import os
import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from config import TransportCopyPayload, TransportValidatePayload, get_current_user

router = APIRouter(tags=["Transport Copy Utility"])


# ---------------------------------------------------------------------------
# Helpers — mirror the bash script logic exactly
# ---------------------------------------------------------------------------

def _is_local_mount(host: str, local_mount_hosts: dict) -> bool:
    return host in local_mount_hosts


def _local_mount_path(host: str, local_mount_hosts: dict) -> str:
    return local_mount_hosts.get(host, "")


def _base_dir_for(host: str, base_trans_dir: str, local_mount_hosts: dict) -> str:
    if _is_local_mount(host, local_mount_hosts):
        return _local_mount_path(host, local_mount_hosts)
    return base_trans_dir


def _build_names(trkorr: str):
    """
    Derives SID, cofile name, and data file name from a transport request number.
    Format: <SID><K|T><6 digits>  e.g. EH8K900319 -> SID=EH8, K900319.EH8, R900319.EH8
    """
    m = re.match(r'^([A-Za-z0-9]+)([KT])(\d{6})$', trkorr.strip().upper())
    if not m:
        raise ValueError(
            f"Transport number '{trkorr}' does not match expected format "
            "<SID><K/T><6 digits>, e.g. EH8K900319."
        )
    sid = m.group(1)
    seq = m.group(3)
    cofile_name   = f"K{seq}.{sid}"
    datafile_name = f"R{seq}.{sid}"
    return sid, cofile_name, datafile_name


def _run(cmd: list, timeout: int = 30) -> tuple[int, str, str]:
    """Run a subprocess command and return (returncode, stdout, stderr)."""
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def _check_host(host: str, local_mount_hosts: dict):
    """
    Returns (ok: bool, message: str).
    For SSH hosts: checks SSH connectivity then passwordless sudo.
    For local-mount hosts: checks the mount path exists and is active.
    Never raises — always returns a tuple.
    """
    try:
        if _is_local_mount(host, local_mount_hosts):
            mount_path = _local_mount_path(host, local_mount_hosts)
            if not os.path.isdir(mount_path):
                return False, f"Mount path for '{host}' not found: {mount_path}. Is the SMB share connected?"
            rc, out, err = _run(["mount"])
            if f"on {mount_path} " not in out and mount_path not in out:
                return False, f"'{mount_path}' exists but does not appear to be an active mount. Reconnect the share for '{host}'."
            return True, f"Local mount for {host} is active at {mount_path}."

        # SSH host: connectivity check
        rc, _, err = _run(
            ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host, "true"],
            timeout=20
        )
        if rc != 0:
            return False, f"Cannot SSH to '{host}'. Check ~/.ssh/config and key. Details: {err}"

        # Passwordless sudo check
        rc2, _, err2 = _run(["ssh", host, "sudo -n true"], timeout=15)
        if rc2 != 0:
            return False, f"Passwordless sudo not available on '{host}'. Details: {err2}"

        return True, f"Host '{host}' is reachable and sudo is available."

    except FileNotFoundError:
        return False, "'ssh' command not found on the server. Ensure OpenSSH is installed on the machine running this backend."
    except subprocess.TimeoutExpired:
        return False, f"Connection to '{host}' timed out. The host may be unreachable or firewalled."
    except Exception as e:
        return False, f"Unexpected error checking '{host}': {str(e)}"


def _stage_source_locally(host: str, path: str, local_mount_hosts: dict) -> str:
    """
    Copies the remote/local file to a local temp path on THIS machine.
    Returns the local temp file path on success, raises on failure.
    """
    filename = os.path.basename(path)
    local_tmp = os.path.join(tempfile.gettempdir(), f"{filename}.transport_copy.{os.getpid()}")

    if _is_local_mount(host, local_mount_hosts):
        if not os.path.isfile(path):
            raise FileNotFoundError(f"Source file not found at '{path}' (mount for {host}).")
        shutil.copy2(path, local_tmp)
        return local_tmp

    # SSH host: copy to remote tmp, scp down, cleanup remote tmp
    remote_tmp = f"/tmp/{filename}.transport_copy.{os.getpid()}"
    rc, _, err = _run(["ssh", host, f"sudo test -f '{path}'"], timeout=15)
    if rc != 0:
        raise FileNotFoundError(f"Source file not found on {host}: {path}")

    rc, _, err = _run(
        ["ssh", host, f"sudo cp '{path}' '{remote_tmp}' && sudo chmod 644 '{remote_tmp}'"],
        timeout=30
    )
    if rc != 0:
        raise RuntimeError(f"Failed to stage '{path}' on {host}: {err}")

    rc, _, err = _run(["scp", f"{host}:{remote_tmp}", local_tmp], timeout=120)
    _run(["ssh", host, f"rm -f '{remote_tmp}'"], timeout=10)  # cleanup regardless
    if rc != 0:
        raise RuntimeError(f"scp from {host} failed: {err}")

    return local_tmp


def _deploy_to_target(host: str, local_tmp: str, dest_dir: str, filename: str, local_mount_hosts: dict):
    """Deploy a locally staged file to the target host (local or SSH)."""
    if _is_local_mount(host, local_mount_hosts):
        os.makedirs(dest_dir, exist_ok=True)
        shutil.copy2(local_tmp, os.path.join(dest_dir, filename))
        return

    rc, _, err = _run(["ssh", host, f"sudo mkdir -p '{dest_dir}'"], timeout=20)
    if rc != 0:
        raise RuntimeError(f"Failed to create directory {dest_dir} on {host}: {err}")

    remote_tmp = f"/tmp/{filename}.transport_copy.{os.getpid()}"
    rc, _, err = _run(["scp", local_tmp, f"{host}:{remote_tmp}"], timeout=120)
    if rc != 0:
        raise RuntimeError(f"scp to {host} failed: {err}")

    rc, _, err = _run(["ssh", host, f"sudo mv '{remote_tmp}' '{dest_dir}/{filename}'"], timeout=20)
    if rc != 0:
        raise RuntimeError(f"Failed to move {filename} into {dest_dir} on {host}: {err}")


def _set_permissions(host: str, file_path: str, local_mount_hosts: dict) -> str:
    if _is_local_mount(host, local_mount_hosts):
        return f"Skipping chmod 777 for {host}:{file_path} — not applicable on Windows/NTFS."
    rc, _, err = _run(["ssh", host, f"sudo chmod 777 '{file_path}'"], timeout=15)
    if rc != 0:
        raise RuntimeError(f"Failed to chmod {file_path} on {host}: {err}")
    return f"chmod 777 applied to {host}:{file_path}"


def _verify_target_file(host: str, file_path: str, local_mount_hosts: dict) -> str:
    if _is_local_mount(host, local_mount_hosts):
        result = subprocess.run(["ls", "-l", file_path], capture_output=True, text=True)
        return result.stdout.strip()
    rc, out, _ = _run(["ssh", host, f"sudo ls -l '{file_path}'"], timeout=15)
    return out


def _ts() -> str:
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# ---------------------------------------------------------------------------
# SSE generator — streams log lines as text/event-stream
# ---------------------------------------------------------------------------

def _sse(msg: str) -> str:
    """Format a single SSE data line."""
    return f"data: {msg}\n\n"


def _run_copy_stream(payload: TransportCopyPayload):
    """
    Generator that performs the full transport copy and yields SSE log lines.
    Mirrors the bash script's main() logic step by step.
    """
    lmh = payload.local_mount_hosts

    def log(msg: str):
        return _sse(f"[{_ts()}] {msg}")

    yield log("══════════════════════════════════════")
    yield log(" SAP Transport Copy Utility")
    yield log("══════════════════════════════════════")
    yield log(f"Source host   : {payload.src_host}")
    yield log(f"Target host(s): {', '.join(payload.tgt_hosts)}")
    yield log(f"Transport     : {payload.trkorr}")

    # --- Parse transport number ---
    try:
        sid, cofile_name, datafile_name = _build_names(payload.trkorr)
    except ValueError as e:
        yield log(f"ERROR: {e}")
        yield _sse("__DONE__")
        return

    yield log(f"Derived SID   : {sid}")
    yield log(f"Cofile name   : {cofile_name}")
    yield log(f"Data file name: {datafile_name}")

    # --- Preflight: source host ---
    yield log(f"Checking connectivity for source host '{payload.src_host}'...")
    ok, msg = _check_host(payload.src_host, lmh)
    yield log(msg)
    if not ok:
        yield log(f"ERROR: Source host preflight failed. Aborting.")
        yield _sse("__DONE__")
        return

    # --- Preflight: target hosts ---
    valid_targets = []
    for t in payload.tgt_hosts:
        yield log(f"Checking connectivity for target host '{t}'...")
        ok, msg = _check_host(t, lmh)
        yield log(msg)
        if ok:
            valid_targets.append(t)
        else:
            yield log(f"WARNING: Skipping target '{t}' — preflight check failed.")

    if not valid_targets:
        yield log("ERROR: No target hosts passed preflight. Nothing to do.")
        yield _sse("__DONE__")
        return

    # --- Build paths ---
    src_base = _base_dir_for(payload.src_host, payload.base_trans_dir, lmh)
    src_cofile_path   = f"{src_base}/cofiles/{cofile_name}"
    src_datafile_path = f"{src_base}/data/{datafile_name}"

    yield log(f"Cofile source : {payload.src_host}:{src_cofile_path}")
    yield log(f"Data source   : {payload.src_host}:{src_datafile_path}")

    # --- Stage files from source ONCE ---
    cofile_tmp = None
    datafile_tmp = None
    try:
        yield log("Staging cofile from source...")
        cofile_tmp = _stage_source_locally(payload.src_host, src_cofile_path, lmh)
        yield log(f"Cofile staged locally at {cofile_tmp}")

        yield log("Staging data file from source...")
        datafile_tmp = _stage_source_locally(payload.src_host, src_datafile_path, lmh)
        yield log(f"Data file staged locally at {datafile_tmp}")
    except Exception as e:
        yield log(f"ERROR: Failed to stage files from source: {e}")
        for f in [cofile_tmp, datafile_tmp]:
            if f and os.path.exists(f):
                os.remove(f)
        yield _sse("__DONE__")
        return

    # --- Copy to each target ---
    failed_targets = []
    for t in valid_targets:
        yield log(f"")
        yield log(f"----- Target: {t} -----")
        yield _sse(f"__TARGET_START__{t}")

        t_base = _base_dir_for(t, payload.base_trans_dir, lmh)
        tgt_cofile_dir   = f"{t_base}/cofiles"
        tgt_datafile_dir = f"{t_base}/data"

        try:
            yield log(f"Deploying cofile to {t}...")
            _deploy_to_target(t, cofile_tmp, tgt_cofile_dir, cofile_name, lmh)
            yield log(f"Cofile deployed to {t}:{tgt_cofile_dir}/{cofile_name}")

            yield log(f"Deploying data file to {t}...")
            _deploy_to_target(t, datafile_tmp, tgt_datafile_dir, datafile_name, lmh)
            yield log(f"Data file deployed to {t}:{tgt_datafile_dir}/{datafile_name}")

            yield log(f"Setting permissions on {t}...")
            msg = _set_permissions(t, f"{tgt_cofile_dir}/{cofile_name}", lmh)
            yield log(msg)
            msg = _set_permissions(t, f"{tgt_datafile_dir}/{datafile_name}", lmh)
            yield log(msg)

            yield log(f"Verifying files on {t}...")
            v1 = _verify_target_file(t, f"{tgt_cofile_dir}/{cofile_name}", lmh)
            yield log(f"  {v1}")
            v2 = _verify_target_file(t, f"{tgt_datafile_dir}/{datafile_name}", lmh)
            yield log(f"  {v2}")

            yield log(f"Transport {payload.trkorr} (SID {sid}) copied successfully to {t}.")
            yield _sse(f"__TARGET_OK__{t}")

        except Exception as e:
            yield log(f"ERROR on target '{t}': {e}")
            failed_targets.append(t)
            yield _sse(f"__TARGET_FAIL__{t}")

    # --- Cleanup local temp files ---
    for f in [cofile_tmp, datafile_tmp]:
        if f and os.path.exists(f):
            try:
                os.remove(f)
            except Exception:
                pass

    # --- Summary ---
    yield log("")
    yield log("══════════════════════════════════════")
    if not failed_targets:
        yield log(
            f"SUCCESS: Transport {payload.trkorr} (SID {sid}) copied to all targets: "
            f"{', '.join(valid_targets)}"
        )
    else:
        succeeded = [t for t in valid_targets if t not in failed_targets]
        yield log(
            f"COMPLETED WITH FAILURES. "
            f"Succeeded: {', '.join(succeeded) or 'none'}. "
            f"Failed: {', '.join(failed_targets)}."
        )
    yield log("══════════════════════════════════════")
    yield _sse("__DONE__")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/transport/validate-host")
def validate_transport_host(
    payload: TransportValidatePayload,
    current_user: dict = Depends(get_current_user)
):
    """Quick SSH/mount connectivity pre-check for a single host. Always returns JSON."""
    try:
        ok, msg = _check_host(payload.host, payload.local_mount_hosts)
        return {"host": payload.host, "reachable": ok, "message": msg}
    except Exception as e:
        return {"host": payload.host, "reachable": False, "message": f"Internal error: {str(e)}"}


@router.post("/transport/copy")
def run_transport_copy(
    payload: TransportCopyPayload,
    current_user: dict = Depends(get_current_user)
):
    """
    Streams the full transport copy operation as Server-Sent Events.
    Each SSE line is a log message. Special sentinel lines:
      __DONE__                 — operation complete
      __TARGET_START__<host>  — a target has begun processing
      __TARGET_OK__<host>     — a target succeeded
      __TARGET_FAIL__<host>   — a target failed
    """
    return StreamingResponse(
        _run_copy_stream(payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disables nginx buffering if behind a proxy
        }
    )
