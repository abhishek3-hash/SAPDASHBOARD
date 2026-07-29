import os
import sqlite3
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import DB_FILE, hash_password

# Global Application Orchestrator
app = FastAPI(
    title="SAP Fiori Modular Operations Cockpit Core Engine",
    description="Decoupled enterprise operations gateway built on highly optimized micro-routing segments.",
    version="20.0.0"
)

# Cross-Origin Security Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def init_db():
    """Guarantees local storage workspace boundaries are provisioned cleanly."""
    db_directory = os.path.dirname(DB_FILE)
    if db_directory and not os.path.exists(db_directory):
        os.makedirs(db_directory, exist_ok=True)
        
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users_v2 (
            username TEXT PRIMARY KEY,
            role TEXT NOT NULL,
            password_hash TEXT
        )
    """)
    # Migration if table already existed without password_hash
    try:
        cursor.execute("ALTER TABLE users_v2 ADD COLUMN password_hash TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass
        
    cursor.execute("SELECT * FROM users_v2 WHERE username='admin'")
    if not cursor.fetchone():
        admin_pass_hash = hash_password("admin")
        cursor.execute("INSERT INTO users_v2 VALUES (?, ?, ?)", ("admin", "Admin", admin_pass_hash))
        conn.commit()
    conn.close()


# Initialize Local Database Space
init_db()

# Import Modular Feature Routes
from routers import auth, sys_matrix, logs, user_mgmt, security, storage, systems, transport

# Mount Micro-Routing Blueprints Natively
app.include_router(auth.router)
app.include_router(sys_matrix.router)
app.include_router(logs.router)
app.include_router(user_mgmt.router)
app.include_router(security.router)
app.include_router(storage.router)
app.include_router(systems.router)
app.include_router(transport.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)