/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  addCss,
  classifySite,
  findNoOps,
  classifyProject,
  loadProject,
  setCssIndex,
  summarize,
  type Project,
  type SiteResult,
} from './box2-fullwidth-stretch.mts'

const boxStub = `export const Box2 = (p: any) => null
export const ClickableBox = (p: any) => null
`
const base = {
  'common-adapters/box.tsx': boxStub,
  'common-adapters/index.tsx': `export {Box2, ClickableBox} from './box'\nexport {default as Wrap} from './wrap'\n`,
  'common-adapters/wrap.tsx': `import {Box2} from './box'
const Wrap = (p: {children: any}) => <Box2 direction="horizontal">{p.children}</Box2>
export default Wrap
`,
}

const withProject = (files: Record<string, string>, fn: (proj: Project) => void, css = '') => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'box2-fw-'))
  try {
    for (const [rel, src] of Object.entries({...base, ...files})) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true})
      fs.writeFileSync(path.join(root, rel), src)
    }
    const index = new Map<string, Set<string>>()
    addCss(index, css)
    setCssIndex(index)
    fn(loadProject(root))
  } finally {
    fs.rmSync(root, {force: true, recursive: true})
  }
}

const site = (proj: Project, rel: string, line: number): SiteResult => {
  const el = proj.elements.find(
    e =>
      e.file.rel === rel &&
      e.path.node.loc?.start.line === line &&
      e.path.node.openingElement.attributes.some(
        x => x.type === 'JSXAttribute' && x.name.type === 'JSXIdentifier' && /^full(Width|Height)$/.test(x.name.name)
      )
  )
  assert.ok(el, `no element at ${rel}:${line}`)
  const r = classifySite(proj, el)
  assert.ok(r, `no fullWidth/fullHeight at ${rel}:${line}`)
  return r
}

const head = `import * as Kb from '@/common-adapters'\n`

test('column parent with a definite width: SAME, and cleanup removes it under a stretch parent', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="vertical" style={{width: 300}}>
    <Kb.Box2 direction="vertical" fullWidth={true} />
  </Kb.Box2>
)
export const B = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center">
    <Kb.Box2 direction="vertical" fullWidth={true} />
  </Kb.Box2>
)
`,
    },
    proj => {
      const a = site(proj, 'a.tsx', 4)
      assert.equal(a.w?.cls, 'SAME')
      assert.equal(a.w.fix.kind, 'none')
      assert.equal(a.stretchAfter, 'removed')
      const b = site(proj, 'a.tsx', 9)
      assert.equal(b.w?.cls, 'SAME')
      // under a centering parent the stretch is what fills: it stays
      assert.equal(b.stretchAfter, 'kept')
    }
  )
})

test('row parent: fullWidth is MAIN and fullHeight is SAME across a definite height', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="horizontal" fullHeight={true} fullWidth={true}>
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} />
  </Kb.Box2>
)
`,
    },
    proj => {
      const r = site(proj, 'a.tsx', 4)
      assert.equal(r.w?.cls, 'MAIN')
      assert.deepEqual(r.w.fix, {add: ["width: '100%'"], form: 'style={Styles.globalStyles.fullWidth}', kind: 'explicit', remove: true})
      assert.equal(r.h?.cls, 'SAME')
    }
  )
})

test('own margins, sizes and position', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.m} />
    <Kb.Box2 direction="vertical" fullWidth={true} style={{width: 50}} />
    <Kb.Box2 direction="vertical" fullWidth={true} style={{width: '50%'}} />
    <Kb.Box2 direction="vertical" fullWidth={true} style={{maxWidth: 200}} />
    <Kb.Box2 direction="vertical" fullWidth={true} style={{position: 'absolute', top: 0}} />
    <Kb.Box2 direction="vertical" fullWidth={true} style={Kb.Styles.globalStyles.fillAbsolute} />
    <Kb.Box2 direction="vertical" fullWidth={true} style={{marginLeft: 0}} />
  </Kb.Box2>
)
const styles = Kb.Styles.styleSheetCreate(() => ({m: {marginHorizontal: 8}}))
`,
    },
    proj => {
      assert.equal(site(proj, 'a.tsx', 4).w?.cls, 'MARGIN')
      const w50 = site(proj, 'a.tsx', 5).w
      assert.equal(w50?.cls, 'WIDTH')
      assert.deepEqual(w50.fix, {add: ["maxWidth: '100%'"], form: 'inline object: add keys', kind: 'remove'})
      const pct = site(proj, 'a.tsx', 6).w
      assert.deepEqual(pct?.fix.kind === 'remove' && pct.fix.add, [])
      // a maxWidth box narrower than a centering parent is centered today, at the start after
      assert.equal(site(proj, 'a.tsx', 7).w?.cls, 'WIDTH')
      assert.equal(site(proj, 'a.tsx', 8).w?.cls, 'ABS')
      assert.equal(site(proj, 'a.tsx', 9).w?.cls, 'SAME')
      assert.equal(site(proj, 'a.tsx', 10).w?.cls, 'SAME')
    }
  )
})

test('maxWidth under a stretch parent is SAME', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={{maxWidth: 200}} />
  </Kb.Box2>
)
`,
    },
    proj => assert.equal(site(proj, 'a.tsx', 4).w?.cls, 'SAME')
  )
})

