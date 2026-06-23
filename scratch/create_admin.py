import sys
import os
import requests
import psycopg
import json

# Load configurations from backend .env
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

# Read environment variables manually if needed or import settings
frontend_env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", ".env"))
env_vars = {}
if os.path.exists(frontend_env_path):
    with open(frontend_env_path, "r", encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.strip().split("=", 1)
                env_vars[k.strip()] = v.strip().strip('"').strip("'")

supabase_url = env_vars.get("NEXT_PUBLIC_SUPABASE_URL")
anon_key = env_vars.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
db_url = env_vars.get("DATABASE_URL")

if not supabase_url or not anon_key or not db_url:
    backend_env_path = os.path.join(backend_dir, ".env")
    if os.path.exists(backend_env_path):
        with open(backend_env_path, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    supabase_url = env_vars.get("NEXT_PUBLIC_SUPABASE_URL") or "https://ioeajxhqypigpvdjshbe.supabase.co"
    anon_key = env_vars.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or "sb_publishable_ayrimY5f0mawcJnOHnBR1A_OHwBuHK8"
    db_url = env_vars.get("DATABASE_URL")

print("Supabase URL:", supabase_url)
print("Database URL:", db_url)

email = "superadmin@gmail.com"
password = "AdminSecurePass123!"

print(f"\nSigning up user: {email}...")
signup_url = f"{supabase_url.rstrip('/')}/auth/v1/signup"
headers = {
    "apikey": anon_key,
    "Content-Type": "application/json"
}
payload = {
    "email": email,
    "password": password,
    "data": {
        "name": "Super Admin",
        "role": "superadmin"
    }
}

resp = requests.post(signup_url, json=payload, headers=headers)
print("HTTP Status:", resp.status_code)
res_data = resp.json()

uid = None
if resp.status_code in (200, 201):
    uid = res_data.get("id") or res_data.get("user", {}).get("id")
    print("User created successfully via Supabase Auth. UID:", uid)
else:
    print("Signup response:", res_data)
    error_msg = res_data.get("msg") or res_data.get("error_description")
    if "already registered" in str(error_msg).lower() or "already exists" in str(error_msg).lower():
        print("User already exists. Querying UID from database...")
    else:
        print("Could not complete signup.")

# Connect to database to promote
try:
    normalized_db_url = db_url.replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(normalized_db_url) as conn:
        with conn.cursor() as cur:
            if not uid:
                cur.execute("SELECT id FROM auth.users WHERE email = %s", (email,))
                row = cur.fetchone()
                if row:
                    uid = row[0]
                    print("Found existing user UID from auth.users:", uid)
                else:
                    cur.execute('SELECT id FROM public."User" WHERE email = %s', (email,))
                    row = cur.fetchone()
                    if row:
                        uid = row[0]
                        print("Found existing user UID from public.User:", uid)
            
            uid = str(uid)
            print("Promoting in auth.users...")
            meta_json = json.dumps({"name": "Super Admin", "role": "superadmin"})
            cur.execute("""
                UPDATE auth.users 
                SET email_confirmed_at = NOW(),
                    raw_user_meta_data = %s
                WHERE id = %s::uuid
            """, (meta_json, uid))
            
            cur.execute("SELECT 1 FROM auth.identities WHERE user_id = %s::uuid", (uid,))
            if not cur.fetchone():
                import uuid
                identity_id = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
                    VALUES (%s, %s::uuid, %s, 'email', NOW(), NOW(), NOW())
                """, (identity_id, uid, json.dumps({"sub": uid, "email": email})))

            print('Promoting in public."User"...')
            cur.execute('SELECT 1 FROM public."User" WHERE id = %s', (uid,))
            if cur.fetchone():
                cur.execute("""
                    UPDATE public."User"
                    SET role = 'superadmin',
                        "emailVerified" = true,
                        status = 'active',
                        "updatedAt" = NOW()
                    WHERE id = %s
                """, (uid,))
            else:
                cur.execute("""
                    INSERT INTO public."User" (id, email, name, role, status, "emailVerified", "createdAt", "updatedAt")
                    VALUES (%s, %s, 'Super Admin', 'superadmin', 'active', true, NOW(), NOW())
                """, (uid, email))
                
            conn.commit()
            print("\nAdmin user successfully promoted and verified in PostgreSQL!")
            print(f"Credentials:")
            print(f"  Email: {email}")
            print(f"  Password: {password}")
            
except Exception as db_err:
    print("Database error:", db_err)
    sys.exit(1)
