/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render} from '@testing-library/react'
import ModalHeaderTitle from './modal-header-title'

// The phone branch renders react-native views, which the test mock draws as nothing: draw
// Text and Box2 as plain elements so both branches can be read.
jest.mock('./text', () => ({
  __esModule: true,
  default: (p: {children?: unknown; lineClamp?: number; type: string}) => (
    <span data-lines={p.lineClamp} data-type={p.type}>
      {p.children as string}
    </span>
  ),
}))
jest.mock('./box', () => ({
  Box2: (p: {children?: unknown; direction: string}) => <div data-direction={p.direction}>{p.children as string}</div>,
}))

const g = globalThis as {isMobile: boolean}
const texts = (container: HTMLElement) =>
  [...container.querySelectorAll('span')].map(s => `${s.dataset['type']}:${s.textContent}`)

describe('ModalHeaderTitle', () => {
  afterEach(() => {
    cleanup()
    g.isMobile = false
  })

  test('desktop, title only: one Header line', () => {
    const {container} = render(<ModalHeaderTitle title="Edit team info" />)
    expect(texts(container)).toEqual(['Header:Edit team info'])
    expect(container.querySelector('span')?.dataset['lines']).toBe('1')
  })

  test('desktop, with an avatar and subtitle: a subtitle row over the Header title', () => {
    const {container, getByTestId} = render(
      <ModalHeaderTitle title="Edit team info" subtitle="acme" avatar={<i data-testid="avatar" />} />
    )
    expect(texts(container)).toEqual(['BodyTiny:acme', 'Header:Edit team info'])
    const row = getByTestId('avatar').parentElement as HTMLElement
    expect(row.dataset['direction']).toBe('horizontal')
    expect(row.textContent).toBe('acme')
  })

  test('phone: a BodyTiny subtitle over a BodyBig title, no avatar', () => {
    g.isMobile = true
    const {container, queryByTestId} = render(
      <ModalHeaderTitle title="Edit team info" subtitle="acme" avatar={<i data-testid="avatar" />} />
    )
    expect(texts(container)).toEqual(['BodyTiny:acme', 'BodyBig:Edit team info'])
    expect(queryByTestId('avatar')).toBeNull()
  })

  test('phone, title only', () => {
    g.isMobile = true
    const {container} = render(<ModalHeaderTitle title="New team" />)
    expect(texts(container)).toEqual(['BodyBig:New team'])
  })
})
