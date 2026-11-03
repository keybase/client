/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, screen} from '@testing-library/react'
import {CommonActions, StackActions, useIsFocused} from '@react-navigation/core'
import {navigationRef} from '@/constants/navigator'
import {RouteModal, setupOverlayDom, showModals} from '@/test/overlay-dom.desktop'

setupOverlayDom()

// Modals here are routes of the real navigation tree (showModals), so pushing, popping, covering and
// the transition each new state renders in are the library's.

const SearchModal = () => (
  <RouteModal navigationOptions={{title: 'New chat'}}>
    <input aria-label="search" autoFocus={true} />
  </RouteModal>
)

// e.g. new chat's "Search Keybase" field
test('a field focused on mount has focus again once a modal pushed over its modal closes', () => {
  showModals(
    [
      {name: 'chatNewChat', render: () => <SearchModal />},
      {name: 'chatCreateChannel', render: () => <RouteModal navigationOptions={{title: 'Other'}}>other</RouteModal>},
    ],
    {open: ['chatNewChat']}
  )
  const search = screen.getByLabelText('search')
  expect(document.activeElement).toBe(search)
  act(() => navigationRef.dispatch(StackActions.push('chatCreateChannel')))
  expect(screen.getByText('other')).toBeTruthy()
  act(() => navigationRef.dispatch(StackActions.pop()))
  expect(document.activeElement).toBe(search)
})

// A route's screen loads lazily, under the Suspense the layout puts around the modal, e.g. new chat
// on the first open after a reload.
describe('a lazily loaded modal screen', () => {
  const lazyScreen = (Screen: React.ComponentType) => {
    let resolve: () => void = () => {}
    const loaded = new Promise<{default: React.ComponentType}>(_resolve => {
      resolve = () => _resolve({default: Screen})
    })
    return {Lazy: React.lazy(async () => loaded), resolve}
  }
  const renderModal = (Lazy: React.ComponentType) =>
    showModals([
      {
        name: 'chatNewChat',
        render: () => (
          <React.Suspense>
            <RouteModal navigationOptions={{title: 'New chat'}}>
              <Lazy />
            </RouteModal>
          </React.Suspense>
        ),
      },
    ])

  test('a field focused on mount has focus once it loads', async () => {
    const {Lazy, resolve} = lazyScreen(() => <input aria-label="search" autoFocus={true} />)
    renderModal(Lazy)
    await act(async () => {
      resolve()
      await Promise.resolve()
    })
    expect(document.activeElement).toBe(screen.getByLabelText('search'))
  })

  test('a field focused in an effect has focus once it loads', async () => {
    const Screen = () => {
      const ref = React.useRef<HTMLInputElement>(null)
      React.useEffect(() => {
        ref.current?.focus()
      }, [])
      return <input aria-label="search" ref={ref} />
    }
    const {Lazy, resolve} = lazyScreen(Screen)
    renderModal(Lazy)
    await act(async () => {
      resolve()
      await Promise.resolve()
    })
    expect(document.activeElement).toBe(screen.getByLabelText('search'))
  })
})

// As in the app: the screen under a modal is inert while the modal covers it, and that lifts in the
// same commit that removes the modal, after the modal is gone. The harness's views are stand-ins,
// so the screen here goes inert from the library's own focus state, as the app's stack view does.
// The modal's screen can unmount (and drop focus) before the modal itself does. Modal layouts run
// in StrictMode.
describe('closing gives focus back to what had it', () => {
  const Composer = () => {
    const isFocused = useIsFocused()
    return (
      <div inert={!isFocused}>
        <textarea aria-label="composer" />
      </div>
    )
  }

  const steps = {
    // the modal's content unmounts first, its route still up
    contentGone: () => navigationRef.dispatch(CommonActions.setParams({gone: true})),
    closed: () => navigationRef.dispatch(StackActions.pop()),
  }

  test.each([
    ['with its screen', ['closed']],
    ['after its screen unmounted and dropped focus', ['contentGone', 'closed']],
  ] as const)('a router modal closing %s', async (_, stepNames) => {
    showModals(
      [
        {
          name: 'chatNewChat',
          render: route => (
            <React.StrictMode>
              <RouteModal navigationOptions={{title: 'New chat'}}>
                {(route.params as {gone?: boolean} | undefined)?.gone ? null : (
                  <input aria-label="search" autoFocus={true} />
                )}
              </RouteModal>
            </React.StrictMode>
          ),
        },
      ],
      {open: [], under: () => <Composer />}
    )
    const composer = screen.getByLabelText('composer')
    composer.focus()
    act(() => navigationRef.dispatch(StackActions.push('chatNewChat')))
    expect(document.activeElement).toBe(screen.getByLabelText('search'))
    for (const step of stepNames) {
      // each step is its own task, a frame apart
      await act(async () => {
        steps[step]()
        await new Promise(resolve => requestAnimationFrame(resolve))
      })
    }
    expect(document.activeElement).toBe(composer)
  })
})
