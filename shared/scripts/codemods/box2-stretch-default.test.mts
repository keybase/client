/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  applyCleanup,
  assertPinWritable,
  assertUnpinWritable,
  cleanupCandidates,
  hasImplicitCenter,
  matchU4Skips,
  noopCandidates,
  pinSource,
  planU4,
  platformCoverage,
  readU4Skips,
  u4Candidates,
  u4SkipsPath,
  gateUnreachable,
  platformOnly,
  resolveSpecifier,
  unmountedPlatforms,
  unpinCandidates,
  type Project,
} from './box2-stretch-default.mts'
import {execFileSync} from 'child_process'

const run = (code: string) => pinSource(code, '/x/shared/settings/a.tsx')
const runCA = (code: string) => pinSource(code, '/x/shared/common-adapters/rounded-box.tsx')

test('both absent: pins after the tag name', () => {
  const r = run(`const A = () => <Kb.Box2 direction="vertical" />`)
  assert.equal(r.code, `const A = () => <Kb.Box2 alignSelf="center" direction="vertical" />`)
  assert.deepEqual(r.pinned, [{line: 1}])
  assert.deepEqual(r.spreads, [])
  assert.deepEqual(r.unresolved, [])
})

test('fullWidth or fullHeight true: untouched', () => {
  for (const attr of ['fullWidth', 'fullWidth={true}', 'fullHeight', 'fullHeight={true}', 'fullWidth="yes"']) {
    const src = `const A = () => <Kb.Box2 direction="vertical" ${attr} />`
    const r = run(src)
    assert.equal(r.code, src, attr)
    assert.equal(r.pinned.length, 0, attr)
  }
})

test('true wins over an expression on the other axis', () => {
  const src = `const A = () => <Kb.Box2 direction="vertical" fullWidth={x} fullHeight={true} />`
  assert.equal(run(src).code, src)
})

test('alignSelf present: untouched', () => {
  const src = `const A = () => <Kb.Box2 direction="vertical" alignSelf="flex-start" />`
  const r = run(src)
  assert.equal(r.code, src)
  assert.equal(r.pinned.length, 0)
})

test('alignSelf as expression: untouched', () => {
  const src = `const A = () => <Kb.Box2 direction="vertical" alignSelf={a} fullWidth={x} />`
  assert.equal(run(src).code, src)
})

test('alignSelf that always yields a non-empty string covers the element', () => {
  for (const attr of [
    `alignSelf="flex-end"`,
    `alignSelf={'center'}`,
    `alignSelf={a ? 'stretch' : 'flex-start'}`,
    `alignSelf={a ? 'stretch' : b ? 'center' : 'flex-end'}`,
    `alignSelf={('center' as const)}`,
  ]) {
    const src = `const A = () => <Kb.Box2 direction="vertical" ${attr} />`
    const r = run(src)
    assert.equal(r.code, src, attr)
    assert.equal(r.pinned.length + r.unresolved.length, 0, attr)
  }
})

test('alignSelf that may be undefined: unresolved, never edited', () => {
  for (const attr of [
    `alignSelf={a ? 'stretch' : undefined}`,
    `alignSelf={p.alignSelf}`,
    `alignSelf={alignSelf}`,
    `alignSelf={a && 'center'}`,
    `alignSelf={a ?? 'center'}`,
    `alignSelf={a || 'center'}`,
    `alignSelf=""`,
  ]) {
    const src = `const A = () => <Kb.Box2 direction="vertical" ${attr} fullWidth={x} />`
    const r = run(src)
    assert.equal(r.code, src, attr)
    assert.equal(r.pinned.length, 0, attr)
    assert.deepEqual(r.unresolved, [{line: 1, reason: 'alignSelf expression may be undefined'}], attr)
  }
})

test('alignSelf that may be undefined is fine when an axis is true', () => {
  const src = `const A = () => <Kb.Box2 direction="vertical" alignSelf={p.alignSelf} fullWidth={true} />`
  const r = run(src)
  assert.equal(r.code, src)
  assert.equal(r.unresolved.length + r.pinned.length, 0)
})

test('undefined and null axis values count as absent', () => {
  assert.equal(
    run(`const A = () => <Kb.Box2 fullWidth={undefined} fullHeight={null} />`).code,
    `const A = () => <Kb.Box2 alignSelf="center" fullWidth={undefined} fullHeight={null} />`
  )
})

test('literal false counts as absent', () => {
  assert.equal(
    run(`const A = () => <Kb.Box2 direction="vertical" fullWidth={false} />`).code,
    `const A = () => <Kb.Box2 alignSelf="center" direction="vertical" fullWidth={false} />`
  )
  assert.equal(
    run(`const A = () => <Kb.Box2 fullWidth={false} fullHeight={y} />`).code,
    `const A = () => <Kb.Box2 alignSelf={y ? undefined : 'center'} fullWidth={false} fullHeight={y} />`
  )
})

test('one expression: conditional pin', () => {
  const r = run(`const A = () => <Kb.Box2 direction="vertical" fullWidth={x} />`)
  assert.equal(r.code, `const A = () => <Kb.Box2 alignSelf={x ? undefined : 'center'} direction="vertical" fullWidth={x} />`)
  assert.deepEqual(r.pinned, [{line: 1}])
})

test('two expressions: joined with ||', () => {
  assert.equal(
    run(`const A = () => <Kb.Box2 direction="vertical" fullWidth={x} fullHeight={y} />`).code,
    `const A = () => <Kb.Box2 alignSelf={x || y ? undefined : 'center'} direction="vertical" fullWidth={x} fullHeight={y} />`
  )
})

test('the same expression on both axes is emitted once', () => {
  assert.equal(
    run(`const A = () => <Kb.Box2 fullWidth={isMobile} fullHeight={isMobile} />`).code,
    `const A = () => <Kb.Box2 alignSelf={isMobile ? undefined : 'center'} fullWidth={isMobile} fullHeight={isMobile} />`
  )
  assert.equal(
    run(`const A = () => <Kb.Box2 fullWidth={a && b} fullHeight={a && b} />`).code,
    `const A = () => <Kb.Box2 alignSelf={(a && b) ? undefined : 'center'} fullWidth={a && b} fullHeight={a && b} />`
  )
})

test('member expressions are not parenthesized', () => {
  assert.equal(
    run(`const A = () => <Kb.Box2 fullWidth={p.fullWidth} fullHeight={p?.h} />`).code,
    `const A = () => <Kb.Box2 alignSelf={p.fullWidth || p?.h ? undefined : 'center'} fullWidth={p.fullWidth} fullHeight={p?.h} />`
  )
})

test('expression source text is kept verbatim and parenthesized', () => {
  assert.equal(
    run(`const A = () => <Kb.Box2 fullWidth={a ?? b} fullHeight={!isMobile && c} />`).code,
    `const A = () => <Kb.Box2 alignSelf={(a ?? b) || (!isMobile && c) ? undefined : 'center'} fullWidth={a ?? b} fullHeight={!isMobile && c} />`
  )
})

test('spread: no edit, reported in spreads', () => {
  const src = `const A = (p) => <Kb.Box2 direction="vertical" {...p} />`
  const r = run(src)
  assert.equal(r.code, src)
  assert.deepEqual(r.spreads, [{line: 1}])
  assert.deepEqual(r.pinned, [])
})

test('spread wins over alignSelf and fullWidth', () => {
  const src = `const A = (p) => <Kb.Box2 direction="vertical" fullWidth alignSelf="center" {...p} />`
  const r = run(src)
  assert.equal(r.code, src)
  assert.deepEqual(r.spreads, [{line: 1}])
})

test('ClickableBox and Kb.ClickableBox pinned', () => {
  assert.equal(
    run(`const A = () => <Kb.ClickableBox onClick={f} />`).code,
    `const A = () => <Kb.ClickableBox alignSelf="center" onClick={f} />`
  )
  assert.equal(
    run(`import {ClickableBox} from '@/common-adapters'\nconst A = () => <ClickableBox onClick={f} />`).code,
    `import {ClickableBox} from '@/common-adapters'\nconst A = () => <ClickableBox alignSelf="center" onClick={f} />`
  )
})

test('bare element with no attributes', () => {
  assert.equal(run(`const A = () => <Kb.Box2>x</Kb.Box2>`).code, `const A = () => <Kb.Box2 alignSelf="center">x</Kb.Box2>`)
})

test('import sources that resolve to common-adapters', () => {
  const sources: Array<[string, string]> = [
    ['/x/shared/settings/a.tsx', '@/common-adapters'],
    ['/x/shared/settings/a.tsx', '@/common-adapters/box'],
    ['/x/shared/settings/a.tsx', '@/common-adapters/index'],
    ['/x/shared/settings/a.tsx', '../common-adapters'],
    ['/x/shared/settings/sub/a.tsx', '../../common-adapters/index'],
    ['/x/shared/common-adapters/a.tsx', './box'],
    ['/x/shared/common-adapters/popup/a.tsx', '../box'],
    ['/x/shared/common-adapters/popup/floating-box/a.tsx', '../../box'],
  ]
  for (const [file, from] of sources) {
    const r = pinSource(`import {Box2} from '${from}'\nconst A = () => <Box2 direction="vertical" />`, file)
    assert.equal(r.code, `import {Box2} from '${from}'\nconst A = () => <Box2 alignSelf="center" direction="vertical" />`, `${file} ${from}`)
    assert.deepEqual(r.pinned, [{line: 2}])
  }
})

test('aliased import is a target', () => {
  assert.equal(
    run(`import {Box2 as B} from '@/common-adapters'\nconst A = () => <B direction="vertical" />`).code,
    `import {Box2 as B} from '@/common-adapters'\nconst A = () => <B alignSelf="center" direction="vertical" />`
  )
})

test('namespace import under another name is a target', () => {
  assert.equal(
    run(`import * as C from '@/common-adapters'\nconst A = () => <C.Box2 direction="vertical" />`).code,
    `import * as C from '@/common-adapters'\nconst A = () => <C.Box2 alignSelf="center" direction="vertical" />`
  )
})

test('local const Kb = {Box2} in common-adapters is a target', () => {
  const r = runCA(`import {Box2} from './box'\nconst Kb = {Box2}\nconst A = () => <Kb.Box2 direction="vertical" />`)
  assert.equal(r.code, `import {Box2} from './box'\nconst Kb = {Box2}\nconst A = () => <Kb.Box2 alignSelf="center" direction="vertical" />`)
})

test('non-targets untouched', () => {
  for (const src of [
    `const A = () => <Foo.Box2 direction="vertical" />`,
    `const A = () => <Kb.Text type="Body" />`,
    `const A = () => <Box2 direction="vertical" />`,
    `import {Box2} from '@/chat/box'\nconst A = () => <Box2 direction="vertical" />`,
    `import {Box2} from './box'\nconst A = () => <Box2 direction="vertical" />`,
    `import {Box2} from '@/common-adapters'\nconst A = () => <div />`,
    `import * as C from '@/styles'\nconst A = () => <C.Box2 />`,
  ]) {
    const r = run(src)
    assert.equal(r.code, src, src)
    assert.equal(r.pinned.length + r.spreads.length + r.unresolved.length, 0, src)
  }
})

test('a local binding shadowing the import is not a target', () => {
  const src = `import {Box2} from '@/common-adapters'\nconst A = () => { const Box2 = Other; return <Box2 /> }`
  const r = run(src)
  assert.equal(r.code, src)
  assert.equal(r.pinned.length, 0)
})

test('deeper member expressions ending in Box2 go to unresolved', () => {
  const src = `const A = () => <Kb.Foo.Box2 direction="vertical" />`
  const r = run(src)
  assert.equal(r.code, src)
  assert.deepEqual(r.unresolved, [{line: 1, reason: 'member expression deeper than one level'}])
})

test('default import of Box2 from common-adapters goes to unresolved', () => {
  const src = `import Box2 from '@/common-adapters/box'\nconst A = () => <Box2 direction="vertical" />`
  const r = run(src)
  assert.equal(r.code, src)
  assert.equal(r.unresolved.length, 1)
  assert.equal(r.unresolved[0]?.line, 2)
})