test('a content-sized parent: CONTENT', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="vertical" alignSelf="center">
      <Kb.Box2 direction="vertical" fullWidth={true} />
    </Kb.Box2>
  </Kb.Box2>
)
`,
    },
    proj => assert.equal(site(proj, 'a.tsx', 5).w?.cls, 'CONTENT')
  )
})

test('cross-file: a root is as safe as its worst render site, through memo and the Kb namespace', () => {
  withProject(
    {
      'common-adapters/index.tsx': `export {Box2, ClickableBox} from './box'\nexport {default as Card} from './card'\n`,
      'common-adapters/card.tsx': `import * as React from 'react'
import {Box2} from './box'
const Card = () => <Box2 direction="vertical" fullWidth={true} />
export default React.memo(Card)
`,
      'col.tsx':
        head +
        `export const C = () => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Card />
  </Kb.Box2>
)
`,
      'row.tsx':
        head +
        `export const R = () => (
  <Kb.Box2 direction="horizontal" fullWidth={true}>
    <Kb.Card />
  </Kb.Box2>
)
`,
    },
    proj => {
      const r = site(proj, 'common-adapters/card.tsx', 3)
      assert.deepEqual(r.w?.frames.map(f => f.cls).sort(), ['MAIN', 'SAME'])
      assert.equal(r.w.cls, 'MAIN')
    }
  )
})

test('cross-file: an import resolves to every platform variant of the module', () => {
  withProject(
    {
      'card.tsx': head + `export const Card = () => <Kb.Box2 direction="vertical" fullWidth={true} />\n`,
      'card.native.tsx': head + `export const Card = () => <Kb.Box2 direction="vertical" fullWidth={true} />\n`,
      'use.tsx': head + `import {Card} from './card'\nexport const U = () => <Kb.Box2 direction="horizontal"><Card /></Kb.Box2>\n`,
    },
    proj => {
      assert.equal(site(proj, 'card.tsx', 2).w?.cls, 'MAIN')
      assert.equal(site(proj, 'card.native.tsx', 2).w?.cls, 'MAIN')
    }
  )
})

test('summary: a box with both props SAME keeps one stretch, or none once cleanup removes it', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="vertical" style={{height: 10, width: 10}}>
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={Kb.Styles.globalStyles.fillAbsolute} />
  </Kb.Box2>
)
`,
    },
    proj => {
      const sum = summarize([...classifyProject(proj).values()])
      assert.equal(sum.endState.propsBefore, 2)
      assert.equal(sum.endState.deletedOutright, 2)
      assert.equal(sum.endState.stretchKept, 0)
    }
  )
})

test('route screens: lazy default export, makeScreen, destructured await import', () => {
  withProject(
    {
      'feature/page.tsx': head + `const Page = () => <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} />\nexport default Page\n`,
      'feature/other.tsx': head + `export const Other = () => <Kb.Box2 direction="vertical" fullWidth={true} />\n`,
      'feature/routes.tsx': `import * as React from 'react'
export const newRoutes = {
  page: {screen: React.lazy(async () => import('./page'))},
  other: {
    screen: React.lazy(async () => {
      const {Other} = await import('./other')
      return {default: Other}
    }),
  },
}
`,
    },
    proj => {
      const page = site(proj, 'feature/page.tsx', 2)
      assert.equal(page.w?.cls, 'SAME')
      assert.equal(page.h?.cls, 'MAIN')
      assert.equal(site(proj, 'feature/other.tsx', 2).w?.cls, 'SAME')
    }
  )
})

