export interface ContentPagination {
  page: number;
  perPage: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ContentArticle {
  id: number;
  title: string;
  content: string;
  sourceUrl?: string | null;
  coverUrl?: string | null;
  author?: string | null;
  category?: string | null;
  publishDate?: string | null;
  tags: string[];
}

export interface ContentVideo {
  id: number;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  downUrl?: string | null;
  playUrl?: string | null;
  name?: string | null;
  // 出院状态分类：入院时 / 住院期间 / 出院当天 / 出院后；null 表示未分类
  category?: string | null;
  createdAt?: string | null;
}
