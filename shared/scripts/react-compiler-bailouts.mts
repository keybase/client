// Reports react-compiler bailouts (components/hooks that did NOT get memoized).
// The eslint react-hooks rules only surface rules-of-react violations, not
// "Todo"-category syntax bailouts (e.g. value blocks inside try/catch), so this
// uses the babel plugin's logger to see every compile attempt.
//
// Usage (from shared/):
//   node --experimental-strip-types scripts/react-compiler-bailouts.mts <file-or-dir> [...more]
//   node --experimental-strip-types scripts/react-compiler-bailouts.mts --check .   # exit 1 on any bailout
//
// Common fix: move try/catch out of the component body into a module-level helper.
// Intentional opt-outs ('use no memo') are skipped by the compiler and don't count
// as bailouts.
import * as babel from '@babel/core'
import {readFileSync, readdirSync, statSync} from 'fs'
import {join, extname} from 'path'

type CompilerEvent = {
  kind: string
  fnLoc?: {start?: {line: number}}
  detail?: {options?: {reason?: string; category?: string; loc?: {start?: {line: number}}}}
}

const exts = new Set(['.tsx', '.ts'])
const skipDirs = new Set(['node_modules', '.git', 'dist'])

const collectFiles = (path: string, out: Array<string>) => {
  const st = statSync(path)
  if (st.isDirectory()) {
    if (skipDirs.has(path.split('/').at(-1) ?? '')) return
    for (const entry of readdirSync(path)) {
      collectFiles(join(path, entry), out)
    }
  } else if (exts.has(extname(path)) && !path.endsWith('.d.ts')) {
    out.push(path)
  }
}

const args = process.argv.slice(2)
const checkMode = args.includes('--check')
const targets = args.filter(a => !a.startsWith('--'))
if (targets.length === 0) {
  console.error('usage: react-compiler-bailouts.mts [--check] <file-or-dir> [...more]')
  process.exit(1)
}

const files: Array<string> = []
for (const t of targets) {
  collectFiles(t, files)
}

// The compiler logs a CompileError even for functions opted out via 'use no memo',
// so treat a directive shortly after the function start as intentional. The window is
// generous because the directive sits after the parameter list, which can span many
// lines when props are destructured.
const optOutWindow = 40
const isOptedOut = (sourceLines: Array<string>, fnStartLine: number | undefined) => {
  if (fnStartLine === undefined) return false
  for (let l = fnStartLine - 1; l < Math.min(fnStartLine + optOutWindow, sourceLines.length); l++) {
    if (sourceLines[l]?.includes('use no memo')) return true
  }
  return false
}

let totalOk = 0
let totalBail = 0
let totalOptOut = 0
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const events: Array<CompilerEvent> = []
  try {
    babel.transformSync(source, {
      babelrc: false,
      configFile: false,
      filename: file,
      plugins: [['babel-plugin-react-compiler', {logger: {logEvent: (_: string, e: CompilerEvent) => events.push(e)}}]],
      presets: [['@babel/preset-typescript', {allExtensions: true, isTSX: true}]],
    })
  } catch (e) {
    console.log(`${file}: PARSE FAILED ${e instanceof Error ? e.message.split('\n')[0] : ''}`)
    continue
  }
  const sourceLines = source.split('\n')
  for (const e of events) {
    if (e.kind === 'CompileSuccess') {
      totalOk++
    } else if (e.kind === 'CompileError') {
      if (isOptedOut(sourceLines, e.fnLoc?.start?.line)) {
        totalOptOut++
        continue
      }
      totalBail++
      const o = e.detail?.options
      console.log(`${file}:${e.fnLoc?.start?.line ?? '?'} [${o?.category ?? '?'}] ${o?.reason ?? 'unknown'}`)
    }
  }
}
console.log(`\n${totalOk} compiled, ${totalBail} bailed out, ${totalOptOut} opted out, ${files.length} files`)
if (checkMode && totalBail > 0) {
  console.log("\nNew react-compiler bailouts. Fix them (often: move try/catch out of the component")
  console.log("body into a helper) or add a 'use no memo' directive for an intentional opt-out.")
  process.exit(1)
}
