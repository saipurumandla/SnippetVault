# sv, the command line

Save and find snippets without leaving the terminal. `sv` talks to your SnippetVault
server with an access token, the same server the web app uses.

## Install

From the repo:

```bash
npm run build
npm link -w @snippetvault/cli
```

Or take `snippetvault-cli-3.2.0.tgz` from the CI artifacts of a build:

```bash
npm install -g ./snippetvault-cli-3.2.0.tgz
```

Needs Node 24 or newer.

## Log in

Make a token in the web app under **Access tokens**. Pick `read` to search, add
`write` to save.

```bash
sv login                         # asks for the token
sv login --url http://vault.lan:3001 < token.txt
```

The url and token go to `~/.config/snippetvault/config.json` (folder `0700`, file
`0600`). `SNIPPETVAULT_URL` and `SNIPPETVAULT_TOKEN` win over the file, handy in CI.

## Save

```bash
sv save scripts/cleanup.sh --tag ops --tag shell
git diff | sv save -t "Fix for the date bug" -l plaintext
sv save query.sql -t "Monthly active users" -d "used in the board report" -p 3
```

| Option | Default |
|---|---|
| `-t, --title` | file name. Needed for stdin |
| `-l, --lang` | from the file extension, then the `#!` line, else `plaintext` |
| `--tag` | none, can repeat |
| `-d, --desc` `-p, --project` `--visibility` | none, `private` |

## Find and get

```bash
sv find retry                    # search title, description and code
sv find --tag http -l typescript
sv get 12                        # prints the code, nothing else
sv get 12 > retry.ts
sv get 12 --copy                 # to clipboard, counts as a copy
```

For scripts, `--json` on `find` and `get` prints the full objects:

```bash
sv find docker --json | jq -r '.[].title'
```

## Good to know

- Sensitive snippets never show up in `sv`. It cant decrypt them, they open only in
  the web app.
- `--copy` on Linux needs `wl-copy` (Wayland) or `xsel` (X11).
- Errors go to stderr and the exit code is `1`. Colour only for errors, and none
  when `NO_COLOR` is set or output is not a terminal.
- A revoked token stops working on the next command.
