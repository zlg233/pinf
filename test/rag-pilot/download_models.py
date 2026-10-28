"""Download official model artifacts in verified HTTP ranges; resumable within test/ only."""
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

import requests

ROOT = Path(__file__).resolve().parent
PARTS = ROOT / 'runtime/download-parts'
PARTS.mkdir(parents=True, exist_ok=True)


def curl(url, target, start=None, end=None):
    command = ['curl.exe', '-sS', '-L', '--fail', '--retry', '2', '--connect-timeout', '15', '--max-time', '240',
               '--output', str(target), '--write-out', '%{http_code}']
    if start is not None:
        command += ['--range', f'{start}-{end}']
    result = subprocess.run(command + [url], capture_output=True, text=True)
    if result.returncode or result.stdout.strip() != ('206' if start is not None else '200'):
        raise RuntimeError(f'Download failed for {target.name}: {result.stdout} {result.stderr[-300:]}')


def main():
    plans = []
    revisions = {}
    for repo, folder, names in [
        ('Xenova/paraphrase-multilingual-MiniLM-L12-v2', 'models/minilm',
         ['tokenizer.json', 'tokenizer_config.json', 'config.json', 'onnx/model_quantized.onnx']),
        ('Qwen/Qwen2.5-0.5B-Instruct-GGUF', 'models/qwen', ['qwen2.5-0.5b-instruct-q4_k_m.gguf']),
    ]:
        response = requests.get(f'https://huggingface.co/api/models/{repo}?blobs=true', timeout=30)
        response.raise_for_status()
        data = response.json()
        revisions[repo] = data['sha']
        for item in data['siblings']:
            if item['rfilename'] not in names:
                continue
            name = item['rfilename']
            plans.append({'url': f"https://huggingface.co/{repo}/resolve/{data['sha']}/{name}",
                          'path': str(ROOT / folder / name), 'size': item['size'],
                          'sha256': (item.get('lfs') or {}).get('sha256'), 'repo': repo})
    release = requests.get('https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/b11849', timeout=30)
    release.raise_for_status()
    asset = next(a for a in release.json()['assets'] if a['name'] == 'llama-b11849-bin-win-cpu-x64.zip')
    plans.append({'url': asset['browser_download_url'], 'path': str(ROOT / 'runtime/llama-cpu.zip'),
                  'size': asset['size'], 'sha256': (asset.get('digest') or '').removeprefix('sha256:') or None,
                  'repo': 'ggml-org/llama.cpp@b11849'})
    (ROOT / 'runtime/download-plan.json').write_text(json.dumps(plans, indent=2), encoding='utf-8')

    jobs = []
    for plan in plans:
        dest = Path(plan['path'])
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.exists() and dest.stat().st_size == plan['size']:
            if not plan['sha256'] or hashlib.sha256(dest.read_bytes()).hexdigest() == plan['sha256']:
                plan['complete'] = True
                print('Already verified: ' + dest.name, flush=True)
                continue
        plan['parts'] = []
        size = 4 * 1024 * 1024
        for start in range(0, plan['size'], size):
            end = min(start + size, plan['size']) - 1
            part = PARTS / f"{dest.name}.{start}-{end}.part"
            plan['parts'].append(str(part))
            if part.exists() and part.stat().st_size == end - start + 1:
                continue
            jobs.append((plan, start, end, part))

    def fetch(job):
        plan, start, end, target = job
        if plan['size'] < 1024 * 1024:
            curl(plan['url'], target)
        else:
            curl(plan['url'], target, start, end)
        if target.stat().st_size != end - start + 1:
            raise ValueError('Incorrect range length: ' + target.name)
        return target.name

    with ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(fetch, job) for job in jobs]
        for i, future in enumerate(as_completed(futures), 1):
            print(json.dumps({'part': future.result(), 'completed': i, 'total': len(futures)}), flush=True)

    for plan in plans:
        if plan.get('complete'):
            continue
        target = Path(plan['path'])
        assembled = target.with_suffix(target.suffix + '.assembled')
        digest = hashlib.sha256()
        with assembled.open('wb') as output:
            for path in plan['parts']:
                data = Path(path).read_bytes()
                digest.update(data)
                output.write(data)
        if assembled.stat().st_size != plan['size'] or (plan['sha256'] and digest.hexdigest() != plan['sha256']):
            raise ValueError('Artifact checksum mismatch: ' + target.name)
        assembled.replace(target)
        print('Verified: ' + target.name, flush=True)

    base = ROOT / 'models/minilm'
    manifest = {'repo': 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
                'revision': revisions['Xenova/paraphrase-multilingual-MiniLM-L12-v2'],
                'dimension': 384, 'max_tokens': 128, 'pooling': 'attention_mask_mean_then_l2',
                'files': {str(Path(p['path']).relative_to(base)): hashlib.sha256(Path(p['path']).read_bytes()).hexdigest()
                          for p in plans if p['repo'] == 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'}}
    (base / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    (ROOT / 'models/qwen/revision.txt').write_text(revisions['Qwen/Qwen2.5-0.5B-Instruct-GGUF'], encoding='utf-8')
    with zipfile.ZipFile(ROOT / 'runtime/llama-cpu.zip') as archive:
        root = (ROOT / 'runtime/llama-cpu').resolve()
        if any(not (root / name).resolve().is_relative_to(root) for name in archive.namelist()):
            raise ValueError('Archive path escapes runtime directory')
        archive.extractall(root)


if __name__ == '__main__':
    main()
