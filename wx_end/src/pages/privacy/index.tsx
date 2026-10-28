import React from 'react';

import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { PRIVACY_POLICY } from '@/domain/legal/documents';

import './index.scss';

export default function PrivacyPage() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}
