/// <reference types="jest" />

import {nativeMakeLayout} from './screen-layout'

// react-navigation calls a screen's `layout` as a plain function from inside the
// navigator's own render (useDescriptors builds every descriptor eagerly), NOT as a
// component. Any hook a layout calls therefore lands in NativeStackNavigator's hook
// list, and the count changes with the routes on the stack - pushing a modal shifts
// the order and React errors out. So layouts must render components, never call hooks.
type Layout = ReturnType<ReturnType<typeof nativeMakeLayout>>
const callLayout = (layout: (p: any) => Layout): Layout =>
  layout({children: null, navigation: {} as never, route: {name: 'chatNewChat', params: {}} as never})

describe('native screen layouts', () => {
  test.each([
    ['modal', true, false],
    ['logged out', false, true],
    ['tab screen', false, false],
  ])('%s layout calls no hooks outside a render', (_label, isModal, isLoggedOut) => {
    const layout = nativeMakeLayout(isModal, isLoggedOut, false, () => ({}))

    expect(() => callLayout(layout)).not.toThrow()
  })
})
