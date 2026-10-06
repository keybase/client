// Runtime half of the visual-gate coverage transform (babel-plugin.cjs): the wrapper of a Box2 /
// ClickableBox call site. It draws its child and nothing else, and runs no hooks, so a coverage
// build renders and lays out as a plain one; at each capture the driver finds the marks on the
// fiber tree by the flag below and counts those drawn in the screenshot (visible.ts). Only bundled
// when KB_VISUAL_COVERAGE=1.
import type * as React from 'react'

export const KbSrcMark = ({children}: {id: string; children: React.ReactNode}): React.ReactNode => children
Object.assign(KbSrcMark, {__kbVisualSrcMark: true})
