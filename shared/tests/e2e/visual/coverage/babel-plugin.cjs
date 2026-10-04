// Visual-gate coverage (opt-in, KB_VISUAL_COVERAGE=1): wraps every Box2 / ClickableBox JSX call
// site in <__KbSrcMark id="<file relative to root>:<line>">, which records that it mounted. The
// element's key moves to the wrapper so lists keep their identity.
//
// It runs from the `pre` hook, before the main traversal, so it sees the source as written:
// plugins listed ahead of it (the react compiler must stay first) have not rewritten it yet.
const path = require('path')

const TAGS = new Set(['Box2', 'ClickableBox'])
const IMPORT_SOURCE = '@/tests/e2e/visual/coverage/src-mark'
const LOCAL = '__KbSrcMark'

const isTarget = name =>
  (name.type === 'JSXIdentifier' && TAGS.has(name.name)) ||
  (name.type === 'JSXMemberExpression' &&
    name.object.type === 'JSXIdentifier' &&
    name.object.name === 'Kb' &&
    TAGS.has(name.property.name))

const skipped = rel => rel.startsWith('..') || /(^|\/)(node_modules|common-adapters)\//.test(rel)

module.exports = function kbVisualCoverage({types: t}) {
  return {
    name: 'kb-visual-coverage',
    pre(file) {
      const filename = file.opts.filename
      if (!filename) return
      const root = this.opts.root ?? file.opts.cwd
      const rel = path.relative(root, filename).split(path.sep).join('/')
      if (skipped(rel)) return
      const wrapped = new WeakSet()
      let count = 0
      file.path.traverse({
        JSXElement(p) {
          const {node} = p
          if (wrapped.has(node) || !isTarget(node.openingElement.name) || !node.loc) return
          wrapped.add(node)
          const attrs = node.openingElement.attributes
          const keyIdx = attrs.findIndex(a => a.type === 'JSXAttribute' && a.name.name === 'key')
          const markAttrs = [t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral(`${rel}:${node.loc.start.line}`))]
          if (keyIdx !== -1) {
            markAttrs.push(attrs[keyIdx])
            attrs.splice(keyIdx, 1)
          }
          p.replaceWith(
            t.jsxElement(
              t.jsxOpeningElement(t.jsxIdentifier(LOCAL), markAttrs),
              t.jsxClosingElement(t.jsxIdentifier(LOCAL)),
              [node]
            )
          )
          count++
        },
      })
      if (!count) return
      file.path.unshiftContainer(
        'body',
        t.importDeclaration(
          [t.importSpecifier(t.identifier(LOCAL), t.identifier('KbSrcMark'))],
          t.stringLiteral(IMPORT_SOURCE)
        )
      )
      // a TypeScript pass drops imports it finds no references to; the new ones must be visible
      file.path.scope.crawl()
    },
    visitor: {},
  }
}
// changed-sites.mts skips the same files
module.exports.skipped = skipped
