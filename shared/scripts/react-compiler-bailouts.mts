// Three react-compiler checks that eslint cannot see, over one compile pass.
//
// 1. Bailouts: components/hooks that did NOT get memoized. The eslint react-hooks
//    rules only surface rules-of-react violations, not "Todo"-category syntax
//    bailouts (e.g. value blocks inside try/catch), so this uses the babel plugin's
//    logger to see every compile attempt.
//    Common fix: move try/catch out of the component body into a module-level helper.
//    Intentional opt-outs ('use no memo') are skipped and don't count as bailouts.
//
// 2. Whole-props memo deps: a memo scope keyed on the props object itself rather than
//    on the props it reads. JSX allocates a fresh props object every parent render, so
//    such a guard is always true and the cache never hits. Caused by reading `props.x`
//    inside a callback, or by a destructure that sits below a callback / gets sunk into
//    the scope. Fix: read every prop through one destructure at the top of the
//    component, above every callback. Scopes that genuinely use the whole object
//    (`{...rest} = props`, passing props along) are not reported.
//
// 3. Uncompiled components: a component whose name the compiler cannot infer is never
//    compiled at all, so nothing in it is memoized and it never shows up as a bailout.
//    The shape that bites is a platform ternary of anonymous arrows
//    (`const Foo = isMobile ? props => {...} : props => {...}`). Every callback it
//    builds then gets a fresh identity each render, which loops any hook that compares
//    a callback across renders (usePopup2 rebuilds its popup, re-rendering forever).
//    Fix: give each branch its own named component and pick between them
//    (`const Foo = isMobile ? FooMobile : FooDesktop`).
//
// Desktop (vite) compiles with oxc-transform-react, the Rust port, while metro and jest use
// the babel plugin, so every file also goes through oxc:
// 4. Compiler mismatch: the two ports memoize a different number of functions in a file,
//    so desktop and mobile run differently memoized code. Cache sizes are not compared --
//    the ports legitimately group scopes differently.
// 5. oxc bailouts and whole-props deps, with the same opt-out rules as the babel ones.
//
// Usage (from shared/):
//   node --experimental-strip-types scripts/react-compiler-bailouts.mts <file-or-dir> [...more]
//   node --experimental-strip-types scripts/react-compiler-bailouts.mts --check .   # exit 1 on any finding
import * as babel from '@babel/core'
import {transformSync as oxcTransform} from 'oxc-transform-react'
import {readFileSync, readdirSync, statSync} from 'fs'
import {basename, join, extname} from 'path'

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
    if (skipDirs.has(basename(path))) return
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

const t = babel.types

// Walks the compiled output for `if ($[n] !== props)` guards, where `props` is the
// component's single parameter. Reports only the ones whose guarded block reads
// properties off it -- a block that uses the whole object has no finer dep available.
const reportWholePropsDeps = (file: string, code: string, compiler: 'babel' | 'oxc') => {
  let ast: babel.types.File
  try {
    ast = babel.parseSync(code, {
      babelrc: false,
      configFile: false,
      filename: file,
      plugins: ['@babel/plugin-syntax-jsx'],
      sourceType: 'module',
    }) as babel.types.File
  } catch {
    return 0
  }
  let found = 0
  babel.traverse(ast, {
    Function(path) {
      const params = path.node.params
      if (params.length !== 1) return
      const p0 = params[0]
      if (!t.isIdentifier(p0)) return
      const name = p0.name
      // hooks take scalars too, so only flag things named like a props object
      if (name !== 'props' && name !== 'p' && name !== 'ownProps') return
      let fnName = 'anon'
      const parent = path.parent
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) fnName = parent.id.name
      else if (t.isFunctionDeclaration(path.node) && path.node.id) fnName = path.node.id.name

      path.traverse({
        BinaryExpression(bp) {
          if (bp.node.operator !== '!==') return
          const {left, right} = bp.node
          if (!t.isMemberExpression(left) || !t.isIdentifier(left.object, {name: '$'}) || !left.computed)
            return
          if (!t.isIdentifier(right, {name})) return
          const guard = bp.findParent(pp => pp.isIfStatement())
          const seen = {wholeUse: false}
          guard?.traverse({
            Identifier(ip) {
              if (ip.node.name !== name) return
              const par = ip.parent
              // reading a property, comparing in the guard, or the compiler storing
              // the dep in its cache slot all leave a finer dep available
              if (t.isMemberExpression(par) && par.object === ip.node) return
              if (t.isBinaryExpression(par)) return
              // a destructure sunk into the block is the bug, not a whole-object use --
              // unless it takes a rest element, which does need the whole object
              if (
                t.isVariableDeclarator(par) &&
                par.init === ip.node &&
                t.isObjectPattern(par.id) &&
                !par.id.properties.some(pr => t.isRestElement(pr))
              )
                return
              if (
                t.isAssignmentExpression(par) &&
                par.right === ip.node &&
                t.isMemberExpression(par.left) &&
                t.isIdentifier(par.left.object, {name: '$'})
              )
                return
              seen.wholeUse = true
            },
          })
          if (seen.wholeUse) return
          found++
          console.log(
            `${file}:${bp.node.loc?.start.line ?? '?'} [${compiler} output] ${fnName} memoizes on the whole \`${name}\` object`
          )
        },
      })
    },
  })
  return found
}

