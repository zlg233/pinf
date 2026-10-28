import React from 'react';

import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { USER_AGREEMENT } from '@/domain/legal/documents';

import './index.scss';

export default function TermsPage() {
  return <LegalDocumentView document={USER_AGREEMENT} />;
}
