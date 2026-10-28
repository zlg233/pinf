"""Authenticated, local-only-by-default task API for n8n ingestion orchestration."""
import argparse
from datetime import datetime, timezone
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import threading
import uuid

from ingest_documents import atomic_json
from ingestion import BusyError, ROOT, run_library
from pilot import LocalEmbedder


def now():
    return datetime.now(timezone.utc).isoformat()


class JobManager:
    def __init__(self, root, model_factory):
        self.root = Path(root).resolve()
        self.model_factory = model_factory
        self.model = None
        self.guard = threading.Lock()
        self.active = None
        self.worker = None
        self.folder = self.root / 'runs/jobs'
        self.folder.mkdir(parents=True, exist_ok=True)
        # Never present work from a previous crashed process as still running.
        for path in self.folder.glob('*.json'):
            job = json.loads(path.read_text(encoding='utf-8'))
            if job['status'] in ('queued', 'running'):
                job.update(status='failed', error='interrupted_by_service_restart', finished_at=now())
                atomic_json(path, job)

    def submit(self):
        with self.guard:
            if self.active is not None:
                raise BusyError('An ingestion job is already active')
            job = {'job_id': uuid.uuid4().hex, 'status': 'queued', 'created_at': now()}
            atomic_json(self.folder / (job['job_id'] + '.json'), job)
            self.active = job['job_id']
            self.worker = threading.Thread(target=self._run, args=(job,), name='rag-ingestion-job', daemon=False)
            self.worker.start()
            return job

    def _run(self, job):
        path = self.folder / (job['job_id'] + '.json')
        try:
            job = {**job, 'status': 'running', 'started_at': now()}
            atomic_json(path, job)
            if self.model is None:
                self.model = self.model_factory()
            report = run_library(self.root, self.model)
            job.update(status='succeeded', summary={k: report[k] for k in
                ('run_id', 'chunks', 'cached_documents', 'new_embedding_chunks', 'status_counts', 'ready_for_production')},
                report_path='indexes/' + report['run_id'] + '/REPORT.md')
        except Exception as exc:
            job.update(status='failed', error=type(exc).__name__ + ': ' + str(exc))
        finally:
            job['finished_at'] = now()
            atomic_json(path, job)
            with self.guard:
                self.active = None

    def get(self, job_id):
        if not re.fullmatch(r'[0-9a-f]{32}', job_id):
            return None
        path = self.folder / (job_id + '.json')
        return json.loads(path.read_text(encoding='utf-8')) if path.exists() else None

    def close(self):
        if self.worker is not None:
            self.worker.join()


def make_server(root, token, model_factory, host='127.0.0.1', port=18592):
    if not token or len(token) < 24 or not token.isascii():
        raise ValueError('RAG_INGESTION_TOKEN must contain at least 24 ASCII characters')
    manager = JobManager(root, model_factory)

    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, fmt, *args):
            # Do not log Authorization, request contents or document text.
            pass

        def respond(self, status, data):
            content = json.dumps(data, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(content)

        def authenticated(self):
            supplied = self.headers.get('Authorization', '').encode('utf-8')
            if not hmac.compare_digest(supplied, ('Bearer ' + token).encode('ascii')):
                self.respond(401, {'error': 'unauthorized'})
                return False
            return True

        def do_POST(self):
            if not self.authenticated():
                return
            if self.path != '/v1/jobs':
                self.respond(404, {'error': 'not_found'})
                return
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if length > 4096:
                    self.respond(413, {'error': 'request_too_large'})
                    return
                if length < 0 or self.headers.get('Transfer-Encoding'):
                    raise ValueError('Unsupported request encoding')
                body = json.loads(self.rfile.read(length) or b'{}')
                if not isinstance(body, dict) or set(body) - {'action'} or body.get('action', 'scan') != 'scan':
                    raise ValueError('Only the fixed scan action is supported')
                job = manager.submit()
                self.respond(202, job)
            except BusyError:
                self.respond(409, {'error': 'job_already_running'})
            except (ValueError, UnicodeError):
                self.respond(400, {'error': 'invalid_request'})

        def do_GET(self):
            if not self.authenticated():
                return
            if self.path == '/v1/health':
                self.respond(200, {'status': 'ok', 'storage': 'local_pending_index'})
                return
            prefix = '/v1/jobs/'
            job = manager.get(self.path[len(prefix):]) if self.path.startswith(prefix) else None
            self.respond(200 if job else 404, job or {'error': 'not_found'})

    server = ThreadingHTTPServer((host, port), Handler)
    server.manager = manager
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT / 'library')
    parser.add_argument('--model-dir', type=Path, default=ROOT / 'models/minilm')
    parser.add_argument('--host', choices=['127.0.0.1', '0.0.0.0'], default='127.0.0.1')
    parser.add_argument('--port', type=int, default=18592)
    args = parser.parse_args()

    def load_model():
        model = LocalEmbedder(args.model_dir)
        model.dimension = model.manifest['dimension']
        return model

    server = make_server(args.root, os.environ.get('RAG_INGESTION_TOKEN', ''), load_model, args.host, args.port)
    print(json.dumps({'listening': args.host, 'port': server.server_address[1], 'mode': 'pending-only-local-index'}), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        server.manager.close()


if __name__ == '__main__':
    main()