// A function react-compiler cannot name is never compiled, so it produces neither a
// success nor a bailout event -- it is simply unmemoized. Flags the shape that costs
// something: an anonymous function that both calls a hook and returns JSX, i.e. an
// unnamed component. Anonymous hook wrappers with no JSX (test callbacks, a ternary
// that picks between two one-line context reads) have nothing to memoize, so they are
// left alone.
const reportUncompiledComponents = (file: string, source: string) => {
  let ast: babel.types.File
  try {
    ast = babel.parseSync(source, {
      babelrc: false,
      configFile: false,
      filename: file,
      presets: [['@babel/preset-typescript', {allExtensions: true, isTSX: true}]],
      sourceType: 'module',
    }) as babel.types.File
  } catch {
    return 0
  }
  let found = 0
  babel.traverse(ast, {
    Function(path) {
      // a declaration or a `const Foo = ...` gives the compiler a name to work with
      if (!t.isArrowFunctionExpression(path.node) && !t.isFunctionExpression(path.node)) return
      if (t.isFunctionExpression(path.node) && path.node.id) return
      const parent = path.parent
      if (t.isVariableDeclarator(parent) || t.isObjectProperty(parent) || t.isClassProperty(parent)) return
      if (t.isAssignmentExpression(parent) || t.isExportDefaultDeclaration(parent)) return
      // `const Foo = React.memo(props => ...)` still names the component through the
      // declarator, and the compiler follows the wrapper
      if (t.isCallExpression(parent) && t.isVariableDeclarator(path.parentPath.parent)) return

      // an object, not a `let`: TS narrows a boolean assigned only inside a callback to
      // its initializer and eslint then calls the check below unnecessary
      const seen = {hook: false, jsx: false}
      path.traverse({
        CallExpression(cp) {
          // a hook called inside a nested function belongs to that function, not this one
          if (cp.getFunctionParent() !== path) return
          const callee = cp.node.callee
          const name = t.isIdentifier(callee)
            ? callee.name
            : t.isMemberExpression(callee) && t.isIdentifier(callee.property)
              ? callee.property.name
              : ''
          if (/^use[A-Z]/.test(name)) seen.hook = true
        },
      })
      if (!seen.hook) return

      path.traverse({
        JSX(jp) {
          if (jp.getFunctionParent() !== path) return
          seen.jsx = true
        },
      })
      if (!seen.jsx) return
      found++
      console.log(
        `${file}:${path.node.loc?.start.line ?? '?'} anonymous component, never compiled`
      )
    },
  })
  return found
}

