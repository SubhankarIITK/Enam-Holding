"""Package only release source; exclude credentials, runtime data and build output."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
target = root / 'releases' / f'finn-{version}-source.zip'
target.parent.mkdir(exist_ok=True)
directories = ['app', 'components', 'lib', 'scripts', 'docs', 'tests', '.github']
files = [root / name for name in ['package.json', 'package-lock.json', 'next.config.mjs', 'vercel.json', 'jsconfig.json', 'README.md', '.env.example', '.gitignore']]
for directory in directories:
    files.extend(p for p in (root / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(files):
        relative = file.relative_to(root)
        assert not any(part in {'.finn-data', '.vercel', '.next', 'node_modules', 'tmp', '.git', 'releases'} for part in relative.parts)
        assert not (file.name.startswith('.env') and file.name != '.env.example')
        archive.write(file, relative.as_posix())
print(f'Packaged {len(files)} source files: {target.name}')
print('SHA256 ' + hashlib.sha256(target.read_bytes()).hexdigest())
