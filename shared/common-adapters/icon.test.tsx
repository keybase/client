/** @jest-environment jsdom */
/// <reference types="jest" />

import {cleanup, render} from '@testing-library/react'
import {ClickableBox} from './box'
import {isValidIconType} from './icon.shared'
import Icon from './icon'

const iconEl = (container: HTMLElement) => container.firstElementChild as HTMLElement

describe('isValidIconType', () => {
  test('accepts real icon names', () => {
    expect(isValidIconType('iconfont-add')).toBe(true)
    expect(isValidIconType('icon-addon-file-downloading')).toBe(true)
  })

  test('rejects unknown names and the empty string', () => {
    expect(isValidIconType('iconfont-definitely-not-real')).toBe(false)
    expect(isValidIconType('')).toBe(false)
  })
})

describe('Icon (desktop)', () => {
  afterEach(cleanup)

  test('renders a class per icon type', () => {
    const {container} = render(<Icon type="iconfont-add" />)
    const el = iconEl(container)
    expect(el.className.split(' ')).toEqual(expect.arrayContaining(['icon', 'icon-gen-iconfont-add']))
  })

  test('non-font icons render nothing', () => {
    const {container} = render(<Icon type="icon-addon-file-downloading" />)
    expect(container.innerHTML).toBe('')
  })

  test('a themed color becomes a class rather than an inline color, so css can override it', () => {
    const {container} = render(<Icon type="iconfont-add" color="var(--color-blue)" />)
    const el = iconEl(container)
    expect(el.className).toContain('color_blue')
    expect(el.style.color).toBe('')
  })

  test('a raw color stays inline', () => {
    const {container} = render(<Icon type="iconfont-add" color="#ff0000" />)
    const el = iconEl(container)
    expect(el.className).not.toContain('color_')
    expect(el.style.color).toBe('rgb(255, 0, 0)')
  })

  test('hoverColor becomes a hover class', () => {
    const {container} = render(<Icon type="iconfont-add" color="#ff0000" hoverColor="var(--color-red)" />)
    expect(iconEl(container).className).toContain('hover_color_red')
  })

  test('sizeType maps onto desktop font sizes, and the default size is left off', () => {
    const cases = [
      ['Tiny', '8px'],
      ['Small', '12px'],
      ['Big', '24px'],
      ['Bigger', '36px'],
      ['Huge', '48px'],
    ] as const
    for (const [sizeType, expected] of cases) {
      const {container} = render(<Icon type="iconfont-add" sizeType={sizeType} />)
      expect(iconEl(container).style.fontSize).toBe(expected)
      cleanup()
    }
    const {container} = render(<Icon type="iconfont-add" sizeType="Default" />)
    expect(iconEl(container).style.fontSize).toBe('')
  })

  test('an explicit fontSize wins over sizeType', () => {
    const {container} = render(<Icon type="iconfont-add" sizeType="Huge" fontSize={20} />)
    expect(iconEl(container).style.fontSize).toBe('20px')
  })

  test('padding resolves through the margin scale', () => {
    const {container} = render(<Icon type="iconfont-add" padding="tiny" />)
    // globalMargins.tiny
    expect(iconEl(container).style.padding).toBe('8px')
    cleanup()
    const {container: large} = render(<Icon type="iconfont-add" padding="large" />)
    expect(iconEl(large).style.padding).toBe('40px')
  })

  test('onClick adds a pointer cursor and stops propagation', () => {
    const onClick = jest.fn()
    const onOuter = jest.fn()
    const {container} = render(
      <ClickableBox direction="vertical" onClick={onOuter}>
        <Icon type="iconfont-add" onClick={onClick} />
      </ClickableBox>
    )
    const el = container.querySelector('span') as HTMLElement
    expect(el.style.cursor).toBe('pointer')
    el.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onOuter).not.toHaveBeenCalled()
  })

  test('without onClick there is no pointer cursor', () => {
    const {container} = render(<Icon type="iconfont-add" />)
    expect(iconEl(container).style.cursor).toBe('')
  })

  test('hint and testID are forwarded', () => {
    const {container} = render(<Icon type="iconfont-add" hint="Add" testID="add-icon" />)
    const el = iconEl(container)
    expect(el.getAttribute('title')).toBe('Add')
    expect(el.getAttribute('data-testid')).toBe('add-icon')
  })
})
