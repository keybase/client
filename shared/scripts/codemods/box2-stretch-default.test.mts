/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  applyCleanup,
  assertPinWritable,
  cleanupCandidates,
  gatePlatforms,
  hasImplicitCenter,
  pinSource,
  platformCoverage,
  unmountedPlatforms,
} from './box2-stretch-default.mts'

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

test('gate platforms by file name', () => {
  assert.deepEqual(gatePlatforms('settings/a.tsx'), ['desktop', 'ios'])
  assert.deepEqual(gatePlatforms('settings/a.desktop.tsx'), ['desktop'])
  for (const f of ['a.native.tsx', 'a.ios.tsx', 'a.android.tsx']) assert.deepEqual(gatePlatforms(`x/${f}`), ['ios'], f)
})

test('a candidate needs coverage on every platform its file renders on', () => {
  const range = {end: 12, start: 10}
  const at = (rel: string, desktop: Array<string>, ios: Array<string>) =>
    unmountedPlatforms({hunks: [], mounted: {desktop, ios}, range, rel})
  assert.deepEqual(at('a.tsx', ['a.tsx:10'], ['a.tsx:11']), [])
  assert.deepEqual(at('a.tsx', ['a.tsx:10'], []), ['ios'])
  assert.deepEqual(at('a.tsx', [], ['a.tsx:12']), ['desktop'])
  assert.deepEqual(at('a.tsx', ['b.tsx:10'], ['a.tsx:9']), ['desktop', 'ios'])
  assert.deepEqual(at('a.desktop.tsx', ['a.desktop.tsx:10'], []), [])
  assert.deepEqual(at('a.desktop.tsx', [], ['a.desktop.tsx:10']), ['desktop'])
  assert.deepEqual(at('a.native.tsx', [], ['a.native.tsx:10']), [])
  assert.deepEqual(at('a.ios.tsx', ['a.ios.tsx:10'], []), ['ios'])
  // base ids are carried forward through the base..tree diff: 3 lines inserted after base line 4
  const shifted = unmountedPlatforms({
    hunks: [{newCount: 3, newStart: 5, oldCount: 0, oldStart: 4}],
    mounted: {desktop: ['a.tsx:7'], ios: ['a.tsx:8']},
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
    assert.deepEqual(unmountedPlatforms({hunks: [], mounted, range: {end: 4, start: 4}, rel: 'm.tsx'}), [
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
