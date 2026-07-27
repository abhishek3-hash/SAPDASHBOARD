# SAP Fiori Modular Operations Cockpit - Project Context & Code Analysis

This document provides a comprehensive analysis and context overview of the **SAP Fiori Modular Operations Cockpit Core Engine**. It describes the system architecture, file organization, routing modules, database schema, SAP integration patterns via RFC (`pyrfc`), and frontend mechanics.

---

## 1. Project Overview

The project is an enterprise-grade operations gateway designed to monitor and manage SAP systems. It consists of:
*   **FastAPI Backend**: A highly modularized API built in Python that communicates with SAP instances via RFC (Remote Function Call) protocols using the SAP NetWeaver RFC SDK wrapper (`pyrfc`).
*   **Local Database Layer**: A SQLite database storing local security roles and configuration metadata.
*   **Fiori Launchpad UI**: A modern, glassmorphic single-page frontend (HTML5/CSS3/JavaScript) styled to mimic the SAP Fiori design guidelines, providing real-time telemetry dashboards.

---

## 2. Directory Structure & Architecture

The codebase has been refactored from a monolithic implementation into a clean, modular micro-routing architecture.

```text
SAP/
├── CONTEXT.md             <-- [This File] Project context & system documentation
├── main.py                <-- Entry point of the FastAPI application
├── config.py              <-- Shared settings, authentication utilities, Pydantic models
├── sap_users.db           <-- Local SQLite database for security credentials & roles
├── SAP_AI                 <-- Pre-refactoring monolithic server code (kept for reference)
└── routers/               <-- API feature routes & frontend bundle
    ├── auth.py            <-- Identity suite and JWT generation
    ├── sys_matrix.py      <-- Active server checking
    ├── logs.py            <-- Dumps and system error logs (SM21)
    ├── security.py        <-- Auditing missing authorizations (SU53)
    ├── storage.py         <-- Workprocess (SM50) and DB metrics (DB02)
    ├── user_mgmt.py       <-- SAP User management (SU01)
    └── index.html         <-- Fiori Dashboard Single Page App
```

