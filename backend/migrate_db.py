import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "complaints.db")

COLUMN_MIGRATIONS = [
    ("internal_note",        "ALTER TABLE complaints ADD COLUMN internal_note TEXT"),
    ("sla_breached",         "ALTER TABLE complaints ADD COLUMN sla_breached BOOLEAN DEFAULT 0"),
    ("satisfaction_rating",  "ALTER TABLE complaints ADD COLUMN satisfaction_rating INTEGER"),
    ("satisfaction_comment", "ALTER TABLE complaints ADD COLUMN satisfaction_comment TEXT"),
    ("resolved_at",          "ALTER TABLE complaints ADD COLUMN resolved_at DATETIME"),
    ("reopened_at",          "ALTER TABLE complaints ADD COLUMN reopened_at DATETIME"),
    ("image_path",           "ALTER TABLE complaints ADD COLUMN image_path VARCHAR(255)"),
    ("assigned_to_id",       "ALTER TABLE complaints ADD COLUMN assigned_to_id INTEGER REFERENCES users(id)"),
    ("first_response_at",    "ALTER TABLE complaints ADD COLUMN first_response_at DATETIME"),
    ("channel",              "ALTER TABLE complaints ADD COLUMN channel VARCHAR(50) DEFAULT 'Web Form'"),
    ("sla_deadline",         "ALTER TABLE complaints ADD COLUMN sla_deadline DATETIME"),
    ("sla_paused_at",        "ALTER TABLE complaints ADD COLUMN sla_paused_at DATETIME"),
    ("sla_extra_seconds",    "ALTER TABLE complaints ADD COLUMN sla_extra_seconds INTEGER DEFAULT 0"),
]

TABLE_MIGRATIONS = [
    (
        "complaint_status_history",
        """CREATE TABLE IF NOT EXISTS complaint_status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id VARCHAR(20) REFERENCES complaints(complaint_id),
            status VARCHAR(50),
            changed_by_name VARCHAR(100),
            changed_by_role VARCHAR(50),
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""",
    ),
    (
        "chat_messages",
        """CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id VARCHAR(20) REFERENCES complaints(complaint_id),
            sender_id INTEGER REFERENCES users(id),
            sender_name VARCHAR(100),
            sender_role VARCHAR(50),
            message TEXT,
            image_path VARCHAR(255),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""",
    ),
    (
        "category_assignments",
        """CREATE TABLE IF NOT EXISTS category_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category VARCHAR(100) UNIQUE,
            assigned_user_id INTEGER REFERENCES users(id)
        )""",
    ),
    (
        "resolution_notes",
        """CREATE TABLE IF NOT EXISTS resolution_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            complaint_id VARCHAR(20) NOT NULL,
            author_id INTEGER REFERENCES users(id),
            author_name VARCHAR(120) NOT NULL,
            author_role VARCHAR(20) NOT NULL,
            note TEXT NOT NULL,
            is_internal BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""",
    ),
    (
        "category_agent_map",
        """CREATE TABLE IF NOT EXISTS category_agent_map (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category VARCHAR(80) NOT NULL,
            user_id INTEGER NOT NULL REFERENCES users(id),
            UNIQUE(category, user_id)
        )""",
    ),
]


def get_existing_columns(cursor, table="complaints"):
    cursor.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}


def get_existing_tables(cursor):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return {row[0] for row in cursor.fetchall()}


def run():
    if not os.path.exists(DB_PATH):
        print(f"No database found at {DB_PATH} — nothing to migrate.")
        return

    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    existing_cols = get_existing_columns(cur)
    print(f"Existing complaint columns: {existing_cols}\n")

    col_applied = 0
    for col_name, sql in COLUMN_MIGRATIONS:
        if col_name not in existing_cols:
            print(f"  Adding column: {col_name} ...")
            cur.execute(sql)
            col_applied += 1
        else:
            print(f"  Skipping column (already exists): {col_name}")

    existing_tables = get_existing_tables(cur)
    tbl_applied = 0
    for tbl_name, sql in TABLE_MIGRATIONS:
        if tbl_name not in existing_tables:
            print(f"  Creating table: {tbl_name} ...")
            cur.execute(sql)
            tbl_applied += 1
        else:
            print(f"  Skipping table (already exists): {tbl_name}")

    conn.commit()
    conn.close()

    total = col_applied + tbl_applied
    if total:
        print(f"\n✅ Migration complete — {col_applied} column(s) added, {tbl_applied} table(s) created.")
    else:
        print("\n✅ Database already up to date — no changes needed.")

if __name__ == "__main__":
    run()
