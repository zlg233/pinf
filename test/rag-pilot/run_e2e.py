"""Run actual local embedding retrieval and (when installed) local GGUF generation."""
import argparse
import json
import subprocess
import time
import urllib.error
import urllib.request

from pilot import ROOT, LocalEmbedder, VectorIndex, generation_prompt, validate_answer, query_scope

CASES = [
    ('早产儿是如何定义的？', [104], ['胎龄<37周']),
    ('低危早产儿有哪些条件？', [104], ['胎龄≥34周', '≥2000克']),
    ('哪些情况属于高危早产儿？', [104], ['胎龄<34周', '<2000克']),
    ('矫正年龄通常使用到多少月龄？', [104], ['24月龄', '36月龄', '小于28周']),
    ('早产儿出院后登记建档要了解哪些情况？', [108, 109], ['首次随访时了解家庭基本信息']),
    ('发现体格生长偏离正常曲线后如何处理？', [109], ['连续监测2次无明显改善或原因不清，及时转诊']),
    ('居家护理怎样预防感染？', [110], ['居室每日开窗通风', '保持脐部干爽清洁']),
    ('家庭早期发展促进应该避免什么？', [110], ['避免违背发育规律的过度干预']),
    ('老年糖尿病人如何调整胰岛素？', [], []),
    ('如何购买火车票？', [], []),
]


def post_json(url, payload):
    request = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.load(response)