test('empty string fullWidth goes to unresolved', () => {
  const src = `const A = () => <Kb.Box2 fullWidth="" />`
  const r = run(src)
  assert.equal(r.code, src)
  assert.equal(r.unresolved.length, 1)
})

test('multi-line element keeps every other byte identical', () => {
  const src = [
    'const A = () => (',
    '  <Kb.Box2',
    '    direction="vertical"',
    '    gap="tiny"   // odd spacing kept',
    '    style={styles.x}',
    '  >',
    '    <Kb.Text type="Body">hi</Kb.Text>',
    '  </Kb.Box2>',
    ')',
  ].join('\n')
  const want = src.replace('  <Kb.Box2\n', '  <Kb.Box2 alignSelf="center"\n')
  const r = run(src)
  assert.equal(r.code, want)
  assert.deepEqual(r.pinned, [{line: 2}])
})

test('nested Box2 inside Box2: both handled', () => {
  const src = `const A = () => <Kb.Box2 direction="vertical"><Kb.Box2 direction="horizontal" fullWidth={w}><Kb.ClickableBox fullHeight /></Kb.Box2></Kb.Box2>`
  const r = run(src)
  assert.equal(
    r.code,
    `const A = () => <Kb.Box2 alignSelf="center" direction="vertical"><Kb.Box2 alignSelf={w ? undefined : 'center'} direction="horizontal" fullWidth={w}><Kb.ClickableBox fullHeight /></Kb.Box2></Kb.Box2>`
  )
  assert.equal(r.pinned.length, 2)
})

test('elements nested in attribute expressions are handled', () => {
  const src = `const A = () => <Kb.Box2 direction="vertical" fullWidth={true} header={<Kb.Box2 direction="horizontal" />} />`
  assert.equal(
    run(src).code,
    `const A = () => <Kb.Box2 direction="vertical" fullWidth={true} header={<Kb.Box2 alignSelf="center" direction="horizontal" />} />`
  )
})

test('type parameters on the element: inserted after them', () => {
  assert.equal(run(`const A = () => <Kb.Box2<X> direction="vertical" />`).code, `const A = () => <Kb.Box2<X> alignSelf="center" direction="vertical" />`)
})

test('a local variable aliasing Box2 goes to unresolved', () => {
  const src = `const B = isMobile ? Kb.Box2 : Other\nconst A = () => <B direction="vertical" />`
  const r = run(src)
  assert.equal(r.code, src)
  assert.deepEqual(
    r.unresolved.map(u => u.line),
    [2]
  )
})

test('a wrapped component is unresolved; a component that renders Box2 is not', () => {
  const wrapped = run(`const AB = Animated.createAnimatedComponent(Kb.Box2)\nconst A = () => <AB />`)
  assert.deepEqual(
    wrapped.unresolved.map(u => u.line),
    [2]
  )
  const comp = run(`const Row = () => <Kb.Box2 fullWidth={true} />\nconst A = () => <Row />`)
  assert.equal(comp.unresolved.length, 0)
})

test('member of a local object other than Kb goes to unresolved', () => {
  const r = run(`const K = {Box2}\nconst A = () => <K.Box2 />`)
  assert.deepEqual(
    r.unresolved.map(u => u.line),
    [2]
  )
})

test('unparseable source goes to unresolved untouched', () => {
  const src = `const A = () => <Kb.Box2`
  const r = run(src)
  assert.equal(r.code, src)
  assert.equal(r.unresolved.length, 1)
  assert.match(r.unresolved[0]?.reason ?? '', /parse error/)
})

test('output is idempotent', () => {
  const once = run(`const A = () => <Kb.Box2 direction="vertical" fullWidth={x} />`).code
  const twice = run(once)
  assert.equal(twice.code, once)
  assert.equal(twice.pinned.length, 0)
})

// ---------------------------------------------------------------- cleanup

const cands = (code: string) => cleanupCandidates(code, '/x/shared/settings/a.tsx')
const clean = (code: string) => applyCleanup(code, cands(code))
const rules = (code: string) => cands(code).map(c => `${c.rule}:${c.attr}:${c.line}`)
const inVertical = (child: string, parent = ' fullWidth') =>
  `const A = () => (\n  <Kb.Box2 direction="vertical"${parent}>\n    ${child}\n  </Kb.Box2>\n)`
const inHorizontal = (child: string, parent = ' fullHeight') =>
  `const A = () => (\n  <Kb.Box2 direction="horizontal"${parent}>\n    ${child}\n  </Kb.Box2>\n)`

test('C1: fullWidth on a child of a vertical stretch parent is removed', () => {
  for (const fw of ['fullWidth', 'fullWidth={true}']) {
    const src = inVertical(`<Kb.Box2 direction="horizontal" ${fw} gap="tiny" />`)
    assert.deepEqual(rules(src), ['C1:fullWidth:3'], fw)
    assert.equal(clean(src), inVertical(`<Kb.Box2 direction="horizontal" gap="tiny" />`), fw)
  }
  const stretch = inVertical(`<Kb.ClickableBox direction="vertical" fullWidth />`, ` fullWidth alignItems="stretch"`)
  assert.deepEqual(rules(stretch), ['C1:fullWidth:3'])
})

test('C1: an attribute on its own line goes with its line', () => {
  const src = `const A = () => (
  <Kb.Box2 direction="vertical" fullWidth>
    <Kb.Box2
      direction="horizontal"
      fullWidth
      gap="tiny"
    />
  </Kb.Box2>
)`
  assert.equal(
    clean(src),
    `const A = () => (
  <Kb.Box2 direction="vertical" fullWidth>
    <Kb.Box2
      direction="horizontal"
      gap="tiny"
    />
  </Kb.Box2>
)`
  )
})

test('C1: not with fullHeight, alignSelf expressions, false or expression fullWidth', () => {
  for (const child of [
    `<Kb.Box2 direction="vertical" fullWidth fullHeight />`,
    `<Kb.Box2 direction="vertical" fullWidth fullHeight={x} />`,
    `<Kb.Box2 direction="vertical" fullWidth alignSelf={x ? 'center' : undefined} />`,
    `<Kb.Box2 direction="vertical" fullWidth={x} />`,
    `<Kb.Box2 direction="vertical" fullWidth={false} />`,
    `<Kb.Box2 direction="vertical" fullWidth="yes" />`,
  ]) {
    assert.deepEqual(rules(inVertical(child)), [], child)
  }
})

test('C2: fullHeight on a child of a horizontal stretch parent is removed', () => {
  const src = inHorizontal(`<Kb.Box2 direction="vertical" fullHeight flex={1} />`)
  assert.deepEqual(rules(src), ['C2:fullHeight:3'])
  assert.equal(clean(src), inHorizontal(`<Kb.Box2 direction="vertical" flex={1} />`))
  for (const child of [
    `<Kb.Box2 direction="vertical" fullHeight fullWidth />`,
    `<Kb.Box2 direction="vertical" fullHeight fullWidth={false} />`,
    `<Kb.Box2 direction="vertical" fullHeight alignSelf="center" />`,
  ]) {
    assert.deepEqual(rules(inHorizontal(child)), [], child)
  }
})

test('C2 does not fire in a vertical parent, nor C1 in a horizontal one', () => {
  assert.deepEqual(rules(inVertical(`<Kb.Box2 direction="vertical" fullHeight />`)), [])
  assert.deepEqual(rules(inHorizontal(`<Kb.Box2 direction="vertical" fullWidth />`)), [])
})

test('C3: alignSelf literal on a fullWidth child of a vertical parent is removed', () => {
  for (const v of ['stretch', 'center', 'flex-start', 'flex-end']) {
    for (const a of [`alignSelf="${v}"`, `alignSelf={'${v}'}`]) {
      const src = inVertical(`<Kb.Box2 direction="vertical" fullWidth fullHeight ${a} />`)
      assert.deepEqual(rules(src), ['C3:alignSelf:3'], a)
      assert.equal(clean(src), inVertical(`<Kb.Box2 direction="vertical" fullWidth fullHeight />`), a)
    }
  }
})

test('C3: whatever the parent alignItems is', () => {
  const src = inVertical(`<Kb.Box2 direction="vertical" fullWidth alignSelf="center" />`, ` fullWidth alignItems="center"`)
  assert.deepEqual(rules(src), ['C3:alignSelf:3'])
})

test('C3: not for expressions, other values or a fullWidth that is not true', () => {
  for (const child of [
    `<Kb.Box2 direction="vertical" fullWidth alignSelf={x} />`,
    `<Kb.Box2 direction="vertical" fullWidth alignSelf={x ? 'center' : 'stretch'} />`,
    `<Kb.Box2 direction="vertical" fullWidth={x} alignSelf="center" />`,
    `<Kb.Box2 direction="vertical" alignSelf="center" />`,
    `<Kb.Box2 direction="vertical" fullHeight alignSelf="center" />`,
  ]) {
    assert.deepEqual(rules(inVertical(child)), [], child)
  }
})

test('C3 never fires for a horizontal parent', () => {
  for (const v of ['stretch', 'center', 'flex-start', 'flex-end']) {
    assert.deepEqual(rules(inHorizontal(`<Kb.Box2 direction="vertical" fullWidth alignSelf="${v}" />`)), [], v)
    assert.deepEqual(rules(inHorizontal(`<Kb.Box2 direction="vertical" fullWidth fullHeight alignSelf="${v}" />`)), [], v)
  }
})

test('C1 and C3 on the same child: only C3', () => {
  const src = inVertical(`<Kb.Box2 direction="vertical" fullWidth alignSelf="flex-start" />`)
  assert.deepEqual(rules(src), ['C3:alignSelf:3'])
  assert.equal(clean(src), inVertical(`<Kb.Box2 direction="vertical" fullWidth />`))
})

test('a pin is never a candidate', () => {
  const pinned = pinSource(inVertical(`<Kb.Box2 direction="vertical" />`), '/x/shared/settings/a.tsx').code
  assert.deepEqual(rules(pinned), [])
  const conditional = pinSource(inVertical(`<Kb.Box2 direction="vertical" fullWidth={x} />`), '/x/shared/settings/a.tsx').code
  assert.deepEqual(rules(conditional), [])
})

test('no rule fires for a child with a style prop, a className or a spread', () => {
  for (const extra of [`style={styles.x}`, `className="x"`, `{...p}`]) {
    assert.deepEqual(rules(inVertical(`<Kb.Box2 direction="vertical" fullWidth ${extra} />`)), [], extra)
    assert.deepEqual(rules(inVertical(`<Kb.Box2 direction="vertical" fullWidth alignSelf="center" ${extra} />`)), [], extra)
    assert.deepEqual(rules(inHorizontal(`<Kb.Box2 direction="vertical" fullHeight ${extra} />`)), [], extra)
  }
})

test('parent alignItems other than stretch: no C1 or C2', () => {
  for (const ai of [` alignItems="center"`, ` alignItems="flex-start"`, ` alignItems={x}`, ` centerChildren`]) {
    assert.deepEqual(rules(inVertical(`<Kb.Box2 direction="vertical" fullWidth />`, ` fullWidth${ai}`)), [], ai)
    assert.deepEqual(rules(inHorizontal(`<Kb.Box2 direction="vertical" fullHeight />`, ` fullHeight${ai}`)), [], ai)
  }
})

test('parent with a spread or a className: nothing', () => {
  for (const extra of [` {...p}`, ` className="x"`]) {
    assert.deepEqual(rules(inVertical(`<Kb.Box2 direction="vertical" fullWidth />`, ` fullWidth${extra}`)), [], extra)
    assert.deepEqual(rules(inVertical(`<Kb.Box2 direction="vertical" fullWidth alignSelf="center" />`, ` fullWidth${extra}`)), [], extra)
    assert.deepEqual(rules(inHorizontal(`<Kb.Box2 direction="vertical" fullHeight />`, ` fullHeight${extra}`)), [], extra)
  }
})

const styled = (style: string, sheet: string) =>
  `${inVertical(`<Kb.Box2 direction="vertical" fullWidth />`, ` fullWidth style={${style}}`)}\nconst styles = Kb.Styles.styleSheetCreate(() => (${sheet}))`

