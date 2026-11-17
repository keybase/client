/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {iosDeviceOf, iosFlowProject, iosVariantOf} from './theme.ts'

// Each form factor and theme is its own wdio project, so the report keeps their cards apart. iPhone in
// light keeps the plain `ios-flows` it always had, so its stored cards keep their keys.
const cases: Array<[string, 'light' | 'dark', string, string | undefined, string]> = [
  ['iphone', 'light', 'ios-flows', undefined, 'iPhone'],
  ['iphone', 'dark', 'ios-flows-dark', 'dark', 'iPhone'],
  ['duo-folded', 'light', 'ios-flows-duo-folded', 'duo-folded', 'iPhone Duo Folded'],
  ['duo-unfolded', 'dark', 'ios-flows-duo-unfolded-dark', 'duo-unfolded-dark', 'iPhone Duo Unfolded'],
  ['duo-split-left', 'light', 'ios-flows-duo-split-left', 'duo-split-left', 'iPhone Duo Split Left'],
  ['duo-split-right', 'dark', 'ios-flows-duo-split-right-dark', 'duo-split-right-dark', 'iPhone Duo Split Right'],
]

for (const [ff, theme, project, variant, device] of cases) {
  test(`${ff} ${theme}: project ${project}, variant ${variant ?? 'none'}, device ${device}`, () => {
    assert.equal(iosFlowProject(ff, theme), project)
    assert.equal(iosVariantOf(project), variant)
    assert.equal(iosDeviceOf(iosVariantOf(project)), device)
  })
}