// Each memoized function makes exactly one cache call through the compiler-runtime import.
const countMemoCaches = (code: string) => {
  const m = /import\s*\{\s*c\s+as\s+(\w+)\s*\}\s*from\s*["']react\/compiler-runtime["']/.exec(code)
  return m ? code.match(new RegExp(`\\b${m[1]}\\(\\d+\\)`, 'g'))?.length ?? 0 : 0
}

// oxc reports a bailout at the offending expression rather than at the function start,
// so an opt-out is any enclosing function (or the module) carrying 'use no memo'.
const getOptOutRanges = (source: string) => {
  const ranges: Array<[number, number]> = []
  const ast = babel.parseSync(source, {
    babelrc: false,
    configFile: false,
    filename: 'optouts.tsx',
    presets: [['@babel/preset-typescript', {allExtensions: true, isTSX: true}]],
    sourceType: 'module',
  })
  if (!ast) return ranges
  const hasOptOut = (directives: Array<babel.types.Directive>) =>
    directives.some(d => d.value.value === 'use no memo')
  if (hasOptOut(ast.program.directives)) ranges.push([0, source.length])
  babel.traverse(ast, {
    Function(path) {
      const {body, start, end} = path.node
      if (t.isBlockStatement(body) && hasOptOut(body.directives) && start != null && end != null) {
        ranges.push([start, end])
      }
    },
  })
  return ranges
}

let totalOk = 0
let totalBail = 0
let totalOptOut = 0
let totalParseFailed = 0
let totalWholeProps = 0
let totalUncompiled = 0
let totalMismatch = 0
let totalOxcBail = 0
for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const events: Array<CompilerEvent> = []
  let compiled: string | undefined
  try {
    compiled =
      babel.transformSync(source, {
        babelrc: false,
        configFile: false,
        filename: file,
        plugins: [
          [
            'babel-plugin-react-compiler',
            {logger: {logEvent: (_: string, e: CompilerEvent) => events.push(e)}},
          ],
        ],
        presets: [['@babel/preset-typescript', {allExtensions: true, isTSX: true}]],
      })?.code ?? undefined
  } catch (e) {
    totalParseFailed++
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
  // the runtime import name depends on the compiler's target, so key off the cache call
  if (compiled?.includes('useMemoCache(') || compiled?.includes('_c(')) {
    totalWholeProps += reportWholePropsDeps(file, compiled, 'babel')
  }
  totalUncompiled += reportUncompiledComponents(file, source)

  const oxc = oxcTransform(file, source, {jsx: {runtime: 'automatic'}, reactCompiler: {}, sourcemap: false})
  if (oxc.errors.length > 0) {
    const optOuts = getOptOutRanges(source)
    const sourceBytes = Buffer.from(source)
    for (const e of oxc.errors) {
      // oxc offsets are utf-8 bytes; babel ranges and slice() are utf-16 indexes
      const byteAt = e.labels[0]?.start
      const at = byteAt === undefined ? undefined : sourceBytes.subarray(0, byteAt).toString().length
      if (at !== undefined && optOuts.some(([s, end]) => s <= at && at < end)) continue
      totalOxcBail++
      const line = at === undefined ? '?' : source.slice(0, at).split('\n').length
      console.log(`${file}:${line} [oxc${oxc.fatal ? ' fatal' : ''}] ${e.message}`)
    }
  }
  const babelCaches = compiled ? countMemoCaches(compiled) : 0
  const oxcCaches = countMemoCaches(oxc.code)
  if (babelCaches !== oxcCaches) {
    totalMismatch++
    console.log(`${file}: babel memoizes ${babelCaches} functions, oxc memoizes ${oxcCaches}`)
  }
  if (oxcCaches > 0) {
    totalWholeProps += reportWholePropsDeps(file, oxc.code, 'oxc')
  }
}
console.log(
  `\n${totalOk} compiled, ${totalBail} bailed out, ${totalOptOut} opted out, ${totalWholeProps} whole-props deps, ${totalUncompiled} uncompiled, ${totalOxcBail} oxc bailed out, ${totalMismatch} compiler mismatches, ${totalParseFailed} parse failed, ${files.length} files`
)
if (
  checkMode &&
  (totalBail > 0 ||
    totalParseFailed > 0 ||
    totalWholeProps > 0 ||
    totalUncompiled > 0 ||
    totalOxcBail > 0 ||
    totalMismatch > 0)
) {
  if (totalParseFailed > 0) {
    console.log('\nSome files failed to parse, so they could not be checked.')
  }
  if (totalBail > 0) {
    console.log(
      "\nNew react-compiler bailouts. Fix them (often: move try/catch out of the component body into a helper) or add a 'use no memo' directive for an intentional opt-out."
    )
  }
  if (totalWholeProps > 0) {
    console.log(
      '\nNew whole-props memo deps. Read every prop through one destructure at the top of the component, above every callback -- a `props.x` read inside a callback, or a destructure below one, keys the memo on the props object and the cache never hits.'
    )
  }
  if (totalUncompiled > 0) {
    console.log(
      '\nComponents the compiler cannot name are never compiled, so nothing in them is memoized. Give each one a name -- for a platform ternary, name both branches and pick between them (`const Foo = isMobile ? FooMobile : FooDesktop`).'
    )
  }
  if (totalOxcBail > 0 || totalMismatch > 0) {
    console.log(
      "\nNew oxc react-compiler findings. Desktop compiles with oxc, mobile with babel. Fix oxc bailouts like babel ones. A mismatch means the ports disagree about the same code: rewrite it so both compile it the same way, or add 'use no memo'."
    )
  }
  process.exit(1)
}
