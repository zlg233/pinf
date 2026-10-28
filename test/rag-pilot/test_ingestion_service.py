import json
from pathlib import Path
import tempfile
import threading
import time
import unittest

import requests

import ingestion_service as service
from test_ingestion import CountingEmbedder, write_docx


class TestJobHTTP(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent / 'outputs')
        self.root = Path(self.temp.name)
        (self.root / 'inbox').mkdir()
        write_docx(self.root / 'inbox/指南.docx')
        self.token = 'local-test-token-with-no-real-secret'
        self.server = service.make_server(self.root, self.token, CountingEmbedder, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:' + str(self.server.server_address[1])
        self.headers = {'Authorization': 'Bearer ' + self.token}
        self.addCleanup(self.cleanup_server)

    def cleanup_server(self):
        self.server.shutdown()
        self.server.manager.close()
        self.server.server_close()
        self.thread.join(3)
        self.temp.cleanup()

    def test_no_token_cannot_submit_or_read_jobs(self):
        self.assertEqual(requests.post(self.url + '/v1/jobs', json={}, timeout=3).status_code, 401)
        self.assertEqual(requests.get(self.url + '/v1/jobs/unknown', timeout=3).status_code, 401)

    def test_submit_and_poll_real_ingestion_without_exposing_token(self):
        r = requests.post(self.url + '/v1/jobs', json={'action': 'scan'}, headers=self.headers, timeout=3)
        self.assertEqual(r.status_code, 202)
        job_id = r.json()['job_id']
        for _ in range(100):
            status = requests.get(self.url + '/v1/jobs/' + job_id, headers=self.headers, timeout=3)
            self.assertEqual(status.status_code, 200)
            if status.json()['status'] in ('succeeded', 'failed'):
                break
            time.sleep(.02)
        result = status.json()
        self.assertEqual(result['status'], 'succeeded')
        self.assertEqual(result['summary']['chunks'], 1)
        self.assertFalse(result['summary']['ready_for_production'])
        self.assertNotIn(self.token, json.dumps(result))

    def test_unknown_or_arbitrary_path_arguments_are_rejected(self):
        r = requests.post(self.url + '/v1/jobs', json={'root': 'C:/Windows'}, headers=self.headers, timeout=3)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(requests.get(self.url + '/v1/jobs/not-a-job', headers=self.headers, timeout=3).status_code, 404)

    def test_oversized_or_invalid_json_is_rejected(self):
        r = requests.post(self.url + '/v1/jobs', data='x' * 4097, headers=self.headers, timeout=3)
        self.assertEqual(r.status_code, 413)
        r = requests.post(self.url + '/v1/jobs', data='{broken', headers=self.headers, timeout=3)
        self.assertEqual(r.status_code, 400)

    def test_missing_or_short_token_refuses_service_start(self):
        with self.assertRaises(ValueError):
            service.make_server(self.root, '', CountingEmbedder, port=0)

    def test_second_submission_is_rejected_while_real_job_is_queued(self):
        entered, release = threading.Event(), threading.Event()

        def slow_model_factory():
            entered.set()
            release.wait(5)
            return CountingEmbedder()

        self.server.manager.model_factory = slow_model_factory
        self.addCleanup(release.set)
        first = requests.post(self.url + '/v1/jobs', json={}, headers=self.headers, timeout=3)
        self.assertEqual(first.status_code, 202)
        self.assertTrue(entered.wait(2))
        second = requests.post(self.url + '/v1/jobs', json={}, headers=self.headers, timeout=3)
        self.assertEqual(second.status_code, 409)
        release.set()

    def test_job_failure_is_persisted_and_reported_as_failure(self):
        lock = self.root / '.ingestion.lock'
        lock.write_text('another-process', encoding='utf-8')
        try:
            r = requests.post(self.url + '/v1/jobs', json={}, headers=self.headers, timeout=3)
            self.assertEqual(r.status_code, 202)
            for _ in range(100):
                result = requests.get(self.url + '/v1/jobs/' + r.json()['job_id'], headers=self.headers, timeout=3).json()
                if result['status'] == 'failed':
                    break
                time.sleep(.02)
            self.assertEqual(result['status'], 'failed')
            self.assertIn('BusyError', result['error'])
            stored = json.loads((self.root / 'runs/jobs' / (result['job_id'] + '.json')).read_text(encoding='utf-8'))
            self.assertEqual(stored['status'], 'failed')
        finally:
            lock.unlink()

    def test_n8n_template_is_inactive_and_has_bounded_polling(self):
        data = json.loads((Path(__file__).parent / 'n8n-ingestion-workflow.json').read_text(encoding='utf-8'))
        self.assertIs(data['active'], False)
        nodes = {n['name']: n for n in data['nodes']}
        self.assertIn('Poll budget', nodes)
        self.assertIn('Timeout', nodes)
        self.assertIn('Failure', nodes)
        self.assertIn('Schedule Trigger', nodes)
        for node in nodes.values():
            self.assertNotIn('credentials', node)
        self.assertNotIn(self.token, json.dumps(data))


if __name__ == '__main__':
    unittest.main()
