import psycopg
import sys
import concurrent.futures

regions = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1",
    "sa-east-1", "ca-central-1"
]

project_ref = "ioeajxhqypigpvdjshbe"
password = "Marvelvsdccomic"

def test_region(region):
    host = f"aws-0-{region}.pooler.supabase.com"
    conn_str = f"postgresql://postgres.{project_ref}:{password}@{host}:6543/postgres"
    try:
        conn = psycopg.connect(conn_str, connect_timeout=3)
        conn.close()
        return region, "SUCCESS"
    except Exception as e:
        return region, str(e)

print("Starting concurrent region test...")
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    results = executor.map(test_region, regions)
    for region, status in results:
        if "tenant/user" in status and "not found" in status:
            continue
        elif "getaddrinfo failed" in status:
            continue
        else:
            print(f"Region: {region} -> {status}")