### Monolithic vs. Modular Structure
*   [SAP_AI](file:///Users/Abhishek/Downloads/SAP/SAP_AI) is a monolithic file containing all configurations, DB initializations, and endpoints.
*   The system now runs on [main.py](file:///Users/Abhishek/Downloads/SAP/main.py) which leverages individual routers inside the `routers/` directory to modularize features.

---

## 3. Database Specification

The system manages local user access using a SQLite database located at `sap_users.db`. 

*   **Database File**: Path is configured in [config.py](file:///Users/Abhishek/Downloads/SAP/config.py) as `/Users/Abhishek/Downloads/sap_users.db` (locally initialized in [main.py](file:///Users/Abhishek/Downloads/SAP/main.py)).
*   **Table Name**: `users_v2`
*   **Schema**:
    ```sql
    CREATE TABLE IF NOT EXISTS users_v2 (
        username TEXT PRIMARY KEY,
        role TEXT NOT NULL
    )
    ```
*   **Default Seed Data**: If the user `admin` is not present, it gets automatically created with the role `Admin`.

---

## 4. Backend Routing & Features

The FastAPI app splits business operations into discrete routing sub-systems:

| Module | Tags | Purpose | SAP Action / RFC Function |
| :--- | :--- | :--- | :--- |
| [auth.py](file:///Users/Abhishek/Downloads/SAP/routers/auth.py) | `Identity Suite` | Manages local logins and JWT token creation. | Query local DB `users_v2` |
| [sys_matrix.py](file:///Users/Abhishek/Downloads/SAP/routers/sys_matrix.py) | `Performance Matrix Cluster` | Monitors health/availability of SAP instances. | `TH_SERVER_LIST` |
| [logs.py](file:///Users/Abhishek/Downloads/SAP/routers/logs.py) | `Logs Sub-System` | Fetches ABAP short dumps and system logs. | `RFC_READ_TABLE` (on tables `SNAP` & `RSLGERR`) |
| [security.py](file:///Users/Abhishek/Downloads/SAP/routers/security.py) | `SU53 Auditing Module` | Tracks failing security checks for users. | `RFC_READ_TABLE` (on table `TOBJ`) |
| [storage.py](file:///Users/Abhishek/Downloads/SAP/routers/storage.py) | `SM50 Workprocesses & DB02 Space` | Tracks active workprocesses and storage telemetry. | `TH_WPINFO`, `RFC_SYSTEM_INFO`, and `RFC_READ_TABLE` (on `TSPAS` & `DD02L`) |
| [user_mgmt.py](file:///Users/Abhishek/Downloads/SAP/routers/user_mgmt.py) | `SU01 Master Module` | Fetches, locks, and unlocks SAP users. | `BAPI_USER_GETLIST`, `BAPI_USER_LOCK`, `BAPI_USER_UNLOCK` |

---

## 5. Security & Authentication Model

1.  **Passwordless Login**: Authentication is handled passwordlessly in `routers/auth.py` via `/login`. An operator enters their username, which is checked against `users_v2`. If found, a token is issued.
2.  **JWT Signing**: Access tokens are signed using HMAC-SHA256 (`HS256`) with a key declared in [config.py](file:///Users/Abhishek/Downloads/SAP/config.py). Tokens expire in 120 minutes.
3.  **Role-Based Access Control (RBAC)**:
    *   **`get_current_user`**: Validates the JWT and parses the role.
    *   **`verify_admin_privileges`**: Restricts certain operations (like creating users or locking/unlocking SAP accounts) to accounts with the role `Admin`.

---

## 6. SAP Integration & Strict Authentication

Connections are opened dynamically per request. The routes require client payloads (`SAPConnectionPayload`) containing login variables (`ashost`, `sysnr`, `client`, `user`, `passwd`, etc.).

### Strict SAP GUI Authentication Rules
The application strictly enforces SAP GUI authentication paradigms:
1. **Frontend Credential Guard**: All frontend interactions are protected by an `ensureCredentials()` gateway. If `sessionCredentials` are empty, no backend requests are fired; instead, the SAP credentials popup is triggered.
2. **Volatile Session Storage**: Passwords are never saved in `localStorage` or remembered across browser reloads. They exist strictly in runtime memory (`sessionCredentials`) mirroring a temporary SAP logon session.
3. **True Error Propagation**: Previous fallback modes (which yielded simulated data upon failure) have been entirely removed. Exceptions raised by `pyrfc` (e.g., missing authorizations, incorrect passwords, locked accounts) are caught and routed through a centralized `handle_sap_exception()` interceptor. This maps SAP internal errors to standard HTTP 401/403/500 errors, presenting authentic SAP lock/denial messages directly on the Fiori dashboard.

### Advanced System Diagnostics (ST22 Mimicry)
The `logs.py` router includes advanced parsing for SAP short dumps that closely resembles the native SAP GUI `ST22` transaction and the `RSSHOWRABAX` ABAP report:
- Safely queries dynamic fields from the `SNAP` table (`ERRID`, `PROGNAME`, `MANDT`, etc.) with built-in version fallbacks.
- Features a `/dumps/details` route to fetch raw `FLDATA` dump logs, rendered on the frontend in a native-styled "Runtime Error Long Text" split-screen modal.

### Advanced Telemetry Parsing (SM50 & DB02)
The `storage.py` router goes beyond basic data forwarding by implementing custom data interpreters:
- **SM50 (Work Processes)**: Parses the `TH_WPINFO` payload to extract 14 precise columns that mirror the exact SAP GUI layout (including `Type`, `WP Status`, `Process ID`, `CPU Time`, `Priority`, `Name of Program`, `Client`, and `User ID`). It also implements multi-key fallback extraction for user IDs (`WP_USER`, `WP_UNAME`, `WP_BNAME`) and parses `UP2` (Update Task 2) processes separately, tracking them dynamically in the global `SM50_PEAK_UTILIZATION` cache.
- **DB02 (Space Analytics)**: Dynamically checks the underlying database architecture (e.g., ORACLE vs HANA) and recalculates data modeling seeds accurately, presenting responsive tab titles (e.g., `Oracle Storage` vs `HANA Memory`) based on the live RFC connection dictionary data.

---

## 7. Frontend Architecture

[index.html](file:///Users/Abhishek/Downloads/SAP/routers/index.html) contains a modern HTML5 single-page application:
*   **Logon Screen**: Replicates the classic SAP NetWeaver GUI Logon style using square bordered inputs, a language selector, a blue gradient action button, and organic light-blue backdrop curves.
*   **Main Dashboard Styling**: The dashboard is branded **SAP DASHBOARD** (featuring the official SAP logo) and employs CSS variables, custom glassmorphism panels, CSS gradients (`--sap-fiori-fbg`), and smooth micro-animations. It uses a very tight, compact layout with perfectly rounded `16px` floating tiles. The UI leverages a CSS Flexbox architecture to organically stretch and consume available viewport space, incorporating custom styled scrollbars that match the Fiori aesthetic.
*   **Icons & Controls**: Integrated with the popular Lucide Icon pack. System management and "Add System" tools are neatly tucked away inside a top-right chevron dropdown menu (custom designed without native HTML arrow artifacts), keeping the interface minimal.
*   **Global State & Auto-Sync**: The frontend features an advanced auto-sync function. When launched, the application automatically merges any isolated landscape profiles stored in the browser's local storage (from tools like VSCode Live Server) and pushes them to the central backend `sap_users.db`. This allows the dashboard to be executed globally from any origin (even directly via `file:///`) while always sharing the exact same saved systems.
*   **Local File Execution**: CORS configurations on the backend specifically allow for the dashboard to be opened securely via native `file:///` protocols without triggering cross-origin authentication failures.

---

## 8. Setup and Execution

To run the application locally:

### 1. Installation
Install the required packages using pip:
```bash
pip install fastapi uvicorn PyJWT pydantic pyrfc
```
*(Note: `pyrfc` requires the SAP NW RFC SDK binaries configured in your system environment).*

### 2. Launch the server
Run the entry point file:
```bash
python main.py
```
Or start via uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Open [http://localhost:8000/docs](http://localhost:8000/docs) to view the Swagger API documentation or load the dashboard UI by loading the `index.html` template.
