import { expect, test } from 'bun:test';

const { USER_AGREEMENT, PRIVACY_POLICY, CONTACT_EMAIL, OPERATOR_NAME } = await import(
  '../src/domain/legal/documents'
);
const { CONSENT_REQUIRED_MESSAGE, ensureConsent } = await import('../src/domain/legal/consent');

const flatten = (doc: any): string =>
  [
    doc.title,
    doc.updatedAt,
    ...doc.sections.flatMap((section: any) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.bullets ?? []),
    ]),
  ].join('\n');

const termsText = flatten(USER_AGREEMENT);
const privacyText = flatten(PRIVACY_POLICY);

test('两份协议都有标题、更新日期和足够章节', () => {
  for (const doc of [USER_AGREEMENT, PRIVACY_POLICY]) {
    expect(doc.title.length).toBeGreaterThan(3);
    expect(doc.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(doc.sections.length).toBeGreaterThanOrEqual(6);
  }
});

test('隐私政策逐项覆盖小程序实际收集的信息', () => {
  for (const keyword of [
    '手机号',
    'openid',
    '昵称',
    '出生日期',
    '预产期',
    '胎龄',
    '生长记录',
    '预约',
    '问答',
  ]) {
    expect(privacyText).toContain(keyword);
  }
});

test('隐私政策写明第三方服务：微信与第三方大模型', () => {
  expect(privacyText).toContain('微信');
  expect(privacyText).toContain('大模型');
});

test('隐私政策写明查阅、删除与注销的渠道', () => {
  expect(privacyText).toContain('删除');
  expect(privacyText).toContain('注销');
  expect(privacyText).toContain(CONTACT_EMAIL);
});

test('隐私政策覆盖监护人责任与撤回同意', () => {
  expect(privacyText).toContain('监护人');
  expect(privacyText).toContain('撤回同意');
});

test('用户协议明确不构成医疗诊断', () => {
  expect(termsText).toContain('不构成医疗诊断');
  expect(termsText).toContain(CONTACT_EMAIL);
});

test('不编造主体资质、认证或安全承诺', () => {
  for (const claim of ['ISO', '等保', '已认证', '已备案', 'CMMI', '安全认证']) {
    expect(termsText).not.toContain(claim);
    expect(privacyText).not.toContain(claim);
  }
});

test('运营者与联系邮箱取自方案已确认的信息', () => {
  expect(OPERATOR_NAME).toBe('萌芽护航团队');
  expect(CONTACT_EMAIL).toBe('23klin@stu.edu.cn');
});

test('未勾选同意时返回提示，勾选后放行', () => {
  expect(ensureConsent(false)).toBe(CONSENT_REQUIRED_MESSAGE);
  expect(ensureConsent(true)).toBeNull();
  expect(CONSENT_REQUIRED_MESSAGE).toContain('用户服务协议');
  expect(CONSENT_REQUIRED_MESSAGE).toContain('隐私政策');
});
