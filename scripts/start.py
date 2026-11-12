"""Foreground native launcher. Ctrl+C stops only the processes it starts."""
import os
import argparse
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend-port', type=int, default=8000)
    parser.add_argument('--frontend-port', type=int, default=4200)
    parser.add_argument('--check-startup', action='store_true', help='Verify readiness then stop only the servers created here')
    args = parser.parse_args()
    if args.backend_port == args.frontend_port or not all(1024 <= port <= 65535 for port in (args.backend_port,args.frontend_port)):
        raise SystemExit('Choose distinct backend/frontend ports from 1024 through 65535.')
    python = ROOT / 'backend/.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    node = shutil.which('node')
    cli = ROOT / 'frontend/node_modules/@angular/cli/bin/ng.js'
    if not python.exists() or not node or not cli.exists():
        raise SystemExit('Run the platform setup script first: missing venv, Node or local Angular CLI.')
    subprocess.run([str(python), 'manage.py', 'check_environment'], cwd=ROOT / 'backend', check=True)
    for port in (args.backend_port, args.frontend_port):
        with socket.socket() as probe:
            try:
                probe.bind(('127.0.0.1', port))
            except OSError:
                raise SystemExit(f'Port {port} is occupied. Stop your own earlier development server or use the two-terminal workflow with an explicitly updated proxy. No processes were killed.') from None
    processes = []
    temporary = tempfile.TemporaryDirectory(prefix='jedel-native-proxy-')
    proxy = Path(temporary.name) / 'proxy.json'
    import json
    proxy.write_text(json.dumps({'/api/**':{'target':f'http://127.0.0.1:{args.backend_port}','secure':False,'changeOrigin':True}}),encoding='utf-8')
    flags = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
    try:
        processes.append(subprocess.Popen([str(python), 'manage.py', 'runserver', f'127.0.0.1:{args.backend_port}', '--noreload'], cwd=ROOT / 'backend', **flags))
        processes.append(subprocess.Popen([node, str(cli), 'serve', '--host', '127.0.0.1', '--port', str(args.frontend_port), '--proxy-config',str(proxy)], cwd=ROOT / 'frontend', **flags))
        print('Starting Django and Angular. Waiting for /health/ and frontend; Ctrl+C stops both.', flush=True)
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            if any(process.poll() is not None for process in processes):
                raise RuntimeError('A development server exited; inspect its output above.')
            try:
                for url in (f'http://localhost:{args.backend_port}/health/', f'http://localhost:{args.frontend_port}/',f'http://localhost:{args.frontend_port}/api/ai/capabilities/'):
                    with urllib.request.urlopen(url, timeout=2) as response:
                        if response.status != 200:
                            raise OSError('Not ready')
                break
            except OSError:
                time.sleep(.5)
        else:
            raise RuntimeError('Startup timed out. Check PostgreSQL and the server output above.')
        print(f'READY: http://localhost:{args.frontend_port}/ | http://localhost:{args.backend_port}/ | http://localhost:{args.backend_port}/admin/ | http://localhost:{args.frontend_port}/ai-assistant\nCtrl+C stops this launcher and its two servers.', flush=True)
        if args.check_startup:
            return
        while all(process.poll() is None for process in processes):
            time.sleep(.5)
        raise RuntimeError('A development server stopped unexpectedly; inspect its output above.')
    except KeyboardInterrupt:
        print('\nStopping only the development processes created by this launcher.', flush=True)
    finally:
        for process in reversed(processes):
            if process.poll() is not None:
                continue
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        temporary.cleanup()


if __name__ == '__main__':
    try:
        main()
    except (subprocess.CalledProcessError, RuntimeError) as error:
        raise SystemExit(str(error)) from None
