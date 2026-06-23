import psycopg
import sys

conn_str = "postgresql://postgres.ioeajxhqypigpvdjshbe:Marvelvsdccomic@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"

print("Testing connection to pooler host on port 5432...")
try:
    conn = psycopg.connect(conn_str, connect_timeout=5)
    print("SUCCESS! Connected to port 5432.")
    
    cur = conn.cursor()
    cur.execute("SELECT version();")
    print("Version:", cur.fetchone())
    cur.close()
    conn.close()
except Exception as e:
    print("Failed:", e, file=sys.stderr)
