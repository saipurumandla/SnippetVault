export type { Visibility, EncryptionMode, Snippet, Project } from '@snippetvault/api-client';
export type AiAction = 'explain' | 'summarize' | 'refactor' | 'convert';
export type ToastType = 'success' | 'error' | 'info' | 'warning';

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

export type TokenScope = 'read' | 'propose' | 'write';

export interface AccessToken {
  id: number;
  name: string;
  prefix: string;
  scopes: TokenScope[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface Draft {
  id: number;
  source: string;
  title: string;
  description: string | null;
  code: string;
  language: string;
  tags: string[];
  status: 'pending' | 'accepted' | 'rejected';
  snippet_id: number | null;
  created_at: string;
  possible_secret?: boolean;
}
