/** @jest-environment jsdom */
/// <reference types="jest" />

import {act, cleanup, render, renderHook} from '@testing-library/react'
import * as Tabs from '@/constants/tabs'
import {navigateAppend, navigateUp, switchTab} from '@/constants/router'
import {installNavigation, makeRootState, navigationWrapper} from '@/test/navigation'

jest.mock('@/constants/platform', () => ({...jest.requireActual<object>('@/constants/platform'), isMac: true}))

import {useHotKey} from './hot-key'
import {flush} from '@/test/flush'

// as a screen of the app runs it: inside a route of the real navigation tree
const renderInRoute = <P,>(hook: (p: P) => void, initialProps?: P) =>
  renderHook(hook, {initialProps, wrapper: navigationWrapper({route: 'chatRoot'}).wrapper})

const HotKey = (p: {keys: Array<string>; cb: (key: string) => void}) => {
  useHotKey(p.keys, p.cb)
  return null
}

type MutableGlobals = {isMobile: boolean}
const g = globalThis as unknown as MutableGlobals

type KeyInit = {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  target?: Element
}

const press = ({key, target, ...mods}: KeyInit) => {
  const event = new KeyboardEvent('keydown', {bubbles: true, cancelable: true, key, ...mods})
  act(() => {
    ;(target ?? document.body).dispatchEvent(event)
  })
  return event
}

