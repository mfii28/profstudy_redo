import socket
import sys

hosts = [
    "ioeajxhqypigpvdjshbe.supabase.co",
    "db.ioeajxhqypigpvdjshbe.supabase.co",
    "aws-0-us-east-1.pooler.supabase.com"
]

for host in hosts:
    print(f"\nResolving host: {host}")
    try:
        infos = socket.getaddrinfo(host, None)
        ips = set(info[4][0] for info in infos)
        print("Resolved IPs:", ips)
    except Exception as e:
        print("DNS Resolution error:", e)