test('modal screens: fullHeight under a modal is unknown on the main axis height', () => {
  withProject(
    {
      'feature/page.tsx': head + `export default () => <Kb.Box2 direction="horizontal" fullHeight={true} />\n`,
      'feature/routes.tsx': `import * as React from 'react'
export const newModalRoutes = {page: {screen: React.lazy(async () => import('./page'))}}
`,
    },
    proj => {
      const r = site(proj, 'feature/page.tsx', 2)
      assert.equal(r.h?.cls, 'MAIN')
      assert.equal(r.h.frames[0]?.parentDefinite, 'unknown')
    }
  )
})

test('a child slot: the parent is where the component renders children', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Wrap>
    <Kb.Box2 direction="vertical" fullWidth={true} />
  </Kb.Wrap>
)
`,
    },
    proj => assert.equal(site(proj, 'a.tsx', 4).w?.cls, 'MAIN')
  )
})

test('a child slot reads props the usage passes (direction, style)', () => {
  withProject(
    {
      'grow.tsx': head + `const Impl = (p: {children: any; direction: 'vertical' | 'horizontal'; style?: any}) => {
  const {direction, children, style} = p
  return <Kb.Box2 direction={direction} style={style}>{children}</Kb.Box2>
}
export const Grow = (p: {children: any}) => <Impl {...p} direction="vertical" style={{width: 100}} />
export const Grow2 = (p: {children: any}) => <Impl {...p} direction="horizontal" style={{width: 100}} />
`,
      'a.tsx':
        head +
        `import {Grow, Grow2} from './grow'
export const A = () => (
  <>
    <Grow><Kb.Box2 direction="vertical" fullWidth={true} /></Grow>
    <Grow2><Kb.Box2 direction="vertical" fullWidth={true} /></Grow2>
  </>
)
`,
    },
    proj => {
      assert.equal(site(proj, 'a.tsx', 5).w?.cls, 'SAME')
      assert.equal(site(proj, 'a.tsx', 6).w?.cls, 'MAIN')
    }
  )
})

test('a style read from props resolves per render site', () => {
  withProject(
    {
      'card.tsx': head + `export const Card = (p: {style?: any}) => <Kb.Box2 direction="vertical" fullWidth={true} style={p.style} />\n`,
      'a.tsx':
        head +
        `import {Card} from './card'
export const A = () => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Card style={{marginLeft: 4}} />
    <Card />
  </Kb.Box2>
)
`,
    },
    proj => assert.deepEqual(site(proj, 'card.tsx', 2).w?.frames.map(f => f.cls).sort(), ['MARGIN', 'SAME'])
  )
})

test('alignSelf: a prop under a SAME axis is dead, a style alignSelf beats stretch', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="vertical" fullWidth={true} alignSelf="flex-start" />
    <Kb.Box2 direction="vertical" fullWidth={true} style={{alignSelf: 'center'}} />
  </Kb.Box2>
)
`,
    },
    proj => {
      assert.deepEqual(site(proj, 'a.tsx', 4).alignSelf, {dead: true, prop: 'flex-start'})
      assert.equal(site(proj, 'a.tsx', 5).w?.cls, 'ALIGNSELF_STYLE')
    }
  )
})

test('unknown parents carry a reason', () => {
  withProject(
    {
      'a.tsx':
        head +
        `const List = (p: any) => null
export const A = () => <List renderItem={() => <Kb.Box2 direction="vertical" fullWidth={true} />} />
export const B = (p: {d: any}) => (
  <Kb.Box2 direction={p.d}>
    <Kb.Box2 direction="vertical" fullWidth={true} />
  </Kb.Box2>
)
`,
    },
    proj => {
      const a = site(proj, 'a.tsx', 3)
      assert.equal(a.w?.cls, 'UNKNOWN')
      assert.match(a.w.why, /renderItem/)
      const b = site(proj, 'a.tsx', 6)
      assert.equal(b.w?.cls, 'UNKNOWN')
      assert.match(b.w.why, /direction/)
    }
  )
})

test('className: a class that sets layout makes the parent unknown, one that does not is fine', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} className="plain">
    <Kb.Box2 direction="vertical" fullWidth={true} />
  </Kb.Box2>
)
export const B = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} className="rowish">
    <Kb.Box2 direction="vertical" fullWidth={true} />
  </Kb.Box2>
)
`,
    },
    proj => {
      assert.equal(site(proj, 'a.tsx', 4).w?.cls, 'SAME')
      assert.equal(site(proj, 'a.tsx', 9).w?.cls, 'UNKNOWN')
    },
    `.plain { cursor: pointer; }\n.rowish { &.x { color: red; } flex-direction: row; }\n`
  )
})

test('a style constant imported from another module resolves', () => {
  withProject(
    {
      'consts.tsx': `export const boxStyle = {marginLeft: 8}\n`,
      'a.tsx':
        head +
        `import * as Consts from './consts'
