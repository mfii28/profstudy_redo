import certifi
from pymongo import MongoClient
from app.core.config import settings

client = MongoClient(settings.DATABASE_URL, tlsCAFile=certifi.where())
# Get default database specified in connection string path, fall back to "studymate"
db = client.get_default_database("studymate")

def get_db():
    yield db