test('parent style that provably keeps the cross axis: rules still apply', () => {
  for (const [style, sheet] of [
    [`styles.x`, `{x: {padding: 8, backgroundColor: Kb.Styles.globalColors.white}}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({common: {flex: 1}, isMobile: {padding: 4}, isElectron: {height: 40}})}`],
    [`styles.x`, `{x: {width: 10}, y: {alignItems: 'center'}}`],
    [`Kb.Styles.collapseStyles([styles.x, a && styles.y, b ? styles.x : undefined])`, `{x: {padding: 1}, y: {margin: 2}}`],
    [`styles.x`, `{x: {...Kb.Styles.padding(8), backgroundColor: 'red'}}`],
    [`{paddingTop: 4}`, `{}`],
    [`Kb.Styles.padding(4)`, `{}`],
  ] as const) {
    assert.deepEqual(rules(styled(style, sheet)), ['C1:fullWidth:3'], `${style} ${sheet}`)
  }
  const hooked = `const A = () => {\n  const styles = useStyles()\n  return (\n    <Kb.Box2 direction="vertical" fullWidth style={styles.x}>\n      <Kb.Box2 direction="vertical" fullWidth />\n    </Kb.Box2>\n  )\n}\nconst useStyles = Kb.Styles.createStyleHook(theme => ({x: {backgroundColor: theme.white}}))`
  assert.deepEqual(rules(hooked), ['C1:fullWidth:5'])
})

test('the styles module resolves: globalStyles and desktopStyles members, exported helpers, consts', () => {
  const provable = (style: string, sheet = '{}', prelude = '') =>
    rules(`${prelude}\n${styled(style, sheet)}`).length === 1
  for (const style of [
    'Kb.Styles.globalStyles.fullWidth',
    'Kb.Styles.globalStyles.flexOne',
    'Kb.Styles.globalStyles.fontBold',
    'Kb.Styles.globalStyles.fillAbsolute',
    'Kb.Styles.desktopStyles.boxShadow',
    'Kb.Styles.desktopStyles.clickable',
    'Kb.Styles.paddingH(4)',
    'Kb.Styles.size(32)',
    'Kb.Styles.marginV(2)',
    'Kb.Styles.bottomDivider(theme, 40)',
    "Kb.Styles.border('red', 1, 4)",
    'Kb.Styles.collapseStyles([Kb.Styles.globalStyles.flexOne, Kb.Styles.padding(4)])',
  ]) {
    assert.ok(provable(style), style)
  }
  for (const style of [
    'Kb.Styles.globalStyles.flexBoxRow',
    'Kb.Styles.globalStyles.flexBoxColumn',
    'Kb.Styles.globalStyles.flexBoxCenter',
    'Kb.Styles.globalStyles.flexWrap',
    'Kb.Styles.globalStyles.missing',
    'Kb.Styles.globalMargins.tiny',
    'Kb.Styles.centered()',
    'Kb.Styles.initDesktopStyles()',
    'Kb.Styles.nope(4)',
    'Kb.Other.padding(4)',
    'padding(4)',
    "Kb.Styles.collapseStyles([Kb.Styles.padding(1)], {alignItems: 'center'})",
  ]) {
    assert.ok(!provable(style), style)
  }
  // through a namespace or named import of @/styles (or a relative path to it), never another module
  assert.ok(provable('Styles.globalStyles.flexOne', '{}', "import * as Styles from '@/styles'"))
  assert.ok(provable('Styles.paddingV(4)', '{}', "import * as Styles from '../styles'"))
  assert.ok(provable('paddingV(4)', '{}', "import {paddingV} from '@/styles'"))
  assert.ok(provable('pv(4)', '{}', "import {paddingV as pv} from '@/styles'"))
  assert.ok(!provable('Styles.paddingV(4)', '{}', "import * as Styles from './styles'"))
  assert.ok(!provable('paddingV(4)', '{}', "import {paddingV} from './elsewhere'"))
  assert.ok(!provable('Kb.Styles.paddingV(4)', '{}', "import * as Kb from './kb'"))
  assert.ok(!provable('centered()', '{}', "import {centered} from '@/styles'"))
  // in-file consts resolve where they are declared; let, destructures and parameters do not
  assert.ok(provable('styles.x', '{x: {...row, margin: 1}}', 'const row = {padding: 4}'))
  assert.ok(provable('row', '{}', 'const row = Kb.Styles.platformStyles({isMobile: Kb.Styles.paddingH(4)})'))
  assert.ok(!provable('styles.x', '{x: {...row}}', "const row = {alignItems: 'center'}"))
  assert.ok(!provable('row', '{}', 'let row = {padding: 4}'))
  assert.ok(!provable('row', '{}', "const {row} = {row: {alignItems: 'center'}}"))
  const shadowed = (outer: string, inner: string) =>
    rules(
      `const base = ${outer}\nconst A = () => {\n  const base = ${inner}\n  return (\n    <Kb.Box2 direction="vertical" fullWidth style={styles.x}>\n      <Kb.Box2 direction="vertical" fullWidth />\n    </Kb.Box2>\n  )\n}\nconst styles = Kb.Styles.styleSheetCreate(() => ({x: {...base}}))`
    ).length === 1
  assert.ok(shadowed('{padding: 1}', "{alignItems: 'center'}"))
  // a const's own initializer resolves where it was declared, not where it is used
  assert.deepEqual(
    rules(
      `const inner = {padding: 1}\nconst row = {...inner}\nconst A = () => {\n  const inner = {alignItems: 'center'}\n  return (\n    <Kb.Box2 direction="vertical" fullWidth style={row}>\n      <Kb.Box2 direction="vertical" fullWidth />\n    </Kb.Box2>\n  )\n}`
    ),
    ['C1:fullWidth:7']
  )
  assert.ok(!shadowed("{alignItems: 'center'}", '{padding: 1}'))
  // a sheet's own parameter shadows a module const of the same name
  assert.deepEqual(
    rules(
      `const theme = {padding: 1}\nconst A = () => {\n  const styles = useStyles()\n  return (\n    <Kb.Box2 direction="vertical" fullWidth style={styles.x}>\n      <Kb.Box2 direction="vertical" fullWidth />\n    </Kb.Box2>\n  )\n}\nconst useStyles = Kb.Styles.createStyleHook(theme => ({x: {...theme}}))`
    ),
    []
  )
})

test('parent style that may change alignment or direction, or cannot be read: nothing', () => {
  for (const [style, sheet] of [
    [`styles.x`, `{x: {alignItems: 'center'}}`],
    [`styles.x`, `{x: {flexDirection: 'row'}}`],
    [`styles.x`, `{x: {display: 'flex'}}`],
    [`styles.x`, `{x: {flexWrap: 'wrap'}}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({isMobile: {alignItems: 'flex-start'}})}`],
    [`styles.x`, `{x: {...Kb.Styles.globalStyles.flexBoxRow}}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({common: shared})}`],
    [`styles.missing`, `{x: {}}`],
    [`other.x`, `{x: {}}`],
    [`Kb.Styles.collapseStyles([styles.x, getStyle(a)])`, `{x: {}}`],
    [`a || styles.y`, `{y: {}}`],
    [`[styles.y, ...more]`, `{y: {}}`],
    [`{['alignItems']: 'center'}`, `{}`],
    [`s`, `{}`],
  ] as const) {
    assert.deepEqual(rules(styled(style, sheet)), [], `${style} ${sheet}`)
  }
  for (const sheet of [`{x: {alignItems: 'center'}}`, `{y: {}}`]) {
    const hooked = `const A = () => {\n  const styles = useStyles()\n  return (\n    <Kb.Box2 direction="vertical" fullWidth style={styles.x}>\n      <Kb.Box2 direction="vertical" fullWidth />\n    </Kb.Box2>\n  )\n}\nconst useStyles = Kb.Styles.createStyleHook(theme => (${sheet}))`
    assert.deepEqual(rules(hooked), [], sheet)
  }
  const flipped = `${inVertical(`<Kb.Box2 direction="vertical" fullWidth alignSelf="center" />`, ` fullWidth style={styles.x}`)}\nconst styles = Kb.Styles.styleSheetCreate(() => ({x: {flexDirection: 'row'}}))`
  assert.deepEqual(rules(flipped), [])
})

test('parent direction that is not a literal vertical or horizontal: nothing', () => {
  for (const dir of [`{dir}`, `{isMobile ? 'vertical' : 'horizontal'}`, `"verticalReverse"`, `"horizontalReverse"`]) {
    const src = `const A = () => <Kb.Box2 direction=${dir} fullWidth fullHeight><Kb.Box2 direction="vertical" fullWidth fullHeight={false} alignSelf="center" /><Kb.Box2 direction="vertical" fullWidth /><Kb.Box2 direction="vertical" fullHeight /></Kb.Box2>`
    assert.deepEqual(rules(src), [], dir)
  }
  assert.deepEqual(rules(`const A = () => <Kb.Box2 direction={'vertical'} fullWidth><Kb.Box2 direction="vertical" fullWidth /></Kb.Box2>`), ['C1:fullWidth:1'])
})

test('non-target parent or child: nothing', () => {
  for (const src of [
    `const A = () => <Kb.ScrollView direction="vertical"><Kb.Box2 direction="vertical" fullWidth /></Kb.ScrollView>`,
    `const A = () => <View><Kb.Box2 direction="vertical" fullWidth alignSelf="center" /></View>`,
    `const A = () => <Kb.Box2 direction="vertical" fullWidth><Kb.Button fullWidth /></Kb.Box2>`,
    `const A = () => <Kb.Box2 direction="vertical" fullWidth><Kb.Text type="Body" alignSelf="center" fullWidth /></Kb.Box2>`,
    `const A = () => <Kb.Box2 direction="vertical" fullWidth><Kb.ScrollView><Kb.Box2 direction="vertical" fullWidth /></Kb.ScrollView></Kb.Box2>`,
    `const A = () => <Kb.Box2 direction="vertical" fullWidth><Kb.List renderItem={() => <Kb.Box2 direction="vertical" fullWidth />} /></Kb.Box2>`,
  ]) {
    assert.deepEqual(rules(src), [], src)
  }
})

test('the nearest parent is the one whose children hold the child', () => {
  assert.deepEqual(
    rules(`const A = () => <Kb.Box2 direction="vertical" fullWidth>{xs.map(x => <Kb.Box2 key={x} direction="horizontal" fullWidth />)}{c ? <><Kb.Box2 direction="horizontal" fullWidth /></> : null}</Kb.Box2>`),
    ['C1:fullWidth:1', 'C1:fullWidth:1']
  )
  assert.deepEqual(rules(`const B = () => <Kb.Box2 direction="horizontal" fullWidth />`), [])
  assert.deepEqual(
    rules(`const C = () => <Kb.Box2 direction="vertical" tooltip={<Kb.Box2 direction="horizontal" fullWidth />} />`),
    []
  )
})

test('both a child and its parent can be candidates', () => {
  const src = `const A = () => (
  <Kb.Box2 direction="vertical" fullWidth>
    <Kb.Box2 direction="horizontal" fullWidth fullHeight alignSelf="center">
      <Kb.Box2 direction="vertical" fullHeight />
    </Kb.Box2>
  </Kb.Box2>
)`
  assert.deepEqual(rules(src), ['C3:alignSelf:3', 'C2:fullHeight:4'])
  assert.equal(
    clean(src),
    `const A = () => (
  <Kb.Box2 direction="vertical" fullWidth>
    <Kb.Box2 direction="horizontal" fullWidth fullHeight>
      <Kb.Box2 direction="vertical" />
    </Kb.Box2>
  </Kb.Box2>
)`
  )
})

test('a parent not full on the cross axis: nothing', () => {
  for (const parent of ['', ' fullWidth={x}', ' fullWidth={false}', ' fullHeight']) {
    assert.deepEqual(rules(inVertical(`<Kb.Box2 direction="horizontal" fullWidth />`, parent)), [], parent)
    assert.deepEqual(rules(inVertical(`<Kb.Box2 direction="vertical" fullWidth alignSelf="center" />`, parent)), [], parent)
  }
  for (const parent of ['', ' fullHeight={x}', ' fullWidth']) {
    assert.deepEqual(rules(inHorizontal(`<Kb.Box2 direction="vertical" fullHeight />`, parent)), [], parent)
  }
})

