/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pinSource} from './box2-stretch-default.mts'

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

test('literal false counts as absent', () => {
  assert.equal(
    run(`const A = () => <Kb.Box2 direction="vertical" fullWidth={false} />`).code,
    `const A = () => <Kb.Box2 alignSelf="center" direction="vertical" fullWidth={false} />`
  )
  assert.equal(
    run(`const A = () => <Kb.Box2 fullWidth={false} fullHeight={y} />`).code,
    `const A = () => <Kb.Box2 alignSelf={(y) ? undefined : 'center'} fullWidth={false} fullHeight={y} />`
  )
})

test('one expression: conditional pin', () => {
  const r = run(`const A = () => <Kb.Box2 direction="vertical" fullWidth={x} />`)
  assert.equal(r.code, `const A = () => <Kb.Box2 alignSelf={(x) ? undefined : 'center'} direction="vertical" fullWidth={x} />`)
  assert.deepEqual(r.pinned, [{line: 1}])
})

test('two expressions: joined with ||', () => {
  assert.equal(
    run(`const A = () => <Kb.Box2 direction="vertical" fullWidth={x} fullHeight={y} />`).code,
    `const A = () => <Kb.Box2 alignSelf={(x) || (y) ? undefined : 'center'} direction="vertical" fullWidth={x} fullHeight={y} />`
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
    `const A = () => <Kb.Box2 alignSelf="center" direction="vertical"><Kb.Box2 alignSelf={(w) ? undefined : 'center'} direction="horizontal" fullWidth={w}><Kb.ClickableBox fullHeight /></Kb.Box2></Kb.Box2>`
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
