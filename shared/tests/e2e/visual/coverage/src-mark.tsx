// Runtime half of the visual-gate coverage transform (babel-plugin.cjs): each wrapped Box2 /
// ClickableBox call site records its mount here. Only bundled when KB_VISUAL_COVERAGE=1.
import * as React from 'react'
import {makeCoverage, type Coverage} from './registry'

// kept on the global so a hot reload of this module keeps what was recorded
const g = globalThis as {__kbVisualCoverage?: Coverage}
const coverage = (g.__kbVisualCoverage ??= makeCoverage())

export const KbSrcMark = ({id, children}: {id: string; children: React.ReactNode}): React.ReactNode => {
  React.useLayoutEffect(() => coverage.mount(id), [id])
  return children
}
