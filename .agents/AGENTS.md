# Custom Project Rules for SAP Fiori Modular Operations Cockpit

Whenever you are suggested or requested to make changes to the codebase, follow these rules:

1. **Context Alignment**: Always reference the [CONTEXT.md](file:///Users/Abhishek/Downloads/SAP/CONTEXT.md) file to understand the architecture, database models, micro-routing blueprints, and integration structures.
2. **Architecture Consistency**:
   - Do NOT introduce monolithic scripts or revert back to a monolithic architecture (like `SAP_AI`).
   - Add new features as modular routes under the `routers/` directory, configure their schemas in [config.py](file:///Users/Abhishek/Downloads/SAP/config.py), and mount them in [main.py](file:///Users/Abhishek/Downloads/SAP/main.py).
3. **Fallback and Safety**:
   - Maintain robust fallback mechanisms for any SAP RFC calls in the endpoints so the frontend dashboard remains responsive even when live connections fail.
4. **Local DB Protocol**:
   - Query user management and security authorizations safely, keeping database calls structured around `sap_users.db`.
5. **Documentation Integrity**:
   - Do NOT modify the [CONTEXT.md](file:///Users/Abhishek/Downloads/SAP/CONTEXT.md) (or any other `.md` files) unless the user explicitly approves or finalizes the changes. You may suggest documentation updates in your response, but do not write them to the physical file until finalized.

