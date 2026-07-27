from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from pyrfc import Connection
from config import SAPConnectionPayload, get_current_user, safe_decode, handle_sap_exception
from datetime import datetime

router = APIRouter(tags=["Logs Sub-System"])

class DumpResponse(BaseModel):
    datum: str
    uzeit: str
    uname: str
    seqno: str
    ahost: str
    modno: str
    mandt: Optional[str] = ""
    errid: Optional[str] = ""
    progname: Optional[str] = ""
    xhold: Optional[str] = ""
    tcode: Optional[str] = ""
    wp_index: Optional[str] = ""
    tid: Optional[str] = ""

class DumpDetailPayload(BaseModel):
    connection: SAPConnectionPayload
    datum: str
    uzeit: str
    ahost: str
    seqno: str

@router.post("/dumps", response_model=List[DumpResponse])
def run_dynamic_dumps_sync(payload: SAPConnectionPayload, date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if not date:
        date = datetime.now().strftime("%Y%m%d")
    config = {k: str(v).strip() for k, v in payload.model_dump().items()}
    try:
        with Connection(**config) as conn:
            desired_fields = ["DATUM", "UZEIT", "UNAME", "SEQNO", "AHOST", "MODNO", "MANDT", "ERRID", "PROGNAME", "XHOLD", "TCODE", "WP_INDEX", "TID"]
            try:
                result = conn.call("RFC_READ_TABLE", QUERY_TABLE="SNAP", DELIMITER="|", FIELDS=[{"FIELDNAME": f} for f in desired_fields], OPTIONS=[{"TEXT": f"DATUM = '{date}'"}], ROWCOUNT=20)
            except Exception:
                # Fallback to basic fields if extended fields are missing in this SAP version
                try:
                    basic_fields = ["DATUM", "UZEIT", "UNAME", "SEQNO", "AHOST", "MODNO"]
                    result = conn.call("RFC_READ_TABLE", QUERY_TABLE="SNAP", DELIMITER="|", FIELDS=[{"FIELDNAME": f} for f in basic_fields], OPTIONS=[{"TEXT": f"DATUM = '{date}'"}], ROWCOUNT=20)
                except Exception:
                    # If the SNAP table is entirely unavailable or we lack authorizations, fallback safely
                    return []
            
            returned_fields = [f["FIELDNAME"] for f in result.get("FIELDS", [])]
            dumps = []
            for row in result.get("DATA", []):
                values = row["WA"].split("|")
                raw_dump = dict(zip(returned_fields, [v.strip() for v in values]))
                dumps.append({
                    "datum": raw_dump.get("DATUM", ""),
                    "uzeit": raw_dump.get("UZEIT", ""),
                    "uname": raw_dump.get("UNAME", ""),
                    "seqno": raw_dump.get("SEQNO", ""),
                    "ahost": raw_dump.get("AHOST", ""),
                    "modno": raw_dump.get("MODNO", ""),
                    "mandt": raw_dump.get("MANDT", ""),
                    "errid": raw_dump.get("ERRID", ""),
                    "progname": raw_dump.get("PROGNAME", ""),
                    "xhold": raw_dump.get("XHOLD", ""),
                    "tcode": raw_dump.get("TCODE", ""),
                    "wp_index": raw_dump.get("WP_INDEX", ""),
                    "tid": raw_dump.get("TID", "")
                })
            return safe_decode(dumps)
    except Exception as e:
        handle_sap_exception(e)

@router.post("/dumps/details")
def fetch_dump_details(payload: DumpDetailPayload, current_user: dict = Depends(get_current_user)):
    config = {k: str(v).strip() for k, v in payload.connection.model_dump().items()}
    try:
        with Connection(**config) as conn:
            options = [
                {"TEXT": f"DATUM = '{payload.datum}' AND UZEIT = '{payload.uzeit}'"},
                {"TEXT": f" AND AHOST = '{payload.ahost}' AND SEQNO = '{payload.seqno}'"}
            ]
            result = conn.call("RFC_READ_TABLE", QUERY_TABLE="SNAP", DELIMITER="|", FIELDS=[{"FIELDNAME": "FLDATA"}], OPTIONS=options)
            
            lines = [row["WA"] for row in result.get("DATA", [])]
            return {"status": "Success", "fldata": safe_decode("\n".join(lines))}
    except Exception as e:
        handle_sap_exception(e)

@router.post("/sap-monitoring/sm21")
def fetch_sm21_system_logs(payload: SAPConnectionPayload, current_user: dict = Depends(get_current_user)):
    config = {k: str(v).strip() for k, v in payload.model_dump().items()}
    try:
        with Connection(**config) as conn:
            fields = [{"FIELDNAME": "LOGDATE"}, {"FIELDNAME": "LOGTIME"}, {"FIELDNAME": "USERID"}, {"FIELDNAME": "AREA"}, {"FIELDNAME": "MSGTEXT"}]
            res = conn.call("RFC_READ_TABLE", QUERY_TABLE="RSLGERR", DELIMITER="|", FIELDS=fields, ROWCOUNT=10)
            logs = []
            for row in res.get("DATA", []):
                vals = row["WA"].split("|")
                if len(vals) >= 4:
                    logs.append({"date": vals[0].strip(), "time": vals[1].strip(), "user": vals[2].strip(), "id": vals[3].strip(), "text": vals[4].strip() if len(vals) > 4 else "System Runtime Check Exception Raised"})
            return {"status": "Success", "logs": safe_decode(logs)}
    except Exception as e:
        handle_sap_exception(e)