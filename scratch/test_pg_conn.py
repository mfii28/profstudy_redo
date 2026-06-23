import psycopg
import sys

connection_strings = {
    "DIRECT": "postgresql://postgres:Marvelvsdccomic@db.ioeajxhqypigpvdjshbe.supabase.co:5432/postgres",
    "POOLER": "postgresql://postgres.ioeajxhqypigpvdjshbe:Marvelvsdccomic@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
}

for name, conn_str in connection_strings.items():
    print(f"\n--- Testing {name} Connection ---")
    try:
        conn = psycopg.connect(conn_str, connect_timeout=5)
        print("Success! Connection established.")
        
        # Test query
        cur = conn.cursor()
        cur.execute("SELECT version();")
        print("Postgres Version:", cur.fetchone())
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Connection failed: {e}", file=sys.stderr)
