/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render} from '@testing-library/react'
import {desktopMakeLayout, nativeMakeLayout} from './screen-layout'

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

describe('desktop modal layout', () => {
  afterEach(cleanup)

  // React Navigation hands the layout the route's live options: getOptions merged with
  // anything the screen set through navigation.setOptions. The modal header must show those.
  test('draws the header from the live options, not a fresh getOptions', () => {
    const layout = desktopMakeLayout(true, false, false, () => ({title: 'From getOptions'}))
    const navigation = {getState: () => ({routes: [{key: 'k', name: 'chatNewChat'}]}), pop: () => {}}
    const {queryByText} = render(
      <>
        {layout({
          children: null,
          navigation: navigation as never,
          options: {title: 'From setOptions'},
          route: {key: 'k', name: 'chatNewChat', params: {}} as never,
        })}
      </>
    )
    expect(queryByText('From setOptions')).not.toBeNull()
    expect(queryByText('From getOptions')).toBeNull()
  })
})
