import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from app.core.database import db

try:
    print("Testing connection and query...")
    # Querying a table like "User"
    user = db["User"].find_one()
    print("First user found:", user)
    
    print("\nListing columns for User table...")
    cols = db["User"]._get_table_columns()
    print("Columns:", cols)
    
    print("\nTesting ping command...")
    res = db.command("ping")
    print("Ping result:", res)
    
    print("\nTest passed successfully!")
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
