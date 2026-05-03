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
  downUrl?: string | null;
  name?: string | null;
  createdAt?: string | null;
}
