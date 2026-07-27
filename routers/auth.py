import sqlite3
import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, Form, HTTPException, Depends
from pydantic import BaseModel
from config import DB_FILE, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES, verify_admin_privileges, hash_password

router = APIRouter(tags=["Identity Suite"])

class UserCreatePayload(BaseModel):
    username: str
    password: str
    role: str = "Viewer"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str

@router.post("/login", response_model=TokenResponse)
def login_with_password(username: str = Form(...), password: str = Form(...)):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT role, password_hash FROM users_v2 WHERE username=?", (username.strip().lower(),))
    record = cursor.fetchone()
    conn.close()
    
    if not record:
        raise HTTPException(status_code=404, detail="Identity profile not found.")
        
    role, stored_hash = record
    # If the user has a stored hash, verify it. Otherwise, if there is no password in DB (old records),
    # we enforce that they must set a password, or if they passed the correct password.
    # To be secure, require credentials validation.
    if stored_hash and stored_hash != hash_password(password):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    elif not stored_hash:
        # For legacy users created without password, let them log in using their username as password
        # but warn or force them to update.
        if hash_password(password) != hash_password(username.strip().lower()):
            raise HTTPException(status_code=401, detail="Invalid credentials. Legacy accounts must use username as password.")
        
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_payload = {"sub": username.strip().lower(), "role": role, "exp": expire}
    encoded_jwt = jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": encoded_jwt, "token_type": "bearer", "role": role}

@router.post("/users", status_code=201)
def create_new_user(payload: UserCreatePayload):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        hashed_pw = hash_password(payload.password)
        cursor.execute("INSERT INTO users_v2 VALUES (?, ?, ?)", (payload.username.strip().lower(), payload.role, hashed_pw))
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Account already exists.")
    finally:
        conn.close()
    return {"username": payload.username.lower(), "role": payload.role}


@router.get("/users")
def list_system_users(current_user: dict = Depends(verify_admin_privileges)):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT username, role FROM users_v2")
    rows = cursor.fetchall()
    conn.close()
    return [{"username": r[0], "role": r[1]} for r in rows]