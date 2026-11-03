/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {cleanup, render} from '@testing-library/react'
import ModalHeaderTitle from './modal-header-title'
import Text from './text'

const g = globalThis as {isMobile: boolean}

// desktop Text names its type and line clamp in its classes
const texts = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('span[class*="text_"]')].map(s => {
    const type = [...s.classList].find(c => c.startsWith('text_') && !c.startsWith('text_lineClamp'))
    return `${type?.slice('text_'.length)}:${s.textContent}`
  })

// the phone branch renders react-native Text, which carries no type name: compare each line with
// what a real Text of the expected type renders
const phoneLines = (container: HTMLElement) => [...container.firstElementChild!.children].map(c => c.outerHTML)
const phoneText = (el: React.ReactElement) => {
  const {container, unmount} = render(el)
  const html = container.firstElementChild!.outerHTML
  unmount()
  return html
}

describe('ModalHeaderTitle', () => {
  afterEach(() => {
    cleanup()
    g.isMobile = false
  })

  test('desktop, title only: one Header line', () => {
    const {container} = render(<ModalHeaderTitle title="Edit team info" />)
    expect(texts(container)).toEqual(['Header:Edit team info'])
    expect(container.querySelector('span')?.classList.contains('text_lineClamp1')).toBe(true)
  })

  test('desktop, with an avatar and subtitle: a subtitle row over the Header title', () => {
    const {container, getByTestId} = render(
      <ModalHeaderTitle title="Edit team info" subtitle="acme" avatar={<i data-testid="avatar" />} />
    )
    expect(texts(container)).toEqual(['BodyTiny:acme', 'Header:Edit team info'])
    const row = getByTestId('avatar').parentElement as HTMLElement
    expect(row.classList.contains('box2_horizontal')).toBe(true)
    expect(row.textContent).toBe('acme')
  })

  test('phone: a BodyTiny subtitle over a BodyBig title, no avatar', () => {
    g.isMobile = true
    const subtitle = phoneText(
      <Text type="BodyTiny" lineClamp={1} ellipsizeMode="middle">
        acme
      </Text>
    )
    const title = phoneText(<Text type="BodyBig">Edit team info</Text>)
    const {container, queryByTestId} = render(
      <ModalHeaderTitle title="Edit team info" subtitle="acme" avatar={<i data-testid="avatar" />} />
    )
    expect(phoneLines(container)).toEqual([subtitle, title])
    expect(queryByTestId('avatar')).toBeNull()
  })

  test('phone, title only', () => {
    g.isMobile = true
    const title = phoneText(<Text type="BodyBig">New team</Text>)
    const {container} = render(<ModalHeaderTitle title="New team" />)
    expect(phoneLines(container)).toEqual([title])
  })
})