def main(generate):
    out = ROOT / 'outputs'
    embedder = LocalEmbedder(ROOT / 'models/minilm')
    index = VectorIndex(out / 'vectors.sqlite', embedder.model_id, 384)
    vectors = embedder.encode([q for q, _, _ in CASES])
    records = []
    for (question, expected, expected_terms), vector in zip(CASES, vectors):
        # 0.4 is an experimental constant, NOT a calibrated medical reliability threshold.
        raw_hits = index.search(vector, allow_pending=True, threshold=0.4, limit=5)
        raw_pages = [h['pdf_page'] for h in raw_hits]
        raw_text = '\n'.join(h['parent_text'] for h in raw_hits)
        raw_passed = bool(set(raw_pages) & set(expected)) and all(t in raw_text for t in expected_terms) if expected else not raw_hits
        scope = query_scope(question)
        hits = raw_hits if scope == 'compatible' else []
        pages = [h['pdf_page'] for h in hits]
        evidence_text = '\n'.join(h['parent_text'] for h in hits)
        passed = bool(set(pages) & set(expected)) and all(t in evidence_text for t in expected_terms) if expected else not hits
        records.append({'question': question, 'expected_pdf_pages': expected, 'expected_evidence_terms': expected_terms, 'raw_retrieved_pdf_pages': raw_pages,
                        'raw_vector_pass': raw_passed, 'scope': scope, 'retrieved_pdf_pages': pages,
                        'retrieval_pass': passed, 'hits': hits, 'answer_status': 'not_run'})

    server = None
    log_file = None
    try:
        if generate:
            executable = next((ROOT / 'runtime/llama-cpu').rglob('llama-server.exe'))
            model = ROOT / 'models/qwen/qwen2.5-0.5b-instruct-q4_k_m.gguf'
            log_file = (out / 'generation-server.log').open('w', encoding='utf-8')
            server = subprocess.Popen([str(executable), '-m', str(model), '--host', '127.0.0.1', '--port', '18591',
                                       '--alias', 'local-qwen', '-c', '4096', '--parallel', '1', '-t', '4', '--n-gpu-layers', '0'],
                                      stdout=log_file, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
            for _ in range(90):
                if server.poll() is not None:
                    raise RuntimeError('Local generation server exited; see generation-server.log')
                try:
                    with urllib.request.urlopen('http://127.0.0.1:18591/health', timeout=2) as response:
                        if response.status == 200:
                            break
                except (urllib.error.URLError, TimeoutError):
                    time.sleep(1)
            else:
                raise TimeoutError('Local generation server did not become ready')

        for i, record in enumerate(records):
            context = generation_prompt(record['question'], record['hits'])
            if context is None:
                status = 'insufficient_evidence' if record['scope'] == 'compatible' else record['scope']
                answer = '当前试验资料没有检索到足够依据，无法回答。' if status == 'insufficient_evidence' else '本试验库仅含早产儿资料，不能据此回答其他患者人群的医疗问题。'
                record.update(answer_status=status, answer=answer, citations=[])
            elif generate and i in [0, 3, 6]:
                response = post_json('http://127.0.0.1:18591/v1/chat/completions', {
                    'model': 'local-qwen', 'messages': context['messages'], 'temperature': 0,
                    'max_tokens': 280, 'seed': 42, 'stream': False})
                answer = response['choices'][0]['message']['content']
                if response['choices'][0].get('finish_reason') == 'length':
                    record.update(answer_status='rejected_truncated_output', answer=answer, citations=context['citations'])
                    continue
                try:
                    answer = validate_answer(answer, context['citations'])
                    record.update(answer_status='generated_unreviewed', answer=answer, citations=context['citations'])
                except ValueError as error:
                    record.update(answer_status='rejected_invalid_output', answer=answer, error=str(error), citations=context['citations'])
            elif context:
                record.update(answer_status='retrieval_only', citations=context['citations'])
            print(json.dumps({k: v for k, v in record.items() if k != 'hits'}, ensure_ascii=False), flush=True)
    finally:
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()
        if log_file is not None:
            log_file.close()

    report = {'experimental': True, 'pending_clinical_review': True, 'model': embedder.model_id,
              'generation_model': 'Qwen/Qwen2.5-0.5B-Instruct-GGUF Q4_K_M' if generate else None,
              'retrieval_cases': len(records), 'raw_vector_passed': sum(r['raw_vector_pass'] for r in records),
              'retrieval_passed': sum(r['retrieval_pass'] for r in records),
              'generation_attempts': sum('answer' in r and r['answer_status'] not in ['unsupported_population', 'needs_clarification', 'insufficient_evidence'] for r in records),
              'generation_cases': sum(r['answer_status'] == 'generated_unreviewed' for r in records),
              'formal_query_hits': len(index.search(vectors[0])), 'cases': records}
    (out / 'e2e-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    ingestion = json.loads((out / 'ingestion-report.json').read_text(encoding='utf-8'))
    lines = ['# PRE-004～006 本地 RAG 试验报告', '', '本报告仅验证流程；资料为2017年原文，尚未完成护理团队审核。', '',
             '## 试验数据', '',
             f"- 官方原文：{ingestion['source_url']}",
             f"- 自动提取：PDF第103～110页；111页表格、112页流程图保留人工核对。",
             f"- 段落单元：{ingestion['source_units']}；知识片段：{ingestion['chunks']}；向量维度：{ingestion['dimension']}。",
             f"- 重复导入后条数：{ingestion['duplicate_import_count']}；正式审核条件下命中数：{report['formal_query_hits']}。",
             '- 存储：本地SQLite保存向量，NumPy精确余弦检索；没有写入服务器pgvector或修改n8n。',
             f"- 向量模型：{report['model']}", f"- 回答模型：{report['generation_model']}", '',
             f"裸向量检索：{report['raw_vector_passed']}/{report['retrieval_cases']}；加入实验级人群约束后：{report['retrieval_passed']}/{report['retrieval_cases']}；本地生成尝试：{report['generation_attempts']}次，格式校验通过且待审核：{report['generation_cases']}次。", '',
             '这些结果只针对下列小样本，不能解释为临床准确率。人群规则没有覆盖全部复杂问题；页码与关键词命中也不能证明答案忠实。', '',
             '## 用例与实际结果', '']
    for record in records:
        lines.extend([f"### {record['question']}", f"- 预期PDF页：{record['expected_pdf_pages']}",
                      f"- 预期证据要点：{record['expected_evidence_terms']}",
                      f"- 裸向量检索PDF页：{record['raw_retrieved_pdf_pages']}", f"- 人群约束：{record['scope']}",
                      f"- 实际PDF页：{record['retrieved_pdf_pages']}", f"- 检索测试：{'通过' if record['retrieval_pass'] else '未通过'}",
                      f"- 回答阶段：{record['answer_status']}", '', record.get('answer', '仅测试检索，未调用生成模型。'), ''])
        for hit in record['hits'][:2]:
            lines.extend([f"证据：PDF第{hit['pdf_page']}页，印刷第{hit['printed_page']}页，{','.join(hit['source_ids'])}，相似度{hit['score']}。", '', hit['parent_text'], ''])
    (out / 'REPORT.md').write_text('\n'.join(lines), encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'cases'}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--generate', action='store_true')
    main(parser.parse_args().generate)
