export type Visibility = 'private' | 'project' | 'shared';
export type EncryptionMode = 'standard' | 'sensitive';
export type AiAction = 'explain' | 'summarize' | 'refactor' | 'convert';
export type ToastType = 'success' | 'error' | 'info' | 'warning';

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

export interface Citation {
  snippetId: number;
  title: string;
  language?: string;
}

export interface SecurityEvent {
  id: number;
  user_id: number | null;
  event_type: string;
  snippet_id: number | null;
  meta: string | null;
  created_at: string;
}

export interface UserSummary {
  id: number;
  email: string;
  enc_public_key: string | null;
}

export type TokenScope = 'read' | 'propose';

export interface AccessToken {
  id: number;
  name: string;
  prefix: string;
  scopes: TokenScope[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}