test('a fullWidth child of a centered, content-sized parent is not a candidate', () => {
  const src = `const A = () => {
  const styles = useStyles()
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 alignSelf="center" direction="vertical" padding="small" style={styles.mainBox} gap="xsmall">
        <Kb.ClickableBox onClick={_onLabelClick} direction="vertical" fullWidth={true}>
          <Kb.Checkbox label="x" checked={a} onCheck={b} />
        </Kb.ClickableBox>
      </Kb.Box2>
    </Kb.Box2>
  )
}
const useStyles = Kb.Styles.createStyleHook(() => ({
  mainBox: Kb.Styles.platformStyles({
    isElectron: {alignSelf: 'flex-start', maxWidth: 550, width: '100%'},
    isTablet: {alignSelf: 'flex-start', width: Kb.Styles.globalStyles.largeWidthPercent},
  }),
}))`
  assert.deepEqual(rules(src), [])
  assert.deepEqual(rules(src.replace('padding="small" style', 'padding="small" fullWidth style')), ['C1:fullWidth:6'])
})

test('one change per site per pass: C3 now, C1 on a later pass', () => {
  const src = inVertical(`<Kb.Box2 direction="vertical" fullWidth alignSelf="flex-start" />`)
  const once = clean(src)
  assert.deepEqual(rules(once), ['C1:fullWidth:3'])
})

test('a child reaching the parent through anything but map, &&, ?: or a fragment has no parent', () => {
  for (const inner of [
    `{helper(<Kb.Box2 direction="horizontal" fullWidth />)}`,
    `{xs.forEach(() => <Kb.Box2 direction="horizontal" fullWidth />)}`,
    `{xs.map(x => { if (x) { return <Kb.Box2 direction="horizontal" fullWidth /> } return null })}`,
    `{xs.map(x => [<Kb.Box2 key={x} direction="horizontal" fullWidth />])}`,
    `{xs.map(x => x, () => <Kb.Box2 direction="horizontal" fullWidth />)}`,
    `{(() => <Kb.Box2 direction="horizontal" fullWidth />)()}`,
  ]) {
    assert.deepEqual(rules(`const A = () => <Kb.Box2 direction="vertical" fullWidth>${inner}</Kb.Box2>`), [], inner)
  }
  assert.deepEqual(
    rules(
      `const A = () => <Kb.Box2 direction="vertical" fullWidth>{xs.map(x => {\n  const y = x\n  return <Kb.Box2 key={y} direction="horizontal" fullWidth />\n})}{a && <Kb.Box2 direction="horizontal" fullWidth />}{(<Kb.Box2 direction="horizontal" fullWidth />)}</Kb.Box2>`
    ),
    ['C1:fullWidth:3', 'C1:fullWidth:4', 'C1:fullWidth:4']
  )
})

test('a duplicate style sheet key: the last one counts', () => {
  assert.deepEqual(rules(styled(`styles.x`, `{x: {padding: 1}, x: {alignItems: 'center'}}`)), [])
  assert.deepEqual(rules(styled(`styles.x`, `{x: {alignItems: 'center'}, x: {padding: 1}}`)), ['C1:fullWidth:3'])
})

// the gate platforms each pin-shaped site in `body` needs, or why none can stand for it
const needs = (body: string, file = 'settings/a.tsx', imports = '') =>
  u4Candidates(`import * as Kb from '@/common-adapters'\n${imports}\n${body}`, `/x/shared/${file}`).sites.map(s =>
    'why' in s.need ? s.need.why : s.need.platforms.join('+')
  )
const pinBox = (n: string | number = '') => `<Kb.Box2 alignSelf="center" direction="vertical" gap="${n}" />`

test('gate platforms by file name', () => {
  assert.deepEqual(needs(`const A = () => ${pinBox()}`), ['desktop+ios'])
  assert.deepEqual(needs(`const A = () => ${pinBox()}`, 'settings/a.desktop.tsx'), ['desktop'])
  assert.deepEqual(needs(`const A = () => ${pinBox()}`, 'settings/a.native.tsx'), ['ios'])
  assert.deepEqual(needs(`const A = () => ${pinBox()}`, 'settings/a.ios.tsx'), ['ios'])
  assert.deepEqual(needs(`const A = () => ${pinBox()}`, 'settings/a.android.tsx'), [
    'unreachable by the gate: only on android among mobile devices',
  ])
})

test('a site in a platform branch needs only the gate platforms of that branch', () => {
  const both = 'desktop+ios'
  // ternary, &&, ||, either arm
  assert.deepEqual(needs(`const A = () => (isMobile ? ${pinBox(1)} : ${pinBox(2)})`), ['ios', 'desktop'])
  assert.deepEqual(needs(`const A = () => (!isElectron ? ${pinBox(1)} : ${pinBox(2)})`), ['ios', 'desktop'])
  assert.deepEqual(needs(`const A = () => <>{isMobile && ${pinBox(1)}}{isElectron || ${pinBox(2)}}</>`), ['ios', 'ios'])
  assert.deepEqual(needs(`const A = () => <>{Kb.Styles.isMobile && ${pinBox(1)}}{isMobile ?? ${pinBox(2)}}</>`), [
    both,
    both,
  ])
  // compound tests are evaluated per device
  assert.deepEqual(needs(`const A = () => (isMobile && x ? ${pinBox(1)} : ${pinBox(2)})`), ['ios', both])
  assert.deepEqual(needs(`const A = () => (x || isElectron ? ${pinBox(1)} : ${pinBox(2)})`), [both, 'ios'])
  assert.deepEqual(needs(`const A = () => (x ? ${pinBox(1)} : ${pinBox(2)})`), [both, both])
  // nested branches narrow in turn; an iPad-only or Android-only site has no gate device
  assert.deepEqual(
    needs(`const A = () => (isMobile ? (C.isTablet ? ${pinBox(1)} : ${pinBox(2)}) : isIOS && ${pinBox(3)})`, 'settings/a.tsx', `import * as C from '@/constants'`),
    ['unreachable by the gate: only on iPad among mobile devices', 'ios', 'reachable on no device']
  )
  assert.deepEqual(needs(`const A = () => (isAndroid ? ${pinBox(1)} : ${pinBox(2)})`), [
    'unreachable by the gate: only on android among mobile devices',
    both,
  ])
  // the other arm of isIOS reaches Android and desktop: no capture sees the Android half
  assert.deepEqual(needs(`const A = () => (isIOS ? ${pinBox(1)} : ${pinBox(2)})`), [
    'ios',
    'unreachable by the gate: only on android among mobile devices',
  ])
  // isPhone's other arm is desktop and iPad: the iPad half has no gate device
  assert.deepEqual(needs(`const A = () => (Kb.Styles.isPhone ? ${pinBox(1)} : ${pinBox(2)})`), [
    'ios',
    'unreachable by the gate: only on iPad among mobile devices',
  ])
  assert.deepEqual(needs(`const A = () => (isPhone ? ${pinBox(1)} : null)`, 'settings/a.tsx', `import {isPhone} from '@/constants/platform'`), ['ios'])
  assert.deepEqual(needs(`const A = () => (isTablet ? null : ${pinBox(1)})`, 'chat/a.tsx', `import {isTablet} from '../styles'`), [both])
  // a platform file's branch for another platform is dead
  assert.deepEqual(needs(`const A = () => isMobile && ${pinBox(1)}`, 'settings/a.desktop.tsx'), ['reachable on no device'])
})

test('if statements and early returns narrow the statements they guard', () => {
  assert.deepEqual(
    needs(`function A() {\n  if (isMobile) {\n    return ${pinBox(1)}\n  } else {\n    return ${pinBox(2)}\n  }\n}`),
    ['ios', 'desktop']
  )
  assert.deepEqual(needs(`function A() {\n  if (isMobile) return null\n  return ${pinBox(1)}\n}`), ['desktop'])
  assert.deepEqual(
    needs(`const A = () => {\n  if (!isMobile) {\n    f()\n    return ${pinBox(1)}\n  }\n  const x = () => ${pinBox(2)}\n  return x()\n}`),
    ['desktop', 'ios']
  )
  assert.deepEqual(needs(`function A() {\n  if (isElectron) {\n    f()\n  } else throw new Error()\n  return ${pinBox(1)}\n}`), [
    'desktop',
  ])
  // nested blocks: the outer guard holds inside the inner block
  assert.deepEqual(
    needs(`function A() {\n  if (isElectron) return null\n  if (x) {\n    if (C.isPhone) return null\n    return ${pinBox(1)}\n  }\n  return ${pinBox(2)}\n}`, 'settings/a.tsx', `import * as C from '@/constants'`),
    ['unreachable by the gate: only on iPad among mobile devices', 'ios']
  )
  // break and continue leave the block too; an if whose branches both exit is an exit
  assert.deepEqual(
    needs(`function A() {\n  for (const x of xs) {\n    if (isMobile) {\n      if (x) break\n      continue\n    }\n    out.push(${pinBox(1)})\n  }\n}`),
    ['desktop']
  )
  assert.deepEqual(
    needs(`function A() {\n  if (isMobile) {\n    if (x) return null\n    else throw e\n  }\n  return ${pinBox(1)}\n}`),
    ['desktop']
  )
  // a guard that may fall through, guards only its loop, follows the site, or sits in another
  // function narrows nothing
  for (const body of [
    `function A() {\n  for (const x of xs) {\n    if (isMobile) break\n  }\n  return ${pinBox(1)}\n}`,
    `function A() {\n  if (isMobile) {\n    if (x) return null\n  }\n  return ${pinBox(1)}\n}`,
    `function A() {\n  if (isMobile) {\n    f()\n  }\n  return ${pinBox(1)}\n}`,
    `function A() {\n  const b = ${pinBox(1)}\n  if (isMobile) return null\n  return b\n}`,
    `function A() {\n  const g = () => {\n    if (isMobile) return null\n  }\n  return ${pinBox(1)}\n}`,
  ]) {
    assert.deepEqual(needs(body), ['desktop+ios'], body)
  }
})

test('closures follow their branch; declarations, unknown names and shadowed flags do not', () => {
  assert.deepEqual(needs(`const A = () => (isMobile ? xs.map(x => ${pinBox(1)}) : null)`), ['ios'])
  assert.deepEqual(needs(`const A = () => {\n  if (isMobile) return null\n  const r = function () { return ${pinBox(1)} }\n  return r()\n}`), [
    'desktop',
  ])
  assert.deepEqual(
    needs(`function A() {\n  if (isMobile) return null\n  function r() { return ${pinBox(1)} }\n  return r()\n}`),
    ['desktop+ios']
  )
  assert.deepEqual(needs(`class A { render() { return isMobile ? ${pinBox(1)} : null } }`), ['ios'])
  assert.deepEqual(needs(`const A = () => {\n  if (isMobile) return null\n  return {r() { return ${pinBox(1)} }}\n}`), ['desktop'])
  assert.deepEqual(
    needs(`const A = () => isMobile && <B r={() => { if (isIOS) return null; return ${pinBox(1)} }} />`),
    ['unreachable by the gate: only on android among mobile devices']
  )
  for (const [body, imports] of [
    [`const A = (isMobile: boolean) => isMobile && ${pinBox(1)}`, ''],
    [`const A = () => isPhone && ${pinBox(1)}`, ''],
    [`const A = () => isPhone && ${pinBox(1)}`, `import {isPhone} from './phone'`],
    [`const A = () => isTablet && ${pinBox(1)}`, `import {isPhone as isTablet} from '@/constants/platform'`],
    [`const A = () => C.isTablet && ${pinBox(1)}`, `import * as C from './c'`],
    [`const A = () => Kb.Styles.isMobile && ${pinBox(1)}`, ''],
    [`const A = () => X.Styles.isTablet && ${pinBox(1)}`, `import * as X from './x'`],
    [`const A = () => C[isTablet] && ${pinBox(1)}`, `import * as C from '@/constants'`],
    [`const A = () => Kb.Other.isTablet && ${pinBox(1)}`, ''],
  ] as const) {
    assert.deepEqual(needs(body, 'settings/a.tsx', imports), ['desktop+ios'], `${imports} ${body}`)
  }
})

