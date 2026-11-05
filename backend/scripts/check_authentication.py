"""Verify real HTTP authentication on a temporary loopback server; GET only."""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    backend = Path(__file__).resolve().parents[1]
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    env = os.environ.copy()
    env['DJANGO_DEBUG'] = 'true'
    token = secrets.token_urlsafe(48)
    env.update(ERP_READ_TOKEN=token, ERP_BUYER_TOKEN='', ERP_APPROVER_TOKEN='', ERP_WRITE_TOKEN='')
    flags = {'creationflags': subprocess.CREATE_NO_WINDOW} if os.name == 'nt' else {}
    process = subprocess.Popen([sys.executable, '-u', 'manage.py', 'runserver', f'127.0.0.1:{port}', '--noreload', '--skip-migration-check'], cwd=backend, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **flags)
    base = f'http://127.0.0.1:{port}/api/'
    def get(path, credential=None):
        headers = {'Authorization': 'Bearer ' + credential} if credential else {}
        try:
            with urlopen(Request(base + path, headers=headers, method='GET'), timeout=5) as response:
                return response.status, json.loads(response.read())
        except HTTPError as error:
            return error.code, None
    try:
        for _ in range(40):
            if process.poll() is not None:
                raise RuntimeError('Temporary server did not start.')
            try:
                if get('health/')[0] == 200:
                    break
            except (URLError, OSError):
                time.sleep(.25)
        else:
            raise RuntimeError('Temporary server readiness timeout.')
        anonymous, _ = get('access/')
        invalid, _ = get('access/', secrets.token_urlsafe(48))
        authenticated, access = get('access/', token)
        if anonymous != 401 or invalid != 401 or authenticated != 200 or access.get('role') != 'viewer':
            raise RuntimeError('Authentication verification failed; credential contents were not printed.')
        business = {path: get(path, token)[0] for path in ['dashboard/', 'suppliers/', 'products/', 'orders/', 'analytics/supplier-spending/', 'analytics/order-status/']}
        print(json.dumps({'temporary_server': True, 'authentication_method': 'environment-scoped bearer credential', 'anonymous_status': anonymous, 'invalid_token_status': invalid, 'authenticated_access_status': authenticated, 'authenticated_role': access['role'], 'authenticated_business_get_statuses': business, 'all_business_gets_passed': all(status == 200 for status in business.values())}, indent=2))
    finally:
        process.terminate()
        process.wait(timeout=10)


if __name__ == '__main__':
    main()
