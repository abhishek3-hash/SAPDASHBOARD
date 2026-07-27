from fastapi import APIRouter, HTTPException, Depends
from pyrfc import Connection
from config import SAPConnectionPayload, get_current_user, safe_decode, handle_sap_exception
import datetime

router = APIRouter(tags=["Performance Matrix Cluster"])

@router.post("/performance")
def run_dynamic_performance_sync(payload: SAPConnectionPayload, current_user: dict = Depends(get_current_user)):
    config = {k: str(v).strip() for k, v in payload.model_dump().items()}
    try:
        with Connection(**config) as conn:
            raw_server_list = conn.call("TH_SERVER_LIST")
            return {
                "status": "Healthy",
                "timestamp": datetime.datetime.now().isoformat(),
                "active_servers": safe_decode(raw_server_list).get("LIST", [])
            }
    except Exception as e:
        handle_sap_exception(e)