// the gate platforms each pin-shaped site in `rel` needs, read as part of `files`
const projectNeeds = (files: Record<string, string>, rel: string) => {
  const project: Project = {files: new Map(Object.entries(files)), root: '/x/shared'}
  return u4Candidates(files[rel]!, `/x/shared/${rel}`, project).sites.map(s =>
    'why' in s.need ? s.need.why : s.need.platforms.join('+')
  )
}
const kb = `import * as Kb from '@/common-adapters'\n`
const pinned = `${kb}const Pin = () => ${pinBox()}\nexport default Pin\n`

test('a component reaches the devices of every read of it, across files', () => {
  // EmojiRow: rendered only on desktop, from two files
  const emoji = {
    'chat/emoji-row.tsx': pinned,
    'chat/rows.tsx': `import EmojiRow from './emoji-row'\nexport const R = () => (isMobile ? null : <EmojiRow />)\n`,
    'chat/wrapper.tsx': `import ER from '@/chat/emoji-row'\nconst show = !isMobile && x\nexport const W = () => (show && y ? <ER /> : null)\n`,
  }
  assert.deepEqual(projectNeeds(emoji, 'chat/emoji-row.tsx'), ['desktop'])
  // one read anywhere else makes it reach that read's devices too
  assert.deepEqual(projectNeeds({...emoji, 'chat/other.tsx': `import E from './emoji-row'\nexport const O = () => <E />\n`}, 'chat/emoji-row.tsx'), [
    'desktop+ios',
  ])
  // a platform file is a read on its platform only; the component file itself can be one too
  assert.deepEqual(projectNeeds({'a.tsx': pinned, 'b.native.tsx': `import P from './a'\nexport const B = () => <P />\n`}, 'a.tsx'), ['ios'])
  // a module nothing in the project reads is an entry point, and reaches every device
  assert.deepEqual(projectNeeds({'a.tsx': pinned}, 'a.tsx'), ['desktop+ios'])
  // a component nothing reads is dead
  assert.deepEqual(projectNeeds({'a.tsx': `${kb}const Pin = () => ${pinBox()}\n`}, 'a.tsx'), ['reachable on no device'])
  // names, namespaces and barrels; a namespace read of another member is not a read
  const named = `${kb}export function Pin() {\n  return ${pinBox()}\n}\n`
  assert.deepEqual(
    projectNeeds(
      {
        'a.tsx': named,
        'b.tsx': `import * as A from './a'\nexport const B = () => <>{isMobile && <A.Pin />}{A.other}</>\n`,
        'c.tsx': `export {Pin as Shown} from './a'\n`,
        'd.tsx': `import {Shown} from './c'\nexport const D = () => isIOS && <Shown></Shown>\n`,
        'e.tsx': `import * as A from './a'\nexport const E = () => <A.Other />\n`,
      },
      'a.tsx'
    ),
    ['ios']
  )
  assert.deepEqual(
    projectNeeds({'a.tsx': named, 'i.tsx': `export * from './a'\n`, 'u.tsx': `import {Pin} from './i'\nexport const U = () => <Pin />\n`}, 'a.tsx'),
    ['desktop+ios']
  )
  // dynamic import() and require() read the module where the call runs
  assert.deepEqual(
    projectNeeds({'a.tsx': pinned, 'r.tsx': `import * as React from 'react'\nexport const routes = isMobile ? {} : {a: {screen: React.lazy(async () => import('./a'))}}\n`}, 'a.tsx'),
    ['desktop']
  )
  assert.deepEqual(projectNeeds({'a.tsx': pinned, 'r.tsx': `export const f = () => isAndroid && require('./a')\n`}, 'a.tsx'), [
    'unreachable by the gate: only on android among mobile devices',
  ])
})

test('a component held in a route table, a ternary or a React wrapper narrows by where it is read', () => {
  // the tablet header: only an iPad reads the options holding it
  const tablet = `${kb}function TabletHeader() {\n  return ${pinBox()}\n}\nexport default Kb.Styles.isTablet ? {headerTitle: () => <TabletHeader />} : {}\n`
  assert.deepEqual(projectNeeds({'o.tsx': tablet, 'r.tsx': `import o from './o'\nexport const r = {getOptions: o}\n`}, 'o.tsx'), [
    'unreachable by the gate: only on iPad among mobile devices',
  ])
  // memo and forwardRef from react defer their argument; any other call may run it at load
  const wrapped = (wrap: string, imports: string) =>
    projectNeeds({'a.tsx': `${kb}${imports}\nconst Pin = ${wrap}(() => ${pinBox()})\nexport default Pin\n`, 'b.tsx': `import P from './a'\nexport const B = () => isMobile && <P />\n`}, 'a.tsx')
  assert.deepEqual(wrapped('React.memo', `import * as React from 'react'`), ['ios'])
  assert.deepEqual(wrapped('memo', `import {memo} from 'react'`), ['ios'])
  assert.deepEqual(wrapped('memo', `import {memo} from './memo'`), ['desktop+ios'])
  assert.deepEqual(wrapped('register', ''), ['desktop+ios'])
  // a class component, and a site at module level
  assert.deepEqual(
    projectNeeds({'a.tsx': `${kb}export class Pin extends C {\n  render() { return ${pinBox()} }\n}\n`, 'b.tsx': `import {Pin} from './a'\nexport const B = () => isElectron && <Pin />\n`}, 'a.tsx'),
    ['desktop']
  )
  assert.deepEqual(projectNeeds({'a.tsx': `${kb}export const el = ${pinBox()}\n`, 'b.tsx': `import {el} from './a'\nexport const B = () => isMobile && el\n`}, 'a.tsx'), [
    'desktop+ios',
  ])
})

test('reads that run nothing do not widen a component, and recursion settles', () => {
  const files = {
    'a.tsx': `${kb}import type {X} from './x'\nconst Pin = (): X => <>{${pinBox(1)}}{x && <Pin />}</>\nPin.displayName = 'Pin'\nexport type P = React.ComponentProps<typeof Pin>\nexport default Pin\n`,
    'b.tsx': `import Pin from './a'\nexport const B = () => isMobile && <Pin></Pin>\n`,
  }
  assert.deepEqual(projectNeeds(files, 'a.tsx'), ['ios'])
  // mutual recursion between two files still settles on the reads from outside the cycle
  const cycle = {
    'a.tsx': `${kb}import B from './b'\nconst A = () => <>{${pinBox(1)}}<B /></>\nexport default A\n`,
    'b.tsx': `import A from './a'\nconst B = () => (x ? <A /> : null)\nexport default B\n`,
    'c.tsx': `import A from './a'\nimport B from './b'\nexport const C = () => <>{isElectron && <A />}{isElectron && <B />}</>\n`,
  }
  assert.deepEqual(projectNeeds(cycle, 'a.tsx'), ['desktop'])
  // a function assigned rather than declared is held by the assignment, which may run anywhere
  assert.deepEqual(projectNeeds({'a.tsx': `${kb}let Pin\nPin = () => ${pinBox(1)}\nexport default Pin\n`, 'b.tsx': `import P from './a'\nexport const B = () => isMobile && <P />\n`}, 'a.tsx'), [
    'desktop+ios',
  ])
})

test('platform consts read through imports, and the desktop operating systems', () => {
  const files = {
    'constants/chat/index.tsx': `export * from './common'\n`,
    'constants/chat/common.tsx': `export {isSplit} from './layout'\n`,
    'constants/chat/layout.tsx': `import {isTablet} from '@/constants/platform'\nexport const isSplit = !isMobile || isTablet\n`,
    'constants/platform.tsx': `export const isTablet = f()\n`,
    'chat/a.tsx': `${kb}import * as Chat from '@/constants/chat'\nimport {isSplit} from '@/constants/chat/layout'\nexport const A = () => <>{Chat.isSplit && ${pinBox(1)}}{!isSplit && ${pinBox(2)}}</>\n`,
  }
  assert.deepEqual(projectNeeds(files, 'chat/a.tsx'), ['unreachable by the gate: only on iPad among mobile devices', 'ios'])
  // two files that may provide the const: unknown
  assert.deepEqual(
    projectNeeds({...files, 'constants/chat/layout.native.tsx': `export const isSplit = false\n`}, 'chat/a.tsx'),
    ['desktop+ios', 'desktop+ios']
  )
  const os = `${kb}import * as Platform from '@/constants/platform'\nimport {isLinux} from '@/constants'\n`
  assert.deepEqual(
    projectNeeds({'a.desktop.tsx': `${os}export const A = () => <>{!Platform.isMac && ${pinBox(1)}}{isLinux && ${pinBox(2)}}{Platform.isDarwin && ${pinBox(3)}}</>\n`}, 'a.desktop.tsx'),
    [
      'unreachable by the gate: only on linux or windows among desktops',
      'unreachable by the gate: only on linux among desktops',
      'desktop',
    ]
  )
})

test('module specifiers resolve to every platform variant', () => {
  const files = new Map(['a/b.desktop.tsx', 'a/b.native.tsx', 'a/c/index.tsx', 'a/d.tsx', 'x.ts'].map(f => [f, '']))
  assert.deepEqual(resolveSpecifier(files, 'a/e.tsx', './b'), ['a/b.desktop.tsx', 'a/b.native.tsx'])
  assert.deepEqual(resolveSpecifier(files, 'a/e.tsx', './c'), ['a/c/index.tsx'])
  assert.deepEqual(resolveSpecifier(files, 'q/e.tsx', '@/a/d'), ['a/d.tsx'])
  assert.deepEqual(resolveSpecifier(files, 'a/e.tsx', '../x'), ['x.ts'])
  assert.deepEqual(resolveSpecifier(files, 'a/e.tsx', 'react'), [])
  assert.deepEqual(resolveSpecifier(files, 'e.tsx', '../outside'), [])
})

test('reviewed reachability: every entry names a file in the tree and gives a reason', () => {
  const root = path.resolve(import.meta.dirname, '../..')
  for (const [rel, e] of Object.entries(platformOnly)) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel)
    assert.ok(e.reason && e.devices.length, rel)
  }
  for (const [rel, reason] of Object.entries(gateUnreachable)) {
    assert.ok(fs.existsSync(path.join(root, rel)), rel)
    assert.ok(reason, rel)
  }
  const kext = 'fs/banner/system-file-manager-integration-banner/kext-permission-popup.tsx'
  assert.deepEqual(projectNeeds({[kext]: pinned}, kext), ['desktop'])
  assert.deepEqual(projectNeeds({'settings/make-icons.page.tsx': pinned}, 'settings/make-icons.page.tsx'), [
    `unreachable by the gate: ${gateUnreachable['settings/make-icons.page.tsx']}`,
  ])
})

test('a candidate needs coverage on every platform it renders on', () => {
  const range = {end: 12, start: 10}
  const both = ['desktop', 'ios'] as const
  const at = (rel: string, desktop: Array<string>, ios: Array<string>, platforms: ReadonlyArray<'desktop' | 'ios'> = both) =>
    unmountedPlatforms({hunks: [], mounted: {desktop, ios}, platforms, range, rel})
  assert.deepEqual(at('a.tsx', ['a.tsx:10'], ['a.tsx:11']), [])
  assert.deepEqual(at('a.tsx', ['a.tsx:10'], []), ['ios'])
  assert.deepEqual(at('a.tsx', [], ['a.tsx:12']), ['desktop'])
  assert.deepEqual(at('a.tsx', ['b.tsx:10'], ['a.tsx:9']), ['desktop', 'ios'])
  assert.deepEqual(at('a.tsx', ['a.tsx:10'], [], ['desktop']), [])
  assert.deepEqual(at('a.tsx', [], ['a.tsx:10'], ['desktop']), ['desktop'])
  assert.deepEqual(at('a.tsx', [], ['a.tsx:10'], ['ios']), [])
  assert.deepEqual(at('a.tsx', ['a.tsx:10'], [], ['ios']), ['ios'])
  // base ids are carried forward through the base..tree diff: 3 lines inserted after base line 4
  const shifted = unmountedPlatforms({
    hunks: [{newCount: 3, newStart: 5, oldCount: 0, oldStart: 4}],
    mounted: {desktop: ['a.tsx:7'], ios: ['a.tsx:8']},
    platforms: both,
    range,
    rel: 'a.tsx',
  })
  assert.deepEqual(shifted, [])
})

