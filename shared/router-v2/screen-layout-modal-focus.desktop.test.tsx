/** @jest-environment jsdom */
/// <reference types="jest" />

import * as React from 'react'
import {act, render, screen} from '@testing-library/react'
import {fakeModalNavigation, setupOverlayDom} from '@/test/overlay-dom.desktop'

// Focus effects run like react-navigation's, which can blur a screen pushed as a modal and focus it
// again after it mounts.
const focusEffects: Array<{cb: () => (() => void) | undefined; cleanup?: () => void}> = []
jest.mock('@/constants', () => {
  const actual = jest.requireActual<Record<string, unknown>>('@/constants')
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    Router2: {
      ...(actual['Router2'] as object),
      useSafeFocusEffect: (cb: () => (() => void) | undefined) => {
        R.useEffect(() => {
          const item: (typeof focusEffects)[number] = {cb, cleanup: cb()}
          focusEffects.push(item)
          return () => {
            item.cleanup?.()
            focusEffects.splice(focusEffects.indexOf(item), 1)
          }
        }, [cb])
      },
    },
  }
})

import {ModalWrapper} from './screen-layout-modal.desktop'

setupOverlayDom()

const blurAndFocus = () => {
  act(() => {
    focusEffects.forEach(f => f.cleanup?.())
  })
  act(() => {
    focusEffects.forEach(f => {
      f.cleanup = f.cb()
    })
  })
}

// e.g. new chat's "Search Keybase" field
test('a field focused on mount keeps focus when the modal screen is blurred and focused again', () => {
  render(
    <ModalWrapper canGoBack={false} navigation={fakeModalNavigation()} navigationOptions={{title: 'New chat'}}>
      <input aria-label="search" autoFocus={true} />
    </ModalWrapper>
  )
  const search = screen.getByLabelText('search')
  expect(document.activeElement).toBe(search)
  blurAndFocus()
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
    render(
      <React.Suspense>
        <ModalWrapper canGoBack={false} navigation={fakeModalNavigation()} navigationOptions={{title: 'New chat'}}>
          <Lazy />
        </ModalWrapper>
      </React.Suspense>
    )

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

// As in the app: react-navigation makes the screen under a modal inert, and lifts that in the same
// commit that removes the modal, after the modal is gone. The modal's screen can unmount (and drop
// focus) before the modal itself does. Modal layouts run in StrictMode.
describe('closing gives focus back to what had it', () => {
  type Step = 'closed' | 'open' | 'contentGone'
  const App = (p: {step: Step}) => (
    <>
      <div inert={p.step !== 'closed'}>
        <textarea aria-label="composer" />
      </div>
      {p.step !== 'closed' ? (
        <React.StrictMode>
          <ModalWrapper canGoBack={false} navigation={fakeModalNavigation()} navigationOptions={{title: 'New chat'}}>
            {p.step === 'open' ? <input aria-label="search" autoFocus={true} /> : null}
          </ModalWrapper>
        </React.StrictMode>
      ) : null}
    </>
  )

  const stepThrough = async (rerender: (ui: React.ReactElement) => void, steps: ReadonlyArray<Step>) => {
    for (const step of steps) {
      // each step is its own task, a frame apart
      await act(async () => {
        rerender(<App step={step} />)
        await new Promise(resolve => requestAnimationFrame(resolve))
      })
    }
  }

  test.each([
    ['with its screen', ['closed']],
    ['after its screen unmounted and dropped focus', ['contentGone', 'closed']],
  ] as const)('a router modal closing %s', async (_, steps) => {
    const {rerender} = render(<App step="closed" />)
    const composer = screen.getByLabelText('composer')
    composer.focus()
    rerender(<App step="open" />)
    expect(document.activeElement).toBe(screen.getByLabelText('search'))
    await stepThrough(rerender, steps)
    expect(document.activeElement).toBe(composer)
  })
})
