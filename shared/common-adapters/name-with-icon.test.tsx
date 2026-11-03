/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {act, cleanup, render as rtlRender} from '@testing-library/react'
import {installNavigation, type InstalledNavigation} from '@/test/navigation'
import {useFollowerState} from '@/stores/followers'
import {resetAllStores} from '@/util/zustand'
import {NameWithIcon} from './name-with-icon'

// the navigation tree is mounted beside the component and draws the desktop tab bar (with its own
// avatar and clickable boxes), so every query reads only what the component rendered
let host: HTMLElement = document.body
const render = (ui: React.ReactElement) => {
  const result = rtlRender(ui)
  host = result.container
  return result
}
const avatar = () => host.querySelector<HTMLElement>('.avatar')
// the avatar's kind and size, from its class (avatar-user-size-64)
const avatarOf = () => /avatar-(user|team)-size-(\d+)/.exec(avatar()?.className ?? '')?.slice(1)
const avatarSize = () => avatarOf()?.[1]
// the follow badge is an image whose sources are named for the icon
const followIcon = () => {
  const srcset = avatar()?.querySelector('img')?.getAttribute('srcset') ?? ''
  return /images\/icons\/(icon-[a-z-]+-21)\.png/.exec(srcset)?.[1] ?? null
}
const usernameText = () => host.querySelector('.text_clickable')
const clickable = () => host.querySelector<HTMLElement>('.clickable-box2')
const follow = (p: {followers?: Array<string>; following?: Array<string>}) =>
  useFollowerState.setState({followers: new Set(p.followers), following: new Set(p.following)})

let nav: InstalledNavigation

describe('NameWithIcon', () => {
  beforeEach(() => {
    nav = installNavigation()
  })
  afterEach(() => {
    cleanup()
    nav.unmount()
    resetAllStores()
  })

  test('rejects being given both a username and a teamname', () => {
    expect(() => render(<NameWithIcon username="testuser" teamname="keybase" />)).toThrow(
      /Can only use username or teamname/
    )
  })

  test('renders an avatar for a username and an icon when one is supplied', () => {
    render(<NameWithIcon username="testuser" />)
    expect(avatarOf()?.[0]).toBe('user')
    cleanup()
    render(<NameWithIcon username="testuser" icon="iconfont-people" />)
    expect(avatar()).toBeNull()
    expect(host.querySelector('.icon-gen-iconfont-people')).not.toBeNull()
  })

  describe('avatar size', () => {
    const sizes = [
      ['smaller', '48'],
      ['small', '48'],
      ['default', '64'],
      ['big', '96'],
      ['huge', '128'],
    ] as const

    test('vertical layout derives the size from the size prop', () => {
      for (const [size, expected] of sizes) {
        render(<NameWithIcon username="testuser" size={size} />)
        expect(avatarSize()).toBe(expected)
        cleanup()
      }
    })

    test('horizontal layout uses a row height instead', () => {
      render(<NameWithIcon username="testuser" horizontal={true} />)
      expect(avatarSize()).toBe('32')
      cleanup()
      render(<NameWithIcon username="testuser" horizontal={true} size="big" />)
      expect(avatarSize()).toBe('64')
    })

    test('avatarSize overrides everything', () => {
      render(<NameWithIcon username="testuser" size="huge" avatarSize={24} />)
      expect(avatarSize()).toBe('24')
    })
  })

  describe('following overlay', () => {
    test('mutual follow', () => {
      follow({followers: ['testuser'], following: ['testuser']})
      render(<NameWithIcon username="testuser" />)
      expect(followIcon()).toBe('icon-mutual-follow-21')
    })

    test('they follow you only', () => {
      follow({followers: ['testuser']})
      render(<NameWithIcon username="testuser" />)
      expect(followIcon()).toBe('icon-follow-me-21')
    })

    test('you follow them only', () => {
      follow({following: ['testuser']})
      render(<NameWithIcon username="testuser" />)
      expect(followIcon()).toBe('icon-following-21')
    })

    test('no relationship shows no overlay', () => {
      render(<NameWithIcon username="testuser" />)
      expect(followIcon()).toBeNull()
    })

    test('horizontal layout and hideFollowingOverlay suppress it', () => {
      follow({following: ['testuser']})
      render(<NameWithIcon username="testuser" horizontal={true} />)
      expect(followIcon()).toBeNull()
      cleanup()
      render(<NameWithIcon username="testuser" hideFollowingOverlay={true} />)
      expect(followIcon()).toBeNull()
    })

    test('avatars below 48 do not support the overlay', () => {
      follow({followers: ['testuser'], following: ['testuser']})
      render(<NameWithIcon username="testuser" avatarSize={32} />)
      expect(avatarSize()).toBe('32')
      expect(followIcon()).toBeNull()

      cleanup()
      render(<NameWithIcon username="testuser" avatarSize={48} />)
      expect(followIcon()).toBe('icon-mutual-follow-21')
    })

    test('the overlay follows the store as it changes', () => {
      render(<NameWithIcon username="testuser" />)
      expect(followIcon()).toBeNull()
      act(() => follow({following: ['testuser']}))
      expect(followIcon()).toBe('icon-following-21')
    })

    test('teams never get a follow overlay', () => {
      follow({following: ['keybase']})
      render(<NameWithIcon teamname="keybase" />)
      expect(avatarOf()?.[0]).toBe('team')
      expect(followIcon()).toBeNull()
    })
  })

  describe('title vs username', () => {
    test('a title replaces the username text', () => {
      render(<NameWithIcon username="testuser" title="Some Title" />)
      expect(host.textContent).toContain('Some Title')
      expect(host.textContent).not.toContain('testuser')
    })

    test('without a title the username is rendered', () => {
      render(<NameWithIcon username="testuser" />)
      expect(usernameText()?.textContent).toBe('testuser')
    })
  })

  describe('click handling', () => {
    test('onClick makes the container clickable and passes the username', () => {
      const onClick = jest.fn()
      render(<NameWithIcon username="testuser" onClick={onClick} />)
      clickable()?.click()
      expect(onClick).toHaveBeenCalledWith('testuser')
      expect(nav.actions).toEqual([])
    })

    test('no onClick means no clickable wrapper', () => {
      render(<NameWithIcon username="testuser" />)
      expect(clickable()).toBeNull()
    })

    test('an onClick with no username does not fire', () => {
      const onClick = jest.fn()
      render(<NameWithIcon title="Some Title" onClick={onClick} />)
      const box = clickable()
      if (!box) throw new Error('no clickable box')
      box.click()
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  test('horizontal metas are separated only when both are present', () => {
    render(<NameWithIcon username="testuser" horizontal={true} metaOne="one" metaTwo="two" />)
    expect(host.textContent).toContain('·')
    cleanup()
    render(<NameWithIcon username="testuser" horizontal={true} metaOne="one" />)
    expect(host.textContent).not.toContain('·')
  })
})