test('a masked entry never qualifies a site; a coverage file without the masked flag is refused', () => {
  const prev = process.env['KB_VISUAL_RESULTS']
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'box2-cov-'))
  process.env['KB_VISUAL_RESULTS'] = root
  try {
    const write = (platform: string, theme: string, id: string, body: unknown) => {
      const dir = path.join(root, 'base', 's1', platform, theme, 'coverage')
      fs.mkdirSync(dir, {recursive: true})
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(body))
    }
    write('desktop', 'light', 'a', {ids: ['a.tsx:10'], masked: false})
    write('desktop', 'dark', 'people', {ids: ['a.tsx:10', 'm.tsx:4'], masked: true})
    write('ios', 'light', 'people', {ids: ['m.tsx:4'], masked: true})
    assert.deepEqual(platformCoverage('s1', 'desktop'), ['a.tsx:10'])
    assert.deepEqual(platformCoverage('s1', 'ios'), [])
    const mounted = {desktop: platformCoverage('s1', 'desktop'), ios: platformCoverage('s1', 'ios')}
    assert.deepEqual(unmountedPlatforms({hunks: [], mounted, platforms: ['desktop', 'ios'], range: {end: 4, start: 4}, rel: 'm.tsx'}), [
      'desktop',
      'ios',
    ])
    write('ios', 'light', 'old', ['m.tsx:4'])
    assert.throws(() => platformCoverage('s1', 'ios'), /no masked flag/)
  } finally {
    if (prev === undefined) delete process.env['KB_VISUAL_RESULTS']
    else process.env['KB_VISUAL_RESULTS'] = prev
    fs.rmSync(root, {force: true, recursive: true})
  }
})

const preFlipBox = `const box2SharedProps = (p: Box2Props) => {
  const style = Styles.collapseStyles([
    fullWidth && nativeStyles.fullWidth,
    !fullHeight && !fullWidth && nativeStyles.centered,
  ])
}
const box2ClassNames = (p: Box2Props) => Styles.classNames({box2_centered: !fullHeight && !fullWidth, box2_fullWidth: fullWidth})`

test('pin --write needs a box.tsx that still centers by default', () => {
  assert.equal(hasImplicitCenter(preFlipBox), true)
  assert.equal(hasImplicitCenter(preFlipBox.replace('box2_centered: !fullHeight && !fullWidth, ', '')), true)
  assert.equal(hasImplicitCenter(preFlipBox.replace('    !fullHeight && !fullWidth && nativeStyles.centered,\n', '')), true)
  assert.doesNotThrow(() => assertPinWritable(preFlipBox))
  const tree = fs.readFileSync(path.join(import.meta.dirname, '../../common-adapters/box.tsx'), 'utf8')
  assert.equal(hasImplicitCenter(tree), false)
  assert.throws(() => assertPinWritable(tree), /still center by default/)
})

test('unpin --write needs a box.tsx that stretches by default', () => {
  assert.throws(() => assertUnpinWritable(preFlipBox), /still centers/)
  const tree = fs.readFileSync(path.join(import.meta.dirname, '../../common-adapters/box.tsx'), 'utf8')
  assert.doesNotThrow(() => assertUnpinWritable(tree))
})

// ---------------------------------------------------------------- unpin

const unpin = (code: string) => unpinCandidates(code, '/x/shared/settings/a.tsx')
const unpinned = (code: string) => applyCleanup(code, unpin(code).candidates)
const unpinRules = (code: string) => unpin(code).candidates.map(c => `${c.rule}:${c.line}`)
const unpinSkips = (code: string) => unpin(code).skipped.map(s => s.reason)
const inCentering = (child: string, parent = ' alignItems="center"', tag = 'Kb.Box2') =>
  `const A = () => (\n  <${tag} direction="vertical"${parent}>\n    ${child}\n  </${tag}>\n)`

test('U1: a center pin under a parent that centers its children is removed', () => {
  for (const parent of [
    ' alignItems="center"',
    ` alignItems={'center'}`,
    ' centerChildren',
    ' centerChildren={true}',
    ' centerChildren alignItems="center"',
    ' fullWidth alignItems="center" style={{padding: 4}}',
  ]) {
    for (const pin of [`alignSelf="center"`, `alignSelf={'center'}`]) {
      const src = inCentering(`<Kb.Box2 ${pin} direction="horizontal" gap="tiny" />`, parent)
      assert.deepEqual(unpinRules(src), ['U1:3'], `${parent} ${pin}`)
      assert.equal(unpinned(src), inCentering(`<Kb.Box2 direction="horizontal" gap="tiny" />`, parent), `${parent} ${pin}`)
    }
  }
  const clickable = inCentering(`<Kb.ClickableBox alignSelf="center" direction="vertical" />`, ' centerChildren', 'Kb.ClickableBox')
  assert.deepEqual(unpinRules(clickable), ['U1:3'])
})

test('U1: a pin on its own line goes with its line', () => {
  const src = inCentering(`<Kb.Box2\n      alignSelf="center"\n      direction="vertical"\n    />`)
  assert.deepEqual(unpinRules(src), ['U1:3'])
  assert.equal(unpinned(src), inCentering(`<Kb.Box2\n      direction="vertical"\n    />`))
})

test('U2: a conditional pin under a centering parent is removed', () => {
  for (const test of [`x`, `(x)`, `p.fullWidth`, `a || b`, `!a && b.c`, `Kb.Styles.isPhone`]) {
    const src = inCentering(`<Kb.Box2 alignSelf={${test} ? undefined : 'center'} direction="vertical" fullWidth={x} />`)
    assert.deepEqual(unpinRules(src), ['U2:3'], test)
    assert.equal(unpinned(src), inCentering(`<Kb.Box2 direction="vertical" fullWidth={x} />`), test)
  }
})

test('U2: a test that may have side effects is skipped', () => {
  for (const test of [`f()`, `a.b()`, `x++`, `a[f()]`, '`${a}`']) {
    const src = inCentering(`<Kb.Box2 alignSelf={${test} ? undefined : 'center'} direction="vertical" />`)
    assert.deepEqual(unpinRules(src), [], test)
    assert.deepEqual(unpinSkips(src), ['conditional pin test may have side effects'], test)
  }
})

test('only a center pin is a candidate', () => {
  for (const a of [
    `alignSelf="flex-start"`,
    `alignSelf="stretch"`,
    `alignSelf={x}`,
    `alignSelf={x ? 'center' : undefined}`,
    `alignSelf={x ? undefined : 'flex-start'}`,
    `alignSelf={x ? 'stretch' : 'center'}`,
  ]) {
    const src = inCentering(`<Kb.Box2 ${a} direction="vertical" />`)
    assert.deepEqual(unpin(src), {candidates: [], skipped: []}, a)
  }
})

test('a parent that does not center, or may not: skipped', () => {
  for (const [parent, reason] of [
    ['', 'parent does not center'],
    [' alignItems="flex-start"', 'parent does not center'],
    [' alignItems="stretch" centerChildren', 'parent does not center'],
    [' alignItems="flex-end" centerChildren', 'parent does not center'],
    [' centerChildren={false}', 'parent does not center'],
    [' centerChildren={undefined}', 'parent does not center'],
    [' alignItems={a}', 'parent alignItems is not a literal'],
    [` alignItems={a ? 'center' : 'center'}`, 'parent alignItems is not a literal'],
    [' centerChildren={c}', 'parent centerChildren is not a literal'],
    [' fullWidth', 'parent does not center'],
  ] as const) {
    const src = inCentering(`<Kb.Box2 alignSelf="center" direction="vertical" />`, parent)
    assert.deepEqual(unpinRules(src), [], parent)
    assert.deepEqual(unpinSkips(src), [reason], parent)
  }
})

test('a parent with a spread, a className or a style that may change its cross axis: skipped', () => {
  for (const [parent, reason] of [
    [' alignItems="center" {...p}', 'parent has a spread'],
    [' centerChildren className="x"', 'parent has a className'],
    [` alignItems="center" style={{alignItems: 'flex-start'}}`, 'parent style may change its cross axis'],
    [` centerChildren style={{flexDirection: 'row'}}`, 'parent style may change its cross axis'],
    [` alignItems="center" style={{display: 'block'}}`, 'parent style may change its cross axis'],
    [' alignItems="center" style={s}', 'parent style may change its cross axis'],
  ] as const) {
    const src = inCentering(`<Kb.Box2 alignSelf="center" direction="vertical" />`, parent)
    assert.deepEqual(unpinRules(src), [], parent)
    assert.deepEqual(unpinSkips(src), [reason], parent)
  }
})

test('a child with a spread, a className or a style that may set position: skipped', () => {
  for (const [extra, reason] of [
    ['{...p}', 'child has a spread'],
    ['className="x"', 'child has a className'],
    [`style={{position: 'absolute', top: 0, bottom: 0}}`, 'child style may set position'],
    ['style={styles.abs}', 'child style may set position'],
    ['style={s}', 'child style may set position'],
  ] as const) {
    const src = `${inCentering(`<Kb.Box2 alignSelf="center" direction="vertical" ${extra} />`)}\nconst styles = Kb.Styles.styleSheetCreate(() => ({abs: Kb.Styles.platformStyles({isElectron: {position: 'absolute'}})}))`
    assert.deepEqual(unpinRules(src), [], extra)
    assert.deepEqual(unpinSkips(src), [reason], extra)
  }
})

test('a child style that provably leaves position alone is fine, alignSelf in it included', () => {
  for (const style of [`{padding: 4}`, `styles.x`, `Kb.Styles.collapseStyles([styles.x, a && {alignSelf: 'flex-start'}])`]) {
    const src = `${inCentering(`<Kb.Box2 alignSelf="center" direction="vertical" relative={true} style={${style}} />`)}\nconst styles = Kb.Styles.styleSheetCreate(() => ({x: {height: 8, width: 2}}))`
    assert.deepEqual(unpinRules(src), ['U1:3'], style)
  }
})

test('no in-place Box2/ClickableBox parent: skipped', () => {
  for (const [src, reason] of [
    [`const A = () => <Kb.Box2 alignSelf="center" direction="vertical" />`, 'no in-place parent element'],
    [
      `const A = () => <Kb.Box2 direction="vertical" centerChildren tooltip={<Kb.Box2 alignSelf="center" direction="vertical" />} />`,
      'no in-place parent element',
    ],
    [
      `const A = () => <Kb.Box2 direction="vertical" centerChildren>{helper(<Kb.Box2 alignSelf="center" direction="vertical" />)}</Kb.Box2>`,
      'no in-place parent element',
    ],
    [`const A = () => <View style={{alignItems: 'center'}}><Kb.Box2 alignSelf="center" direction="vertical" /></View>`, 'parent is not Box2/ClickableBox'],
    [
      `const A = () => <Kb.Box2 direction="vertical" centerChildren><Kb.ScrollView><Kb.Box2 alignSelf="center" direction="vertical" /></Kb.ScrollView></Kb.Box2>`,
      'parent is not Box2/ClickableBox',
    ],
  ] as const) {
    assert.deepEqual(unpinRules(src), [], src)
    assert.deepEqual(unpinSkips(src), [reason], src)
  }
})

test('the parent is reached through map, &&, ?: and fragments', () => {
  const src = `const A = () => <Kb.Box2 direction="vertical" centerChildren>{xs.map(x => <Kb.Box2 key={x} alignSelf="center" direction="vertical" />)}{c ? <><Kb.Box2 alignSelf="center" direction="vertical" /></> : null}{d && <Kb.Box2 alignSelf={e ? undefined : 'center'} direction="vertical" fullWidth={e} />}</Kb.Box2>`
  assert.deepEqual(unpinRules(src), ['U1:1', 'U1:1', 'U2:1'])
  assert.equal(
    unpinned(src),
    `const A = () => <Kb.Box2 direction="vertical" centerChildren>{xs.map(x => <Kb.Box2 key={x} direction="vertical" />)}{c ? <><Kb.Box2 direction="vertical" /></> : null}{d && <Kb.Box2 direction="vertical" fullWidth={e} />}</Kb.Box2>`
  )
})

