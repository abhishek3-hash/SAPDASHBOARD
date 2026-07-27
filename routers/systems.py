from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import sqlite3
from typing import Dict
from config import DB_FILE, get_current_user

router = APIRouter()

class SystemCreate(BaseModel):
    name: str
    ashost: str
    sysnr: str
    client: str

@router.get("/systems")
def get_systems(user: dict = Depends(get_current_user)):
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT name, ashost, sysnr, client FROM systems")
        rows = cursor.fetchall()
        
        systems = {}
        for row in rows:
            systems[row['name']] = {
                'ashost': row['ashost'],
                'sysnr': row['sysnr'],
                'client': row['client']
            }
        return {"systems": systems}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/systems")
def create_system(sys: SystemCreate, user: dict = Depends(get_current_user)):
    # Restrict to Admin
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only Admins can modify systems.")
    
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("INSERT OR REPLACE INTO systems (name, ashost, sysnr, client) VALUES (?, ?, ?, ?)",
                       (sys.name, sys.ashost, sys.sysnr, sys.client))
        conn.commit()
        return {"status": "success", "message": f"System {sys.name} saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.delete("/systems/{system_name}")
def delete_system(system_name: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only Admins can delete systems.")
        
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM systems WHERE name = ?", (system_name,))
        conn.commit()
        return {"status": "success", "message": f"System {system_name} deleted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
