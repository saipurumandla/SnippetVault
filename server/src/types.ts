export interface AuthUser {
  id: number;
  email: string;
}

export type Visibility = 'private' | 'project' | 'shared';
export type EncryptionMode = 'standard' | 'sensitive';

export interface SnippetRow {
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
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: { id: number; name: string; scopes: string[] };
    }
  }
}
