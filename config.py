import jwt
import hashlib
from fastapi import HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from typing import Optional

def hash_password(password: str) -> str:
    salt = "sap_fiori_salt_value_123!"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()


# Cryptographic and Session Rules
SECRET_KEY = "SUPER_SECRET_HEX_KEY_DO_NOT_SHARE_IN_PRODUCTION"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120
DB_FILE = "/Users/Abhishek/Downloads/sap_users.db"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# -----------------------------------------------------------------------------
# FIXED BLUEPRINTS: Added missing Request Schemas for the Monitoring Routers
# -----------------------------------------------------------------------------
class SAPConnectionPayload(BaseModel):
    ashost: str
    sysnr: str
    client: str
    user: str
    passwd: str
    lang: str = "EN"

class SM50RequestPayload(BaseModel):
    connection: SAPConnectionPayload
    start_period: Optional[str] = None
    end_period: Optional[str] = None

class DB02RequestPayload(BaseModel):
    connection: SAPConnectionPayload

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """Secures resource endpoints against invalid session requests."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate session footprint.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise credentials_exception
        return {"username": username, "role": role}
    except jwt.PyJWTError:
        raise credentials_exception

def verify_admin_privileges(current_user: dict = Depends(get_current_user)):
    """Blocks non-admin operations across sensitive maintenance paths."""
    if current_user.get("role") != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Administrative Clearance Required."
        )
    return current_user

def safe_decode(data):
    """Sanitizes raw network data into UTF-8 formats safely."""
    if isinstance(data, dict):
        return {k: safe_decode(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [safe_decode(item) for item in data]
    elif isinstance(data, bytes):
        try:
            return data.decode('utf-8').strip()
        except UnicodeDecodeError:
            return data.decode('latin1', errors='replace').strip()
    elif isinstance(data, str):
        return data.strip()
    return data

def handle_sap_exception(e: Exception):
    err_msg = str(e).lower()
    if "locked" in err_msg:
        raise HTTPException(status_code=401, detail="Logon failed: User locked.")
    if "expire" in err_msg:
        raise HTTPException(status_code=401, detail="Logon failed: Password expired.")
    if "exist" in err_msg:
        raise HTTPException(status_code=401, detail="Logon failed: User does not exist.")
    if "logon" in err_msg or "password" in err_msg or "unauthorized" in err_msg or "not authorized" in err_msg:
        raise HTTPException(status_code=401, detail="Logon failed: Invalid credentials or insufficient authorization.")
    raise HTTPException(status_code=500, detail=f"SAP System Error: {str(e)}")