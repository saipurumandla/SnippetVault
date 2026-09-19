import { useState } from 'react';
import { Archive, FilePlus, Lock, FolderOpen, Search, Sparkles, HardDrive, ShieldCheck, Plug, Terminal, type LucideIcon } from 'lucide-react';
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
      { type: 'p', text: 'SnippetVault is a self-hosted snippet manager for developer teams. All data is in one local SQLite file. No cloud account.' },
      { type: 'p', text: 'Monaco editor, full-text and semantic search, projects, tags, a command palette (Ctrl K), sensitive snippets encrypted in the browser, and an assistant that runs on your own Ollama.' },
      { type: 'list', items: ['SQLite file, everything local', 'Standard snippets: plain text, access by visibility', 'Sensitive snippets: encrypted in the browser', 'Assistant on local Ollama, code stays on your machine'] },
    ],
  },
  {
    id: 'snippets',
    Icon: FilePlus,
    title: 'Creating & editing snippets',
    body: [
      { type: 'p', text: 'Press N, click New snippet at the top right, or use Ctrl K and pick New snippet.' },
      { type: 'heading', text: 'Fields' },
      { type: 'list', items: ['Title — required, shows in the list and in search', 'Description — optional, appears under the title', 'Language — sets Monaco syntax highlighting', 'Tags — type and press Enter to add; backspace removes last tag', 'Project — assigns the snippet to a workspace', 'Visibility — Private, Project, or Shared', 'Encryption mode — Standard or Sensitive'] },
      { type: 'heading', text: 'Saving' },
      { type: 'p', text: 'Save snippet writes it to the database. Tags are saved right after, in separate requests.' },
      { type: 'heading', text: 'Editing' },
      { type: 'p', text: 'Open a snippet and click Edit. When the code changes, the old code is kept as a version.' },
    ],
  },
  {
    id: 'encryption',
    Icon: Lock,
    title: 'Encryption explained',
    body: [
      { type: 'heading', text: 'Standard mode (default)' },
      { type: 'p', text: 'Standard snippets are stored as plain text in SQLite. Visibility decides who can read them. The server can search them and the assistant can use them.' },
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
      { type: 'p', text: 'Go to Projects and click New project. You become the owner and first member.' },
      { type: 'heading', text: 'Adding members' },
      { type: 'p', text: 'Type a teammate\'s email in the Add member column and press Add. They need an account on this instance first.' },
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
      { type: 'p', text: 'The search box (press /) uses SQLite FTS5 over titles, descriptions and code. It works together with the filters.' },
      { type: 'heading', text: 'Language & tag filters' },
      { type: 'p', text: 'Use the Language, Project and Tag menus above the list. Clear resets them. Up and down arrows move in the list, Enter opens the snippet.' },
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
      { type: 'p', text: 'Click Ask your vault above the list and ask a question in plain words. Click a source to preview that snippet.' },
      { type: 'p', text: 'Retrieval combines BM25 (keyword match over FTS5) with vector similarity using locally-generated embeddings. Answers are generated by Ollama and must cite source snippets — uncited answers are blocked.' },
      { type: 'heading', text: 'Per-snippet assistant (detail view)' },
      { type: 'list', items: ['Explain — plain-English breakdown of what the code does', 'Summarize — 2–3 sentence summary', 'Refactor draft — one suggested improvement (you must accept explicitly)'] },
      { type: 'heading', text: 'Setup' },
      { type: 'p', text: 'Start Ollama. New and edited snippets are indexed when saved. To rebuild the whole index run npm run index from the project root.' },
      { type: 'heading', text: 'Safety rules' },
      { type: 'list', items: ['Sensitive encrypted snippets excluded from AI paths', 'Prompt-injection patterns refused before retrieval', 'Secret-like tokens redacted from responses', 'Uncited answers blocked from rendering'] },
    ],
  },
  {
    id: 'agents',
    Icon: Plug,
    title: 'Agents (MCP)',
    body: [
      { type: 'p', text: 'Cursor, VS Code and other MCP clients can search your snippets, read them and suggest new ones. They never save or change a snippet by themselves.' },
      { type: 'heading', text: 'Connect' },
      { type: 'list', items: ['Open Access tokens and make a token. read lets the agent search and read, propose lets it suggest snippets', 'Over HTTP: point the client at http://localhost:3001/mcp with the header Authorization: Bearer sv_...', 'Without a running server: point the agent at server/dist/mcp/stdio.js with SNIPPETVAULT_TOKEN and DB_PATH', 'Full setup for Cursor and VS Code is in docs/mcp.md in the repo'] },
      { type: 'heading', text: 'Drafts' },
      { type: 'p', text: 'A suggested snippet waits in Drafts. Accept saves it as a private snippet, Edit, then accept opens it in the editor first, Reject throws it away. If the code looks like it has a secret in it, Drafts warns you, use Edit, then accept and pick Sensitive.' },
      { type: 'heading', text: 'What agents never see' },
      { type: 'list', items: ['Sensitive snippets: not in search, not by id, not their tags', 'Expired snippets and private snippets of other people', 'Every tool call is in Security events with the token name. 60 calls a minute per token'] },
    ],
  },
  {
    id: 'everywhere',
    Icon: Terminal,
    title: 'Terminal and VS Code',
    body: [
      { type: 'p', text: 'The sv command and the VS Code extension use the same vault with an access token. Make one under Access tokens with read, and write if you want to save.' },
      { type: 'heading', text: 'sv' },
      { type: 'list', items: ['sv login, then paste the token', 'sv save file.sh --tag ops, or pipe code in with -t "title"', 'sv find words, sv get 12, sv get 12 --copy', '--json on find and get for scripts'] },
      { type: 'heading', text: 'VS Code' },
      { type: 'list', items: ['SnippetVault: Set access token, then Search vault, Insert snippet or Save selection as snippet', 'Hover snippetvault://12 in any file to see snippet 12', 'Setup for both is in docs/cli.md and docs/vscode.md in the repo'] },
      { type: 'p', text: 'Sensitive snippets never show up in the terminal or the editor. They open only here, in the web app.' },
    ],
  },
  {
    id: 'backup',
    Icon: HardDrive,
    title: 'Backup & restore',
    body: [
      { type: 'p', text: 'Go to Backup in the sidebar.' },
      { type: 'heading', text: 'Export' },
      { type: 'p', text: 'Downloads a .enc file encrypted with AES-256-GCM. The server derives the key from your passphrase with scrypt, so use a passphrase only for backups. Only standard snippets are included.' },
      { type: 'heading', text: 'Restore' },
      { type: 'p', text: 'Upload a .enc file and enter the original passphrase. Snippets are imported with INSERT OR IGNORE — existing snippets are not overwritten.' },
    ],
  },
  {
    id: 'security',
    Icon: ShieldCheck,
    title: 'Security event log',
    body: [
      { type: 'p', text: 'Sharing a sensitive snippet is recorded here, with the time and how many people it went to. Go to Security in the sidebar to see it.' },
      { type: 'p', text: 'The app only adds to this log, it never edits or deletes events.' },
      { type: 'heading', text: 'Unlock session' },
      { type: 'p', text: 'Sensitive snippet unlock sessions last 15 minutes of inactivity. Session keys are held in memory only — a full page reload clears them.' },
    ],
  },
];

export default function Docs() {
  const [active, setActive] = useState('overview');
  const section = SECTIONS.find(s => s.id === active) ?? SECTIONS[0]!;

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
              <s.Icon size={16} strokeWidth={1.75} />
              {s.title}
            </button>
          ))}
        </aside>

        <main className={styles.content}>
          <h1 className={styles.docTitle}>{section.title}</h1>

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