test('nested pins are judged by their own parent, and a pinned parent can still center', () => {
  const src = `const A = () => (
  <Kb.Box2 direction="vertical" alignItems="center">
    <Kb.Box2 alignSelf="center" direction="horizontal">
      <Kb.Box2 alignSelf="center" direction="vertical" />
    </Kb.Box2>
    <Kb.Box2 alignSelf="center" direction="horizontal" centerChildren>
      <Kb.Box2 alignSelf="center" direction="vertical" />
    </Kb.Box2>
  </Kb.Box2>
)`
  assert.deepEqual(unpinRules(src), ['U1:3', 'U1:6', 'U1:7'])
  assert.deepEqual(unpinSkips(src), ['parent does not center'])
  assert.equal(unpin(unpinned(src)).candidates.length, 0)
})

test('a pin from pinSource under a centering parent is a candidate', () => {
  const pinned = pinSource(inCentering(`<Kb.Box2 direction="vertical" />`), '/x/shared/settings/a.tsx').code
  assert.deepEqual(unpinRules(pinned), ['U1:3'])
  const conditional = pinSource(inCentering(`<Kb.Box2 direction="vertical" fullWidth={x} />`), '/x/shared/settings/a.tsx').code
  assert.deepEqual(unpinRules(conditional), ['U2:3'])
})

const withSheet = (child: string, sheet: string, parent = '') =>
  `${inCentering(child, parent)}\nconst styles = Kb.Styles.styleSheetCreate(() => (${sheet}))`

test('U3: a pin under a child style that sets alignSelf on every platform is removed, whatever the parent', () => {
  for (const [style, sheet] of [
    [`{alignSelf: 'flex-start'}`, `{}`],
    [`styles.x`, `{x: {alignSelf: 'stretch', padding: 4}}`],
    [`styles.x`, `{x: {...Kb.Styles.padding(4), alignSelf: 'auto'}}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({common: {alignSelf: 'flex-end'}, isElectron: {padding: 4}})}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({isMobile: {alignSelf: 'stretch'}, isElectron: {alignSelf: 'center'}, isIOS: {padding: 2}})}`],
    [`Kb.Styles.collapseStyles([styles.y, styles.x, a && {padding: 4}])`, `{x: {alignSelf: 'flex-start'}, y: {}}`],
    [`[styles.x, {margin: 2}]`, `{x: {alignSelf: 'flex-start'}}`],
    [`a ? styles.x : {alignSelf: 'stretch'}`, `{x: {alignSelf: 'flex-start'}}`],
  ] as const) {
    for (const parent of ['', ' alignItems="flex-start"', ' className="x"']) {
      const src = withSheet(`<Kb.Box2 alignSelf="center" direction="vertical" style={${style}} />`, sheet, parent)
      assert.deepEqual(unpinRules(src), ['U3:3'], `${style} ${sheet} ${parent}`)
    }
  }
  const conditional = withSheet(`<Kb.Box2 alignSelf={x ? undefined : 'center'} direction="vertical" fullWidth={x} style={styles.x} />`, `{x: {alignSelf: 'flex-start'}}`)
  assert.deepEqual(unpinRules(conditional), ['U3:3'])
  assert.equal(
    unpinned(conditional),
    withSheet(`<Kb.Box2 direction="vertical" fullWidth={x} style={styles.x} />`, `{x: {alignSelf: 'flex-start'}}`)
  )
})

test('U3: not when alignSelf may be unset on some platform or device, or a spread may replace the style', () => {
  for (const [style, sheet] of [
    [`styles.x`, `{x: {alignSelf: undefined}}`],
    [`styles.x`, `{x: {alignSelf: ''}}`],
    [`styles.x`, `{x: {alignSelf: a}}`],
    [`styles.x`, `{x: {alignSelf: 'flex-start', ...more}}`],
    [`styles.x`, `{x: {alignSelf: 'flex-start', ['alignSelf']: a}}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({isElectron: {alignSelf: 'center'}})}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({isMobile: {alignSelf: 'center'}})}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({isElectron: {alignSelf: 'center'}, isIOS: {alignSelf: 'center'}, isAndroid: {alignSelf: 'center'}})}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({common: {alignSelf: 'center'}, isTablet: {alignSelf: a}})}`],
    [`styles.x`, `{x: Kb.Styles.platformStyles({common: {alignSelf: 'center'}, isElectron: s})}`],
    [`Kb.Styles.collapseStyles([styles.x, a && b])`, `{x: {alignSelf: 'flex-start'}}`],
    [`a && styles.x`, `{x: {alignSelf: 'flex-start'}}`],
    [`a ? styles.x : undefined`, `{x: {alignSelf: 'flex-start'}}`],
    [`s`, `{}`],
  ] as const) {
    const src = withSheet(`<Kb.Box2 alignSelf="center" direction="vertical" style={${style}} />`, sheet)
    assert.deepEqual(unpinRules(src), [], `${style} ${sheet}`)
  }
  const spread = withSheet(`<Kb.Box2 alignSelf="center" direction="vertical" style={styles.x} {...p} />`, `{x: {alignSelf: 'flex-start'}}`)
  assert.deepEqual(unpinRules(spread), [])
  const impure = withSheet(`<Kb.Box2 alignSelf={f() ? undefined : 'center'} direction="vertical" style={styles.x} />`, `{x: {alignSelf: 'flex-start'}}`)
  assert.deepEqual(unpinSkips(impure), ['conditional pin test may have side effects'])
})

// ---------------------------------------------------------------- unpin by coverage

const u4 = (code: string) => u4Candidates(code, '/x/shared/settings/a.tsx')
const u4Sites = (code: string) => u4(code).sites.map(c => `${c.line}:${c.nth}:${c.tag}`)

test('U4: every pin-shaped site is a candidate, whatever its parent', () => {
  const src = [
    'const A = () => (',
    '  <Kb.Box2 direction="horizontal" alignItems="flex-start">',
    '    <Kb.Box2 alignSelf="center" direction="vertical" gap="tiny" />',
    `    <Kb.ClickableBox alignSelf={x ? undefined : 'center'} direction="vertical" fullWidth={x} />`,
    `    {cond && <Kb.Box2 alignSelf={'center'} direction="vertical" />}`,
    '  </Kb.Box2>',
    ')',
  ].join('\n')
  assert.deepEqual(u4Sites(src), [
    '3:1:<Kb.Box2 direction="vertical" gap="tiny" />',
    '4:1:<Kb.ClickableBox direction="vertical" fullWidth={x} />',
    '5:1:<Kb.Box2 direction="vertical" />',
  ])
  assert.deepEqual(u4(src).unusable, [])
  assert.equal(
    applyCleanup(src, u4(src).sites),
    src
      .replace(' alignSelf="center"', '')
      .replace(` alignSelf={x ? undefined : 'center'}`, '')
      .replace(` alignSelf={'center'}`, '')
  )
})

test('U4: only center pins; a spread or a test with side effects makes a pin unusable', () => {
  for (const a of [`alignSelf="flex-start"`, `alignSelf={x}`, `alignSelf={x ? 'center' : undefined}`]) {
    assert.deepEqual(u4(`const A = () => <Kb.Box2 ${a} direction="vertical" />`), {sites: [], unusable: []}, a)
  }
  assert.deepEqual(u4(`const A = () => <Kb.Box2 alignSelf="center" direction="vertical" />`).sites.length, 1)
  assert.deepEqual(u4(`const A = () => <Kb.Box2 alignSelf="center" {...p} />`), {
    sites: [],
    unusable: [{line: 1, reason: 'child has a spread'}],
  })
  assert.deepEqual(u4(`const A = () => <Kb.Box2 alignSelf={f() ? undefined : 'center'} direction="vertical" />`), {
    sites: [],
    unusable: [{line: 1, reason: 'conditional pin test may have side effects'}],
  })
  assert.deepEqual(u4(`const A = () => <Kb.Text alignSelf="center" />`), {sites: [], unusable: []})
})

test('U4: a site key collapses whitespace, drops the pin and survives line shifts and other removals', () => {
  const box = (pin: string) => `<Kb.Box2${pin}\n      direction="vertical"\n    />`
  const src = [
    'const A = () => (',
    '  <>',
    `    ${box('')}`,
    `    ${box('\n      alignSelf="center"')}`,
    `    ${box(' alignSelf="center"')}`,
    '  </>',
    ')',
  ].join('\n')
  const sites = u4(src).sites
  assert.deepEqual(
    sites.map(c => [c.line, c.nth, c.tag]),
    [
      [6, 2, '<Kb.Box2 direction="vertical" />'],
      [10, 3, '<Kb.Box2 direction="vertical" />'],
    ]
  )
  const shifted = `// one\n// two\n${applyCleanup(src, sites.slice(0, 1))}`
  assert.deepEqual(
    u4(shifted).sites.map(c => [c.line, c.nth]),
    [[11, 3]]
  )
})

test('U4 skips: matched by file, tag and nth; stale and ambiguous entries are errors', () => {
  const src = [
    'const A = () => (',
    '  <Kb.Box2 direction="vertical" fullWidth>',
    '    <Kb.Box2 alignSelf="center" direction="vertical" />',
    '    <Kb.Box2 alignSelf="center" direction="vertical" />',
    '    <Kb.Box2 alignSelf="center" direction="horizontal" />',
    '  </Kb.Box2>',
    ')',
  ].join('\n')
  const sites = u4(src).sites
  const skip = (tag: string, nth?: number, rel = 'settings/a.tsx') => ({nth, reason: 'r', rel, tag})
  const lines = (r: ReturnType<typeof matchU4Skips>) => [...r.kept.keys()].map(c => c.line)
  assert.deepEqual(lines(matchU4Skips('settings/a.tsx', sites, [skip('<Kb.Box2 direction="horizontal" />')])), [5])
  assert.deepEqual(lines(matchU4Skips('settings/a.tsx', sites, [skip('<Kb.Box2 direction="vertical" />', 2)])), [4])
  assert.deepEqual(matchU4Skips('settings/a.tsx', sites, [skip('<Kb.Box2 direction="vertical" />', 2, 'settings/b.tsx')]), {
    errors: [],
    kept: new Map(),
  })
  assert.deepEqual(matchU4Skips('settings/a.tsx', sites, [skip('<Kb.Box2 direction="vertical" />')]).errors, [
    'skip matches 2 pins, add nth: settings/a.tsx <Kb.Box2 direction="vertical" />',
  ])
  assert.deepEqual(matchU4Skips('settings/a.tsx', sites, [skip('<Kb.Box2 direction="vertical" fullWidth>')]).errors, [
    'skip matches no pin: settings/a.tsx <Kb.Box2 direction="vertical" fullWidth>',
  ])
  assert.deepEqual(matchU4Skips('settings/a.tsx', sites, [skip('<Kb.Box2 direction="vertical" />', 4)]).errors, [
    'skip matches no pin: settings/a.tsx <Kb.Box2 direction="vertical" /> (nth 4)',
  ])
})

test('U4 skip list: entries need rel, tag and a reason; the committed list parses', () => {
  assert.deepEqual(readU4Skips('[{"rel": "a.tsx", "tag": "<Kb.Box2\\n  x />", "reason": "moved"}]'), [
    {nth: undefined, reason: 'moved', rel: 'a.tsx', tag: '<Kb.Box2 x />'},
  ])
  assert.throws(() => readU4Skips('{}'), /array/)
  assert.throws(() => readU4Skips('[{"rel": "a.tsx", "tag": "<Kb.Box2 />"}]'), /reason/)
  assert.throws(() => readU4Skips('[{"rel": "a.tsx", "tag": "<Kb.Box2 />", "reason": "r", "nth": 0}]'), /nth/)
  assert.doesNotThrow(() => readU4Skips(fs.readFileSync(u4SkipsPath(), 'utf8')))
})