export const A = () => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={Consts.boxStyle} />
  </Kb.Box2>
)
`,
    },
    proj => assert.equal(site(proj, 'a.tsx', 5).w?.cls, 'MARGIN')
  )
})

test('fullHeight MAIN: flex={1} only for an only child that clips, under a definite height', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="vertical" style={{height: 300}}>
    <Kb.Box2 direction="vertical" fullHeight={true} overflow="hidden" />
  </Kb.Box2>
)
export const B = () => (
  <Kb.Box2 direction="vertical" style={{height: 300}}>
    <Kb.Box2 direction="vertical" fullHeight={true} />
  </Kb.Box2>
)
export const C = () => (
  <Kb.Box2 direction="vertical" style={{height: 300}}>
    <Kb.Box2 direction="vertical" fullHeight={true} overflow="hidden" />
    <Kb.Box2 direction="vertical" />
  </Kb.Box2>
)
`,
    },
    proj => {
      assert.equal(site(proj, 'a.tsx', 4).h?.fix.kind, 'flex')
      assert.equal(site(proj, 'a.tsx', 9).h?.fix.kind, 'explicit')
      assert.equal(site(proj, 'a.tsx', 14).h?.fix.kind, 'explicit')
    }
  )
})

test('summary: SAME props collapse into one stretch, the rest are fixed up', () => {
  withProject(
    {
      'a.tsx':
        head +
        `export const A = () => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} />
    <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={{height: 50}}>
      <Kb.Box2 direction="vertical" fullHeight={true} />
    </Kb.Box2>
  </Kb.Box2>
)
export const newRoutes = {a: {screen: A}}
`,
    },
    proj => {
      const results = classifyProject(proj)
      const sum = summarize([...results.values()])
      // line 3, the screen root, and line 4: fullWidth SAME (removed by cleanup), fullHeight MAIN
      // (explicit); line 5: fullWidth SAME (removed); line 6: fullHeight SAME under a centering
      // row (kept as stretch)
      assert.equal(sum.endState.explicitAdded, 2)
      assert.equal(sum.endState.stretchKept, 1)
      assert.equal(sum.endState.cleanupRemoved.fullWidth, 3)
      assert.equal(sum.endState.cleanupRemoved.fullHeight, 0)
      assert.equal(sum.endState.deletedOutright, 3)
      assert.equal(sum.both.classes['fullWidth SAME + fullHeight MAIN'], 2)
    }
  )
})

test('no-op finder', () => {
  withProject(
    {
      'a.tsx':
        head +
        `// Box2 defaults to alignSelf center here
export const A = (p: {fullWidth?: boolean}) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="vertical" alignItems="stretch" />
    <Kb.Box2 direction="vertical" alignItems="stretch" centerChildren={true} />
    <Kb.Box2 direction="horizontal" style={{flexDirection: 'row'}} />
    <Kb.Box2 direction="vertical" alignSelf="stretch" />
    <Kb.Box2 direction="vertical" alignSelf="center" style={{alignSelf: 'flex-end'}} />
    <Kb.Box2 direction="vertical" fullWidth={true} style={{width: '100%'}} />
    <Kb.Box2 direction="vertical" fullWidth={true} style={{width: 40}} />
    <Kb.Box2 direction="vertical" fullWidth={p.fullWidth} />
  </Kb.Box2>
)
`,
    },
    proj => {
      const n = findNoOps(proj, classifyProject(proj))
      assert.deepEqual(n.alignItemsStretch, ['a.tsx:5'])
      assert.deepEqual(n.flexDirectionRestated, ['a.tsx:7'])
      assert.deepEqual(n.alignSelfStretchUnderStretch, ['a.tsx:8'])
      assert.deepEqual(n.alignSelfPropOverridden, [{cond: false, site: 'a.tsx:9'}])
      assert.deepEqual(n.size100WithFull, [{axis: 'w', cls: 'SAME', site: 'a.tsx:10'}])
      assert.deepEqual(n.fullWithOtherSize, [{axis: 'w', site: 'a.tsx:11', size: '40'}])
      assert.deepEqual(n.forwarders, [{how: 'fullWidth from props in A', site: 'a.tsx:12'}])
      assert.equal(n.staleComments.length, 1)
    }
  )
})
