"""Apply database/app_user_docker.sql as the owner account.

Replaces the psql variable :'app_pw' with a safely quoted literal.
Reads connection data from DB_* and APP_DB_PASSWORD environment variables.
The password is never printed.
"""
import os
import sys

import psycopg2
from psycopg2.extensions import adapt

SQL_PATH = os.path.join(os.path.dirname(__file__), "app_user_docker.sql")


def main():
    app_pw = os.environ.get("APP_DB_PASSWORD", "")
    if not app_pw:
        sys.exit("APP_DB_PASSWORD is not set")
    with open(SQL_PATH, encoding="utf-8") as f:
        sql = f.read()
    marker = ":'app_pw'"
    if marker not in sql:
        sys.exit("Password placeholder not found in app_user_docker.sql")
    conn = psycopg2.connect(
        host=os.environ.get("DB_HOST", "db"),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )
    try:
        quoted = adapt(app_pw)
        quoted.prepare(conn)
        sql = sql.replace(marker, quoted.getquoted().decode())
        with conn, conn.cursor() as cur:
            cur.execute(sql)
    finally:
        conn.close()
    print("Restricted application user ready.")


if __name__ == "__main__":
    main()