import psycopg
from psycopg.rows import dict_row
from app.core.config import settings

class PostgresCollectionCompat:
    def __init__(self, table_name, db_url):
        self.table_name = table_name
        self.db_url = db_url

    def _connect(self):
        url = self.db_url.replace("postgresql+psycopg://", "postgresql://")
        return psycopg.connect(url, row_factory=dict_row)

    def _translate_filter(self, filter_dict):
        if not filter_dict:
            return "1=1", []
        
        where_parts = []
        args = []
        for key, val in filter_dict.items():
            col_name = "id" if key == "_id" else key
            where_parts.append(f'"{col_name}" = %s')
            args.append(val)
            
        return " AND ".join(where_parts), args

    def find_one(self, filter_dict=None):
        where_clause, args = self._translate_filter(filter_dict)
        query = f'SELECT * FROM "{self.table_name}" WHERE {where_clause} LIMIT 1'
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(query, args)
                row = cur.fetchone()
                if row:
                    if "id" in row:
                        row["_id"] = row["id"]
                    return row
        return None

    def find(self, filter_dict=None):
        where_clause, args = self._translate_filter(filter_dict)
        query = f'SELECT * FROM "{self.table_name}" WHERE {where_clause}'
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(query, args)
                rows = cur.fetchall()
                for row in rows:
                    if "id" in row:
                        row["_id"] = row["id"]
                return rows

    def insert_one(self, document):
        doc_copy = dict(document)
        if "_id" in doc_copy and "id" not in doc_copy:
            doc_copy["id"] = doc_copy.pop("_id")
            
        columns = self._get_table_columns()
        
        insert_cols = []
        insert_vals = []
        for col in columns:
            if col in doc_copy:
                insert_cols.append(f'"{col}"')
                insert_vals.append(doc_copy[col])
                
        col_str = ", ".join(insert_cols)
        placeholder_str = ", ".join(["%s"] * len(insert_vals))
        query = f'INSERT INTO "{self.table_name}" ({col_str}) VALUES ({placeholder_str})'
        
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(query, insert_vals)
                conn.commit()
                
        class InsertOneResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertOneResult(doc_copy.get("id"))

    def update_one(self, filter_dict, update_dict, upsert=False):
        set_dict = update_dict.get("$set", {}) if isinstance(update_dict, dict) else update_dict
        existing = self.find_one(filter_dict)
        columns = self._get_table_columns()
        
        if existing:
            where_clause, filter_args = self._translate_filter(filter_dict)
            update_parts = []
            update_args = []
            for col in columns:
                if col in set_dict and col != "id":
                    update_parts.append(f'"{col}" = %s')
                    update_args.append(set_dict[col])
            
            if update_parts:
                query = f'UPDATE "{self.table_name}" SET {", ".join(update_parts)} WHERE {where_clause}'
                with self._connect() as conn:
                    with conn.cursor() as cur:
                        cur.execute(query, update_args + filter_args)
                        conn.commit()
        elif upsert:
            insert_doc = {}
            for k, v in filter_dict.items():
                col_name = "id" if k == "_id" else k
                insert_doc[col_name] = v
            for k, v in set_dict.items():
                col_name = "id" if k == "_id" else k
                insert_doc[col_name] = v
            self.insert_one(insert_doc)

        class UpdateResult:
            def __init__(self):
                self.modified_count = 1
        return UpdateResult()

    def delete_many(self, filter_dict):
        where_clause, args = self._translate_filter(filter_dict)
        query = f'DELETE FROM "{self.table_name}" WHERE {where_clause}'
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(query, args)
                conn.commit()
                
        class DeleteResult:
            def __init__(self):
                self.deleted_count = 1
        return DeleteResult()

    _columns_cache = {}

    def _get_table_columns(self):
        if self.table_name in self._columns_cache:
            return self._columns_cache[self.table_name]
            
        columns = []
        try:
            with self._connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(f'SELECT * FROM "{self.table_name}" LIMIT 0')
                    columns = [desc[0] for desc in cur.description]
        except Exception as e:
            try:
                with self._connect() as conn:
                    with conn.cursor() as cur:
                        cur.execute(f'SELECT * FROM "{self.table_name.lower()}" LIMIT 0')
                        columns = [desc[0] for desc in cur.description]
                        self.table_name = self.table_name.lower()
            except:
                pass
                
        self._columns_cache[self.table_name] = columns
        return columns

class PostgresPyMongoCompat:
    def __init__(self, db_url):
        self.db_url = db_url

    def __getitem__(self, collection_name):
        table_name = collection_name
        if collection_name == "PlatformSettings":
            table_name = "platformSettings"
        return PostgresCollectionCompat(table_name, self.db_url)
        
    def get_default_database(self, default_name=None):
        return self

    def command(self, cmd_name, *args, **kwargs):
        if cmd_name == "ping":
            url = self.db_url.replace("postgresql+psycopg://", "postgresql://")
            with psycopg.connect(url) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            return {"ok": 1.0}
        raise NotImplementedError(f"Command {cmd_name} is not implemented")

client = PostgresPyMongoCompat(settings.DATABASE_URL)
db = client

def get_db():
    yield db
