/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {cleanup, render, screen} from '@testing-library/react'

jest.mock('./box', () => ({
  Box2: ({children}: {children?: React.ReactNode}) => require('react').createElement('div', null, children),
}))
jest.mock('./icon', () => ({
  __esModule: true,
  default: ({type, onClick}: {type: string; onClick?: () => void}) =>
    require('react').createElement('button', {'data-testid': 'icon', onClick, type: 'button'}, type),
}))
jest.mock('./text', () => ({
  __esModule: true,
  default: ({children, onClick, className}: Record<string, unknown> & {children?: React.ReactNode}) =>
    require('react').createElement(
      'span',
      {className: className as string, 'data-clickable': onClick ? 'true' : undefined, onClick},
      children
    ),
}))

import {Banner, BannerParagraph, ErrorBanner} from './banner'

const nbsp = ' '

describe('ErrorBanner', () => {
  afterEach(cleanup)

  test('renders nothing without an error', () => {
    const {container} = render(<ErrorBanner />)
    expect(container.innerHTML).toBe('')
    cleanup()
    expect(render(<ErrorBanner error={null} />).container.innerHTML).toBe('')
    cleanup()
    expect(render(<ErrorBanner error="" />).container.innerHTML).toBe('')
  })

  test('renders a string error', () => {
    render(<ErrorBanner error="something broke" />)
    expect(document.body.textContent).toContain('something broke')
  })

  test('renders an Error object by its message', () => {
    render(<ErrorBanner error={new Error('boom')} />)
    expect(document.body.textContent).toContain('boom')
  })

  test('an Error with an empty message renders nothing', () => {
    const {container} = render(<ErrorBanner error={new Error('')} />)
    expect(container.innerHTML).toBe('')
  })

  test('onClose adds a dismiss icon that fires', () => {
    const onClose = jest.fn()
    render(<ErrorBanner error="something broke" onClose={onClose} />)
    screen.getByTestId('icon').click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('no onClose means no dismiss icon', () => {
    render(<ErrorBanner error="something broke" />)
    expect(screen.queryByTestId('icon')).toBeNull()
  })
})

describe('BannerParagraph', () => {
  afterEach(cleanup)

  test('renders a plain string', () => {
    render(<BannerParagraph bannerColor="red" content="hello" />)
    expect(document.body.textContent).toBe('hello')
  })

  test('drops empty and undefined segments', () => {
    render(<BannerParagraph bannerColor="red" content={['a', undefined, '', 'b']} />)
    expect(document.body.textContent).toBe('ab')
  })

  test('a lone space segment becomes a non-breaking space', () => {
    render(<BannerParagraph bannerColor="red" content={['a', ' ', 'b']} />)
    expect(document.body.textContent).toBe(`a${nbsp}b`)
  })

  test('leading and trailing spaces are converted to non-breaking spaces around trimmed text', () => {
    render(<BannerParagraph bannerColor="red" content={[' padded ']} />)
    expect(document.body.textContent).toBe(`${nbsp}padded${nbsp}`)
  })

  test('clickable segments get the underline treatment and fire', () => {
    const onClick = jest.fn()
    render(<BannerParagraph bannerColor="red" content={[{onClick, text: 'click me'}]} />)
    const el = document.querySelector('[data-clickable="true"]') as HTMLElement
    expect(el.textContent).toBe('click me')
    expect(el.className).toContain('underline-hover-no-underline')
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('non clickable segments carry no underline class', () => {
    render(<BannerParagraph bannerColor="red" content={['plain']} />)
    expect(document.querySelector('[data-clickable="true"]')).toBeNull()
  })

  test('mixes strings and segment objects in order', () => {
    render(
      <BannerParagraph bannerColor="blue" content={['start ', {onClick: () => {}, text: 'link'}, ' end']} />
    )
    expect(document.body.textContent).toBe(`start${nbsp}link${nbsp}end`)
  })
})

describe('Banner', () => {
  afterEach(cleanup)

  test('a string child is wrapped in a paragraph', () => {
    render(<Banner color="green">all good</Banner>)
    expect(document.body.textContent).toContain('all good')
  })

  test('element children are rendered as given', () => {
    render(
      <Banner color="green">
        <BannerParagraph bannerColor="green" content="nested" />
      </Banner>
    )
    expect(document.body.textContent).toContain('nested')
  })
})