test('U4 plan: needs coverage on every gate platform, carries base lines forward, honors skips', () => {
  const prev = process.env['KB_VISUAL_RESULTS']
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'box2-u4-'))
  process.env['KB_VISUAL_RESULTS'] = path.join(tmp, 'results')
  const g = (...args: Array<string>) => execFileSync('git', args, {cwd: tmp, encoding: 'utf8'}).trim()
  try {
    const shared = path.join(tmp, 'shared')
    fs.mkdirSync(path.join(shared, 'settings'), {recursive: true})
    const file = (lines: Array<string>) => ['export const A = () => (', '  <>', ...lines, '  </>', ')', ''].join('\n')
    const sites = [
      '    <Kb.Box2 alignSelf="center" direction="vertical" />',
      '    <Kb.Box2 alignSelf="center" direction="horizontal" />',
      '    <Kb.Box2 alignSelf="center" gap="tiny" />',
      '    <Kb.Box2 alignSelf="center" gap="small" />',
      '    {isMobile && <Kb.Box2 alignSelf="center" gap="large" />}',
      '    {isAndroid && <Kb.Box2 alignSelf="center" gap="huge" />}',
    ]
    fs.writeFileSync(path.join(shared, 'settings', 'a.tsx'), file(sites))
    fs.writeFileSync(path.join(shared, 'settings', 'b.desktop.tsx'), file(sites.slice(0, 1)))
    g('init', '-q')
    g('add', '.')
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'base')
    const base = g('rev-parse', 'HEAD')
    const cover = (platform: string, ids: Array<string>, masked = false) => {
      const dir = path.join(tmp, 'results', 'base', base, platform, 'light', 'coverage')
      fs.mkdirSync(dir, {recursive: true})
      fs.writeFileSync(path.join(dir, `e${fs.readdirSync(dir).length}.json`), JSON.stringify({ids, masked}))
    }
    // lines 3-8 in a.tsx: 3 on both, 4 on both, 5 desktop only, 6 on iOS only under a mask, 7 (mobile
    // only) on iOS, 8 (Android only) on both
    cover('desktop', ['settings/a.tsx:3', 'settings/a.tsx:4', 'settings/a.tsx:5', 'settings/a.tsx:8', 'settings/b.desktop.tsx:3'])
    cover('ios', ['settings/a.tsx:3', 'settings/a.tsx:4', 'settings/a.tsx:7', 'settings/a.tsx:8'])
    cover('ios', ['settings/a.tsx:6'], true)
    cover('desktop', ['settings/a.tsx:6'])
    fs.writeFileSync(path.join(shared, 'settings', 'a.tsx'), `// shifted\n${file(sites)}`)
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qam', 'shift')
    const skips = [{reason: 'moved 2px', rel: 'settings/a.tsx', tag: '<Kb.Box2 direction="horizontal" />'}]
    const plan = planU4(shared, {at: 'HEAD', base, skips})
    assert.deepEqual(plan.errors, [])
    assert.deepEqual(plan.removed, ['settings/a.tsx:4', 'settings/a.tsx:8', 'settings/b.desktop.tsx:3'])
    assert.deepEqual(plan.kept, [{reason: 'moved 2px', site: 'settings/a.tsx:5'}])
    assert.deepEqual(plan.uncovered, [
      {site: 'settings/a.tsx:6', why: 'never mounted on ios'},
      {site: 'settings/a.tsx:7', why: 'never mounted on ios'},
      {site: 'settings/a.tsx:9', why: 'unreachable by the gate: only on android among mobile devices'},
    ])
    const stale = planU4(shared, {at: 'HEAD', base, skips: [...skips, {reason: 'r', rel: 'settings/gone.tsx', tag: 'x'}]})
    assert.deepEqual(stale.errors, ['skip names a file with no .tsx at HEAD: settings/gone.tsx'])
  } finally {
    if (prev === undefined) delete process.env['KB_VISUAL_RESULTS']
    else process.env['KB_VISUAL_RESULTS'] = prev
    fs.rmSync(tmp, {force: true, recursive: true})
  }
})

// ---------------------------------------------------------------- noop

const noop = (code: string) => noopCandidates(code, '/x/shared/settings/a.tsx')
const noops = (code: string) => noop(code).map(c => `${c.rule}:${c.line}`)
const nooped = (code: string) => applyCleanup(code, noop(code))
const under = (child: string, parent = '') =>
  `const A = () => (\n  <Kb.Box2 direction="vertical"${parent}>\n    ${child}\n  </Kb.Box2>\n)`

test('N1: alignSelf stretch under a parent that stretches its children', () => {
  for (const parent of ['', ' fullWidth', ' style={{padding: 4}}', ' style={Kb.Styles.globalStyles.flexOne}', ' gap="tiny"']) {
    const src = under(`<Kb.Box2 direction="horizontal" alignSelf="stretch" gap="tiny" />`, parent)
    assert.deepEqual(noops(src), ['N1:3'], parent)
    assert.equal(nooped(src), under(`<Kb.Box2 direction="horizontal" gap="tiny" />`, parent), parent)
  }
  for (const parent of [
    ' alignItems="center"',
    ' centerChildren',
    ' centerChildren={false}',
    " style={{alignItems: 'center'}}",
    ' style={s}',
    ' {...p}',
    ' className="x"',
  ]) {
    assert.deepEqual(noops(under(`<Kb.Box2 direction="horizontal" alignSelf="stretch" />`, parent)), [], parent)
  }
  for (const child of [
    `<Kb.Box2 alignSelf="center" />`,
    `<Kb.Box2 alignSelf={x} />`,
    `<Kb.Box2 alignSelf="stretch" {...p} />`,
    `<Kb.Box2 alignSelf="stretch" className="c" />`,
    `<Kb.Box2 alignSelf="stretch" style={{position: 'absolute'}} />`,
    `<Kb.Box2 alignSelf="stretch" style={s} />`,
    `<Kb.Text alignSelf="stretch" />`,
  ]) {
    assert.deepEqual(noops(under(child)), [], child)
  }
  assert.deepEqual(noops(`const A = () => <Kb.Box2 alignSelf="stretch" />`), [])
  assert.deepEqual(noops(`const A = () => <View><Kb.Box2 alignSelf="stretch" /></View>`), [])
  assert.deepEqual(noops(under(`<Kb.Box2 alignSelf="stretch" style={{padding: 2}} />`)), ['N1:3'])
  // a parent's explicit alignItems="stretch" goes first (N2); its children follow on the next pass
  const nested = under(`<Kb.Box2 alignSelf="stretch" />`, ' alignItems="stretch"')
  assert.deepEqual(noops(nested), ['N2:2'])
  assert.deepEqual(noops(nooped(nested)), ['N1:3'])
})

test('N2: alignItems stretch without centerChildren', () => {
  const src = `const A = () => <Kb.Box2 direction="vertical" alignItems="stretch" style={s} />`
  assert.deepEqual(noops(src), ['N2:1'])
  assert.equal(nooped(src), `const A = () => <Kb.Box2 direction="vertical" style={s} />`)
  for (const attrs of [
    'alignItems="stretch" centerChildren',
    'alignItems="stretch" centerChildren={x}',
    'alignItems="center"',
    'alignItems={x}',
    'alignItems="stretch" {...p}',
    'alignItems="stretch" className="c"',
  ]) {
    assert.deepEqual(noops(`const A = () => <Kb.Box2 ${attrs} />`), [], attrs)
  }
})

test('N3: a style flexDirection the direction already sets', () => {
  const inline = (dir: string, style: string) => `const A = () => <Kb.Box2${dir} style={${style}} />`
  assert.equal(nooped(inline(' direction="horizontal"', "{flexDirection: 'row', padding: 4}")), inline(' direction="horizontal"', '{padding: 4}'))
  assert.equal(nooped(inline(' direction="horizontal"', "{padding: 4, flexDirection: 'row'}")), inline(' direction="horizontal"', '{padding: 4}'))
  assert.equal(nooped(inline('', "{flexDirection: 'column'}")), `const A = () => <Kb.Box2 />`)
  assert.equal(nooped(inline(' direction="verticalReverse"', "{flexDirection: 'column-reverse'}")), `const A = () => <Kb.Box2 direction="verticalReverse" />`)
  for (const [dir, style] of [
    [' direction="vertical"', "{flexDirection: 'row'}"],
    [' direction={d}', "{flexDirection: 'row'}"],
    [' direction="horizontal"', "{...base, flexDirection: 'row'}"],
    [' direction="horizontal"', "{flexDirection: 'column', flexDirection: 'row'}"],
    [' direction="horizontal" {...p}', "{flexDirection: 'row'}"],
    [' direction="horizontal" className="c"', "{flexDirection: 'row'}"],
  ] as const) {
    assert.deepEqual(noops(inline(dir, style)), [], `${dir} ${style}`)
  }
  assert.deepEqual(noops(inline(' direction="horizontal"', "{...Kb.Styles.padding(4), flexDirection: 'row'}")), ['N3:1'])
  const sheet = (uses: string, decl = 'const', entry = "{flexDirection: 'row', padding: 4}") =>
    `const A = () => <>${uses}</>\n${decl} styles = Kb.Styles.styleSheetCreate(() => ({x: ${entry}}))`
  const two = '<Kb.Box2 direction="horizontal" style={styles.x} /><Kb.ClickableBox direction="horizontal" style={styles.x} />'
  assert.deepEqual(noops(sheet(two)), ['N3:1'])
  assert.equal(nooped(sheet(two)), sheet(two, 'const', '{padding: 4}'))
  assert.equal(nooped(sheet(two, 'const', "{flexDirection: 'row'}")), sheet(two, 'const', '{}'))
  for (const [uses, decl] of [
    ['<Kb.Box2 direction="horizontal" style={styles.x} /><Kb.Box2 direction="vertical" style={styles.x} />', 'const'],
    ['<Kb.Box2 direction="horizontal" style={styles.x} /><View style={styles.x} />', 'const'],
    ['<Kb.Box2 direction="horizontal" style={styles.x} /><Kb.Box2 direction="horizontal" title={styles.x} />', 'const'],
    ['<Kb.Box2 direction="horizontal" style={styles.x} />{f(styles)}', 'const'],
    ['<Kb.Box2 direction="horizontal" style={styles.x} />{f(styles[k])}', 'const'],
    ['<Kb.Box2 direction="horizontal" style={styles.x} />', 'export const'],
    ['<Kb.Box2 direction="horizontal" style={[styles.x]} />', 'const'],
  ] as const) {
    assert.deepEqual(noops(sheet(uses, decl)), [], `${decl} ${uses}`)
  }
  const hook = (extra: string, decl = 'const') =>
    `const A = () => {\n  const styles = useStyles()\n  return <Kb.Box2 direction="horizontal" style={styles.x} />\n}\n${extra}${decl} useStyles = Kb.Styles.createStyleHook(() => ({x: {flexDirection: 'row'}}))`
  assert.deepEqual(noops(hook('')), ['N3:3'])
  assert.deepEqual(noops(hook('', 'export const')), [])
  assert.deepEqual(noops(hook('const B = () => g(useStyles())\n')), [])
  assert.deepEqual(noops(hook('const B = () => {\n  const s = useStyles()\n  return g(s)\n}\n')), [])
})

test('N4: an alignSelf prop the box\'s own style overrides on every platform', () => {
  const sheet = `\nconst styles = Kb.Styles.styleSheetCreate(() => ({x: {alignSelf: 'flex-end'}}))`
  for (const a of ['alignSelf="flex-start"', 'alignSelf="stretch"', `alignSelf={x ? 'center' : undefined}`]) {
    const src = `const A = () => <Kb.Box2 ${a} style={styles.x} />${sheet}`
    assert.deepEqual(noops(src), ['N4:1'], a)
    assert.equal(nooped(src), `const A = () => <Kb.Box2 style={styles.x} />${sheet}`, a)
  }
  assert.deepEqual(noops(`const A = () => <Kb.Box2 alignSelf={f() ? 'center' : undefined} style={styles.x} />${sheet}`), [])
  assert.deepEqual(noops(`const A = () => <Kb.Box2 alignSelf="center" style={styles.x} {...p} />${sheet}`), [])
  assert.deepEqual(noops(`const A = () => <Kb.Box2 alignSelf="center" style={Kb.Styles.platformStyles({isMobile: {alignSelf: 'center'}})} />`), [])
})
