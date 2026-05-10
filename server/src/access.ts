// what agents and rag may read: own, shared, project
// never sensitive, never expired. pair with readableParams()
export const READABLE = `(s.author_id = ? OR s.visibility = 'shared'
    OR (s.visibility = 'project' AND s.project_id IN (
      SELECT project_id FROM project_members WHERE user_id = ?
    ))
  )
  AND s.encryption_mode = 'standard'
  AND (s.expires_at IS NULL OR s.expires_at > ?)`;

export function readableParams(userId: number): [number, number, string] {
  return [userId, userId, new Date().toISOString()];
}
