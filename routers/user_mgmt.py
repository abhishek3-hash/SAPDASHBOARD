from fastapi import APIRouter, HTTPException, Depends
from pyrfc import Connection
from pydantic import BaseModel
from config import SAPConnectionPayload, get_current_user, verify_admin_privileges, safe_decode, handle_sap_exception

router = APIRouter(tags=["SU01 Master Module"])

class UserTargetPayload(BaseModel):
    connection: SAPConnectionPayload
    target_sap_user: str

@router.post("/sap-users/list")
def fetch_sap_system_users(payload: SAPConnectionPayload, current_user: dict = Depends(get_current_user)):
    config = {k: str(v).strip() for k, v in payload.model_dump().items()}
    try:
        with Connection(**config) as conn:
            result = conn.call("BAPI_USER_GETLIST")
            return {"status": "Success", "users": safe_decode(result.get("USERLIST", []))}
    except Exception as e:
        handle_sap_exception(e)

@router.post("/sap-users/lock")
def lock_sap_user(payload: UserTargetPayload, current_user: dict = Depends(verify_admin_privileges)):
    config = {k: str(v).strip() for k, v in payload.connection.model_dump().items()}
    try:
        with Connection(**config) as conn:
            return_log = conn.call("BAPI_USER_LOCK", USERNAME=payload.target_sap_user.strip().upper())
            return {"status": "Success", "sap_log": safe_decode(return_log.get("RETURN", {}))}
    except Exception as e:
        handle_sap_exception(e)

@router.post("/sap-users/unlock")
def unlock_sap_user(payload: UserTargetPayload, current_user: dict = Depends(verify_admin_privileges)):
    config = {k: str(v).strip() for k, v in payload.connection.model_dump().items()}
    try:
        with Connection(**config) as conn:
            return_log = conn.call("BAPI_USER_UNLOCK", USERNAME=payload.target_sap_user.strip().upper())
            return {"status": "Success", "sap_log": safe_decode(return_log.get("RETURN", {}))}
    except Exception as e:
        handle_sap_exception(e)