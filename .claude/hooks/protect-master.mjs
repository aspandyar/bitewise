// PreToolUse hook for Bash: blocks commands that would change master. Only the owner merges
// into master, through a PR; merges and pushes between other branches go through untouched.
// Permission patterns can't do this: they match the command's prefix (so `git -C dir merge`
// slips past) and can't see which branch is checked out or where a PR merges.
// Exit 2 blocks the call and shows stderr to Claude; exit 0 lets it run.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PROTECTED = 'master'
// While on master these rewrite its history; `pull --ff-only` only catches up with origin.
const HISTORY_COMMANDS = new Set(['commit', 'merge', 'rebase', 'cherry-pick', 'revert', 'am', 'pull'])
// Git options that take the next word as their value.
const GIT_VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path'])

function deny(reason) {
  process.stderr.write(`protect-master: ${reason}. Only the owner merges into ${PROTECTED}, through a PR.\n`)
  process.exit(2)
}

// Splits a command line into segments of words: quotes respected, `&& || ; | &` and newlines split.
function segments(line) {
  const out = [[]]
  let word = ''
  let quote = null
  let hasWord = false
  const push = () => {
    if (hasWord) out[out.length - 1].push(word)
    word = ''
    hasWord = false
  }
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
      else if (ch === '\\' && quote === '"' && i + 1 < line.length) word += line[++i]
      else word += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      hasWord = true
    } else if (ch === '\\' && i + 1 < line.length) {
      word += line[++i]
      hasWord = true
    } else if (/\s/.test(ch) && ch !== '\n') {
      push()
    } else if (ch === '\n' || ch === ';' || ch === '|' || ch === '&') {
      push()
      while (i + 1 < line.length && /[|&]/.test(line[i + 1])) i++
      out.push([])
    } else {
      word += ch
      hasWord = true
    }
  }
  push()
  return out.filter(s => s.length > 0)
}

function currentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'symbolic-ref', '--short', '-q', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

// `master`, `HEAD:master`, `+feat:refs/heads/master`, `:master` (a delete) all land on master.
const targetsProtected = refspec => {
  const dst = (refspec.includes(':') ? refspec.slice(refspec.lastIndexOf(':') + 1) : refspec).replace(/^\+/, '')
  return dst === PROTECTED || dst === `refs/heads/${PROTECTED}`
}

function checkGit(words, dir) {
  let i = 1
  let gitDir = dir
  while (i < words.length && words[i].startsWith('-')) {
    const opt = words[i]
    if (opt === '-C' && i + 1 < words.length) gitDir = resolve(gitDir, words[i + 1])
    i += GIT_VALUE_OPTIONS.has(opt) ? 2 : 1
  }
  const sub = words[i]
  const args = words.slice(i + 1)
  if (sub === undefined) return

  if (HISTORY_COMMANDS.has(sub)) {
    if (sub === 'pull' && args.includes('--ff-only')) return
    if (sub === 'merge' && (args.includes('--abort') || args.includes('--quit'))) return
    if (sub === 'rebase' && (args.includes('--abort') || args.includes('--quit'))) return
    if (currentBranch(gitDir) === PROTECTED) deny(`\`git ${sub}\` while on ${PROTECTED} would change it`)
    return
  }

  if (sub === 'push') {
    if (args.includes('--all') || args.includes('--mirror')) deny('`git push --all/--mirror` would push master too')
    const deleting = args.includes('--delete') || args.includes('-d')
    const positional = args.filter(a => !a.startsWith('-'))
    const refspecs = positional.slice(1)
    if (refspecs.some(r => targetsProtected(r) || (deleting && r === PROTECTED))) deny(`\`git push\` to ${PROTECTED}`)
    // No refspec: git pushes the current branch.
    if (refspecs.length === 0 && currentBranch(gitDir) === PROTECTED) deny(`\`git push\` from ${PROTECTED} pushes it`)
  }
}

function checkGh(words, dir) {
  if (words[1] !== 'pr' || words[2] !== 'merge') return
  const target = words.slice(3).find(a => !a.startsWith('-'))
  let base = ''
  try {
    base = execFileSync('gh', ['pr', 'view', ...(target ? [target] : []), '--json', 'baseRefName', '-q', '.baseRefName'], {
      cwd: dir,
      encoding: 'utf8',
    }).trim()
  } catch {
    // Can't tell where it merges: refuse rather than risk master.
    deny("`gh pr merge`: couldn't read the PR's base branch")
  }
  if (base === PROTECTED) deny(`\`gh pr merge\` into ${PROTECTED}`)
}

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}
const command = input?.tool_input?.command
if (typeof command !== 'string') process.exit(0)

let dir = typeof input.cwd === 'string' && input.cwd !== '' ? input.cwd : process.cwd()
for (const raw of segments(command)) {
  // Leading `VAR=value` assignments and `command`/`env` wrappers don't change what runs.
  const start = raw.findIndex(w => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) && w !== 'command' && w !== 'env')
  if (start < 0) continue
  const words = raw.slice(start)
  const tool = (words[0] ?? '').split('/').pop()
  if (tool === 'cd' && words[1]) dir = resolve(dir, words[1].replace(/^~(?=$|\/)/, process.env.HOME ?? '~'))
  else if (tool === 'git') checkGit(words, dir)
  else if (tool === 'gh') checkGh(words, dir)
}
process.exit(0)
