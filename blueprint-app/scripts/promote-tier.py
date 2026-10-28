import sqlite3
import sys

# Promote a smoke-test account to AGENCY in blueprint-app's own users table, the
# same row a Stripe webhook would flip in Phase 4.
db_path, email = sys.argv[1], sys.argv[2]
con = sqlite3.connect(db_path)
cur = con.execute("UPDATE users SET subscription_tier='AGENCY' WHERE email=?", (email,))
con.commit()
print(f"rows updated: {cur.rowcount}")
con.close()
