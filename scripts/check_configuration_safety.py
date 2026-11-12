"""Small local source/configuration guard; never prints credential matches."""
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    paths = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT,text=True).split('\0')
    tracked = set(subprocess.check_output(['git','ls-files','-z'],cwd=ROOT,text=True).split('\0'))
    failures = []
    for name in paths:
        if not name:
            continue
        path = ROOT / name
        if path.name.startswith('.env') and path.name != '.env.example':
            failures.append(name + ': private environment file in source manifest')
            continue
        if not path.is_file():
            continue
        if any(part in ('node_modules','.venv','backups') for part in path.parts) or path.suffix in ('.backup','.dump','.pem','.key'):
            failures.append(name + ': private/generated artifact in source manifest')
            continue
        value = path.read_bytes()
        if re.search(rb'gsk_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',value):
            failures.append(name + ': recognizable credential pattern (value suppressed)')
        if path.name == '.env.example':
            for key, item in re.findall(r'^([A-Z_]+)=(.*)$',value.decode('utf-8-sig'),re.M):
                if key.endswith(('_PASSWORD','_SECRET_KEY','_API_KEY','_TOKEN')) and item.strip():
                    failures.append(name + ': nonempty secret template field ' + key)
    if 'backend/.env' in tracked or '.env' in tracked:
        failures.append('Private environment file tracked')
    print(json.dumps({'source_configuration_guard':'PASS' if not failures else 'FAIL','findings':failures}))
    return bool(failures)


if __name__ == '__main__':
    raise SystemExit(main())