describe('useHotKey', () => {
  afterEach(() => {
    cleanup()
    g.isMobile = false
  })

  test('fires the callback with the combo that matched', () => {
    const cb = jest.fn()
    renderInRoute(() => useHotKey(['mod+k'], cb))
    press({key: 'k', metaKey: true})
    expect(cb).toHaveBeenCalledWith('mod+k')
  })

  test('a matched key is prevented and stopped', () => {
    renderInRoute(() => useHotKey(['mod+k'], jest.fn()))
    const event = press({key: 'k', metaKey: true})
    expect(event.defaultPrevented).toBe(true)
  })

  test('an unmatched key is left alone', () => {
    const cb = jest.fn()
    renderInRoute(() => useHotKey(['mod+k'], cb))
    const event = press({key: 'j', metaKey: true})
    expect(cb).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  test('mod requires meta on mac and rejects a bare key', () => {
    const cb = jest.fn()
    renderInRoute(() => useHotKey(['mod+k'], cb))
    press({key: 'k'})
    press({key: 'k', ctrlKey: true})
    expect(cb).not.toHaveBeenCalled()
  })

  test('modifier state must match exactly for non-mod combos', () => {
    const cb = jest.fn()
    renderInRoute(() => useHotKey(['esc'], cb))
    press({key: 'Escape', shiftKey: true})
    expect(cb).not.toHaveBeenCalled()
    press({key: 'Escape'})
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('aliases map onto real key names', () => {
    const cases: ReadonlyArray<[string, string]> = [
      ['esc', 'Escape'],
      ['left', 'ArrowLeft'],
      ['right', 'ArrowRight'],
      ['up', 'ArrowUp'],
      ['down', 'ArrowDown'],
      ['space', ' '],
    ]
    for (const [combo, key] of cases) {
      const cb = jest.fn()
      const {unmount} = renderInRoute(() => useHotKey([combo], cb))
      press({key})
      expect(cb).toHaveBeenCalledWith(combo)
      unmount()
    }
  })

  test('key matching is case insensitive', () => {
    const cb = jest.fn()
    renderInRoute(() => useHotKey(['mod+K'], cb))
    press({key: 'K', metaKey: true})
    expect(cb).toHaveBeenCalledTimes(1)
  })

  test('a string of comma separated keys registers each one', () => {
    const cb = jest.fn((_key: string) => {})
    renderInRoute(() => useHotKey('esc,mod+k', cb))
    press({key: 'Escape'})
    press({key: 'k', metaKey: true})
    expect(cb.mock.calls.map(c => c[0])).toEqual(['esc', 'mod+k'])
  })

  test('the most recently mounted listener wins (LIFO)', () => {
    const first = jest.fn()
    const second = jest.fn()
    const Screen = (p: {later: boolean}) => (
      <>
        <HotKey keys={['esc']} cb={first} />
        {p.later ? <HotKey keys={['esc']} cb={second} /> : null}
      </>
    )
    const {rerender} = render(<Screen later={false} />, {wrapper: navigationWrapper({route: 'chatRoot'}).wrapper})
    rerender(<Screen later={true} />)
    press({key: 'Escape'})
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    rerender(<Screen later={false} />)
    press({key: 'Escape'})
    expect(first).toHaveBeenCalledTimes(1)
  })

  test('unmounting removes the listener', () => {
    const cb = jest.fn()
    const {unmount} = renderInRoute(() => useHotKey(['esc'], cb))
    unmount()
    press({key: 'Escape'})
    expect(cb).not.toHaveBeenCalled()
  })

  test('the latest callback is used without re-registering', () => {
    const first = jest.fn()
    const second = jest.fn()
    const {rerender} = renderInRoute(({cb}: {cb: () => void}) => useHotKey(['esc'], cb), {cb: first})
    rerender({cb: second})
    press({key: 'Escape'})
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  test('typing in an input does not trigger hot keys', () => {
    const cb = jest.fn()
    renderInRoute(() => useHotKey(['esc'], cb))
    const input = document.createElement('input')
    document.body.appendChild(input)
    press({key: 'Escape', target: input})
    expect(cb).not.toHaveBeenCalled()
    input.remove()
  })

  test('inputs opted in with data-allow-keyboard-shortcuts still trigger hot keys', () => {
    const cb = jest.fn()
    renderInRoute(() => useHotKey(['esc'], cb))
    const input = document.createElement('input')
    input.setAttribute('data-allow-keyboard-shortcuts', 'true')
    document.body.appendChild(input)
    press({key: 'Escape', target: input})
    expect(cb).toHaveBeenCalledTimes(1)
    input.remove()
  })

  test('an empty key list registers nothing', () => {
    const cb = jest.fn()
    renderInRoute(() => useHotKey([], cb))
    press({key: 'Escape'})
    expect(cb).not.toHaveBeenCalled()
  })

  test('mobile is a no-op', () => {
    g.isMobile = true
    const cb = jest.fn()
    // a phone's tree: the desktop tab bar is never drawn on mobile
    renderHook(() => useHotKey(['esc'], cb), {
      wrapper: navigationWrapper({layout: 'phone', route: 'chatRoot'}).wrapper,
    })
    press({key: 'Escape'})
    expect(cb).not.toHaveBeenCalled()
  })

  test('re-rendering an older listener with a fresh inline array does not steal the key', () => {
    const first = jest.fn()
    const second = jest.fn()
    // keys is a new array literal on every render, mirroring how callers pass it
    const Screen = (p: {n: number}) => (
      <>
        <HotKey keys={['esc']} cb={first} key="older" />
        {p.n >= 0 ? <HotKey keys={['esc']} cb={second} key="newer" /> : null}
      </>
    )
    const {rerender} = render(<Screen n={-1} />, {wrapper: navigationWrapper({route: 'chatRoot'}).wrapper})
    rerender(<Screen n={0} />)
    rerender(<Screen n={1} />)
    press({key: 'Escape'})
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })
})

describe('useHotKey across screens', () => {
  afterEach(cleanup)

  const installScreens = (screens: {[route: string]: () => void}) =>
    installNavigation({
      rootState: makeRootState({tab: Tabs.chatTab}),
      screen: route => {
        const cb = screens[route.name]
        return cb ? <HotKey keys={['esc']} cb={cb} /> : null
      },
    })

  test('switching tabs hands the key to the tab shown', () => {
    const onChat = jest.fn()
    const onPeople = jest.fn()
    installScreens({chatRoot: onChat, peopleRoot: onPeople})
    act(() => {
      switchTab(Tabs.peopleTab)
    })
    press({key: 'Escape'})
    expect(onPeople).toHaveBeenCalledTimes(1)
    expect(onChat).not.toHaveBeenCalled()

    act(() => {
      switchTab(Tabs.chatTab)
    })
    press({key: 'Escape'})
    expect(onChat).toHaveBeenCalledTimes(1)
    expect(onPeople).toHaveBeenCalledTimes(1)
  })

  test('a screen pushed on top takes the key, and the screen under gets it back once it is popped', () => {
    const onInbox = jest.fn()
    const onThread = jest.fn()
    installScreens({chatConversation: onThread, chatRoot: onInbox})
    act(() => {
      navigateAppend({name: 'chatConversation', params: {}})
    })
    press({key: 'Escape'})
    expect(onThread).toHaveBeenCalledTimes(1)
    expect(onInbox).not.toHaveBeenCalled()

    act(() => {
      navigateUp()
    })
    press({key: 'Escape'})
    expect(onInbox).toHaveBeenCalledTimes(1)
    expect(onThread).toHaveBeenCalledTimes(1)
  })

  test('a tab switched away from stays quiet, even when the tab shown has no hot key', () => {
    const onChat = jest.fn()
    installScreens({chatRoot: onChat})
    act(() => {
      switchTab(Tabs.peopleTab)
    })
    press({key: 'Escape'})
    expect(onChat).not.toHaveBeenCalled()
  })

  // native-stack keeps a covered screen rendered for its pause delay (500ms); the key goes with
  // focus, so it is quiet from the moment it is covered, not once the stack pauses it
  test('a covered screen goes quiet as soon as it is covered, and has the key again when uncovered', async () => {
    const onInbox = jest.fn()
    installScreens({chatRoot: onInbox})
    act(() => {
      navigateAppend({name: 'chatConversation', params: {}})
    })
    await flush()
    press({key: 'Escape'})
    expect(onInbox).not.toHaveBeenCalled()

    act(() => {
      navigateUp()
    })
    press({key: 'Escape'})
    expect(onInbox).toHaveBeenCalledTimes(1)
  })
})
