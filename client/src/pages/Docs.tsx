import { useState } from 'react';
import { Archive, FilePlus, Lock, FolderOpen, Search, Sparkles, HardDrive, ShieldCheck, type LucideIcon } from 'lucide-react';
import Header from '../components/Header';
import styles from './Docs.module.css';

type Block =
  | { type: 'p' | 'heading'; text: string }
  | { type: 'list'; items: string[] };

interface Section {
  id: string;
  Icon: LucideIcon;
  title: string;
  body: Block[];
}

const SECTIONS: Section[] = [
  {
    id: 'overview',
    Icon: Archive,
    title: 'What is SnippetVault?',
    body: [
      { type: 'p', text: 'SnippetVault is a self-hosted, local-first code snippet manager for developer teams. All data lives in a local SQLite database — no cloud account, no vendor lock-in.' },
      { type: 'p', text: 'Core features: Monaco Editor with syntax highlighting, full-text search, project workspaces, tag filtering, command palette (Ctrl+K), hybrid encryption, and local AI assistance via Ollama.' },
      { type: 'list', items: ['SQLite database — everything local', 'AES-256-GCM encryption for standard snippets', 'Zero-knowledge client-side encryption for sensitive snippets', 'Local Ollama AI — no code leaves your machine'] },
    ],
  },
  {
    id: 'snippets',
    Icon: FilePlus,
    title: 'Creating & editing snippets',
    body: [
      { type: 'p', text: 'Click "+ New Snippet" in the top-right or press Ctrl+K → New Snippet.' },
      { type: 'heading', text: 'Fields' },
      { type: 'list', items: ['Title — required, shows in search and cards', 'Description — optional, appears under the title', 'Language — sets Monaco syntax highlighting', 'Tags — type and press Enter to add; backspace removes last tag', 'Project — assigns the snippet to a workspace', 'Visibility — Private, Project, or Shared', 'Encryption mode — Standard or Sensitive'] },
      { type: 'heading', text: 'Saving' },
      { type: 'p', text: 'Hit "Save snippet" — the snippet is encrypted and written to the database. Tags are synced in separate requests after save.' },
      { type: 'heading', text: 'Editing' },
      { type: 'p', text: 'Open any snippet → click Edit. The form pre-fills with current values. Each save creates a version entry in snippet_versions.' },
    ],
  },
  {
    id: 'encryption',
    Icon: Lock,
    title: 'Encryption explained',
    body: [
      { type: 'heading', text: 'Standard mode (default)' },
      { type: 'p', text: 'Every snippet is encrypted at rest with AES-256-GCM before being written to disk. Each snippet gets a random 256-bit key, which is then wrapped by a project key (or your personal key if no project is set). The server can read and search the content.' },
      { type: 'heading', text: 'Sensitive mode (zero-knowledge)' },
      { type: 'p', text: 'The snippet is encrypted in your browser using libsodium sealed box (X25519 + XSalsa20-Poly1305) before upload. The server stores ciphertext only — it cannot decrypt the content under any circumstances.' },
      { type: 'p', text: 'To enable sensitive mode: go to Settings → Set up encryption to generate a keypair. Your private key is encrypted with your passphrase and stored only in your browser (localStorage). It never leaves your device.' },
      { type: 'heading', text: 'Clipboard safety' },
      { type: 'p', text: 'Copying a sensitive snippet requires a confirmation dialog. A 45-second countdown timer then clears your clipboard automatically.' },
      { type: 'heading', text: 'Expiry' },
      { type: 'p', text: 'Set an expiry date on sensitive snippets for temporary credentials. After expiry the snippet is hidden from all normal views and only visible in the Expired tab.' },
    ],
  },
  {
    id: 'projects',
    Icon: FolderOpen,
    title: 'Projects & teams',
    body: [
      { type: 'p', text: 'Projects let you organise snippets by team, repository, or topic.' },
      { type: 'heading', text: 'Creating a project' },
      { type: 'p', text: 'Go to Projects → New Project. Give it a name and optional description. You\'re automatically added as a member and owner.' },
      { type: 'heading', text: 'Adding members' },
      { type: 'p', text: 'Enter a teammate\'s email in the "Add member" field on the project card. They must already have an account on the same instance.' },
      { type: 'heading', text: 'Visibility' },
      { type: 'list', items: ['Private — only you', 'Project — all project members', 'Shared — every logged-in user on the instance'] },
    ],
  },
  {
    id: 'search',
    Icon: Search,
    title: 'Search & command palette',
    body: [
      { type: 'heading', text: 'Full-text search' },
      { type: 'p', text: 'The search bar at the top uses SQLite FTS5, which searches across snippet titles, descriptions, and code bodies in real time. Results respect your current language/project/tag filters.' },
      { type: 'heading', text: 'Language & tag filters' },
      { type: 'p', text: 'Click any language chip in the left sidebar to filter. Click a tag pill to show only snippets with that tag. Click "Clear filters" to reset.' },
      { type: 'heading', text: 'Command palette  Ctrl+K' },
      { type: 'list', items: ['Fuzzy search across snippet titles', 'Navigate to any project', 'Filter by tag', 'Run actions: New Snippet, New Project, Settings, Docs', 'Arrow keys to navigate, Enter to select, Esc to close'] },
    ],
  },
  {
    id: 'ai',
    Icon: Sparkles,
    title: 'RAG search & AI assistant',
    body: [
      { type: 'heading', text: 'Ask your vault (RAG)' },
      { type: 'p', text: 'Click "✦ Ask AI" in the Vault toolbar to open the question panel. Ask anything about your snippets in natural language.' },
      { type: 'p', text: 'Retrieval combines BM25 (keyword match over FTS5) with vector similarity using locally-generated embeddings. Answers are generated by Ollama and must cite source snippets — uncited answers are blocked.' },
      { type: 'heading', text: 'Per-snippet assistant (detail view)' },
      { type: 'list', items: ['Explain — plain-English breakdown of what the code does', 'Summarize — 2–3 sentence summary', 'Refactor draft — one suggested improvement (you must accept explicitly)'] },
      { type: 'heading', text: 'Setup' },
      { type: 'p', text: 'Start Ollama and run: npm run index (from project root). This chunks and embeds all plaintext snippets. Re-run after adding new snippets.' },
      { type: 'heading', text: 'Safety rules' },
      { type: 'list', items: ['Sensitive encrypted snippets excluded from AI paths', 'Prompt-injection patterns refused before retrieval', 'Secret-like tokens redacted from responses', 'Uncited answers blocked from rendering'] },
    ],
  },
  {
    id: 'backup',
    Icon: HardDrive,
    title: 'Backup & restore',
    body: [
      { type: 'p', text: 'Go to Backup in the sidebar.' },
      { type: 'heading', text: 'Export' },
      { type: 'p', text: 'Downloads an AES-256-GCM encrypted .enc file. Your passphrase is used to derive a key via scrypt — it is never sent to the server. Only standard (non-sensitive) snippets are included.' },
      { type: 'heading', text: 'Restore' },
      { type: 'p', text: 'Upload a .enc file and enter the original passphrase. Snippets are imported with INSERT OR IGNORE — existing snippets are not overwritten.' },
    ],
  },
  {
    id: 'security',
    Icon: ShieldCheck,
    title: 'Security event log',
    body: [
      { type: 'p', text: 'Every significant action is recorded: decrypt, share, export, revoke. Go to Security in the sidebar to view the audit log.' },
      { type: 'p', text: 'Events include: timestamp, event type, and snippet ID where applicable. The log is append-only — no event is ever deleted.' },
      { type: 'heading', text: 'Unlock session' },
      { type: 'p', text: 'Sensitive snippet unlock sessions last 15 minutes of inactivity. Session keys are held in memory only — a full page reload clears them.' },
    ],
  },
];

export default function Docs() {
  const [active, setActive] = useState('overview');
  const section = SECTIONS.find(s => s.id === active) ?? SECTIONS[0]!;
  const { Icon } = section;

  return (
    <div>
      <Header />
      <div className={styles.layout}>
        <aside className={styles.toc}>
          <p className={styles.tocLabel}>Documentation</p>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`${styles.tocItem} ${active === s.id ? styles.tocActive : ''}`}
              onClick={() => setActive(s.id)}
            >
              <s.Icon size={14} />
              {s.title}
            </button>
          ))}
        </aside>

        <main className={styles.content}>
          <div className={styles.docHeader}>
            <div className={styles.docIconWrap}>
              <Icon size={22} />
            </div>
            <h1 className={styles.docTitle}>{section.title}</h1>
          </div>

          <div className={styles.docBody}>
            {section.body.map((block, i) => {
              if (block.type === 'list') return (
                <ul key={i} className={styles.list}>
                  {block.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              );
              if (block.type === 'heading') return <h2 key={i} className={styles.subheading}>{block.text}</h2>;
              return <p key={i} className={styles.para}>{block.text}</p>;
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
