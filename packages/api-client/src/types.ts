export type Visibility = 'private' | 'project' | 'shared';
export type EncryptionMode = 'standard' | 'sensitive';

export interface Snippet {
  id: number;
  title: string;
  description: string | null;
  code: string;
  language: string;
  visibility: Visibility;
  encryption_mode: EncryptionMode;
  wrapped_key: string | null;
  project_id: number | null;
  author_id: number;
  copy_count: number;
  is_favourite: number;
  expires_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: string;
}

export interface NewSnippet {
  title: string;
  code: string;
  language: string;
  description?: string;
  visibility?: Visibility;
  encryption_mode?: EncryptionMode;
  wrapped_key?: string;
  project_id?: number;
  expires_at?: string;
}

export interface SnippetQuery {
  q?: string;
  language?: string;
  project_id?: number;
}
