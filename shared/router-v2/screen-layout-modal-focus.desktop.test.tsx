/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {act, render, screen} from '@testing-library/react'
import {setupOverlayDom} from '@/test/overlay-dom.desktop'

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

// new chat's "Search Keybase" field lost focus to the modal itself this way
test('a field focused on mount keeps focus when the modal screen is blurred and focused again', () => {
  render(
    <ModalWrapper canGoBack={false} navigation={{pop: () => {}} as never} navigationOptions={{title: 'New chat'}}>
      <input aria-label="search" autoFocus={true} />
    </ModalWrapper>
  )
  const search = screen.getByLabelText('search')
  expect(document.activeElement).toBe(search)
  blurAndFocus()
  expect(document.activeElement).toBe(search)
})
