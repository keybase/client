/** @jest-environment jsdom */
/// <reference types="jest" />

import type * as React from 'react'
import {cleanup, render, screen} from '@testing-library/react'

const mockFollowers = {followers: new Set<string>(), following: new Set<string>()}

jest.mock('@/stores/followers', () => ({
  useFollowerState: (sel: (s: typeof mockFollowers) => unknown) => sel(mockFollowers),
}))
jest.mock('@/teams/use-teams-list', () => ({useTeamsListNameToIDMap: () => new Map<string, string>()}))
jest.mock('@/constants/router', () => ({navToProfile: jest.fn()}))
jest.mock('./avatar', () => ({
  __esModule: true,
  default: ({
    size,
    username,
    teamname,
    children,
  }: {
    size?: number
    username?: string
    teamname?: string
    children?: React.ReactNode
  }) =>
    require('react').createElement(
      'div',
      {
        'data-testid': 'avatar',
        'data-size': String(size),
        'data-teamname': String(teamname ?? ''),
        'data-username': String(username ?? ''),
      },
      children
    ),
}))
jest.mock('./image-icon', () => ({
  __esModule: true,
  default: ({type}: {type: string}) =>
    require('react').createElement('span', {'data-testid': 'follow-icon'}, type),
}))
jest.mock('./icon-auto', () => ({
  __esModule: true,
  default: ({type}: {type: string}) =>
    require('react').createElement('span', {'data-testid': 'icon-auto'}, type),
}))
jest.mock('./icon', () => ({
  __esModule: true,
  default: ({type}: {type: string}) =>
    require('react').createElement('span', {'data-testid': 'icon'}, type),
}))
jest.mock('./usernames', () => ({
  __esModule: true,
  default: ({usernames}: {usernames: ReadonlyArray<string>}) =>
    require('react').createElement('span', {'data-testid': 'usernames'}, usernames.join(',')),
}))
jest.mock('./box', () => ({
  Box2: ({children}: {children?: React.ReactNode}) => require('react').createElement('div', null, children),
  ClickableBox: ({children, onClick}: {children?: React.ReactNode; onClick?: () => void}) =>
    require('react').createElement('div', {'data-testid': 'clickable', onClick}, children),
}))
jest.mock('./text', () => ({
  __esModule: true,
  default: ({children}: {children?: React.ReactNode}) =>
    require('react').createElement('span', null, children),
}))

import {NameWithIcon} from './name-with-icon'

const avatar = () => screen.queryByTestId('avatar')
const followIcon = () => screen.queryByTestId('follow-icon')

describe('NameWithIcon', () => {
  afterEach(() => {
    cleanup()
    mockFollowers.followers = new Set()
    mockFollowers.following = new Set()
  })

  test('rejects being given both a username and a teamname', () => {
    expect(() => render(<NameWithIcon username="testuser" teamname="keybase" />)).toThrow(
      /Can only use username or teamname/
    )
  })

  test('renders an avatar for a username and an icon when one is supplied', () => {
    render(<NameWithIcon username="testuser" />)
    expect(avatar()?.getAttribute('data-username')).toBe('testuser')
    cleanup()
    render(<NameWithIcon username="testuser" icon="iconfont-people" />)
    expect(avatar()).toBeNull()
    expect(screen.queryByTestId('icon-auto')?.textContent).toBe('iconfont-people')
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
        expect(avatar()?.getAttribute('data-size')).toBe(expected)
        cleanup()
      }
    })

    test('horizontal layout uses a row height instead', () => {
      render(<NameWithIcon username="testuser" horizontal={true} />)
      expect(avatar()?.getAttribute('data-size')).toBe('32')
      cleanup()
      render(<NameWithIcon username="testuser" horizontal={true} size="big" />)
      expect(avatar()?.getAttribute('data-size')).toBe('64')
    })

    test('avatarSize overrides everything', () => {
      render(<NameWithIcon username="testuser" size="huge" avatarSize={24} />)
      expect(avatar()?.getAttribute('data-size')).toBe('24')
    })
  })

  describe('following overlay', () => {
    test('mutual follow', () => {
      mockFollowers.following = new Set(['testuser'])
      mockFollowers.followers = new Set(['testuser'])
      render(<NameWithIcon username="testuser" />)
      expect(followIcon()?.textContent).toBe('icon-mutual-follow-21')
    })

    test('they follow you only', () => {
      mockFollowers.followers = new Set(['testuser'])
      render(<NameWithIcon username="testuser" />)
      expect(followIcon()?.textContent).toBe('icon-follow-me-21')
    })

    test('you follow them only', () => {
      mockFollowers.following = new Set(['testuser'])
      render(<NameWithIcon username="testuser" />)
      expect(followIcon()?.textContent).toBe('icon-following-21')
    })

    test('no relationship shows no overlay', () => {
      render(<NameWithIcon username="testuser" />)
      expect(followIcon()).toBeNull()
    })

    test('horizontal layout and hideFollowingOverlay suppress it', () => {
      mockFollowers.following = new Set(['testuser'])
      render(<NameWithIcon username="testuser" horizontal={true} />)
      expect(followIcon()).toBeNull()
      cleanup()
      render(<NameWithIcon username="testuser" hideFollowingOverlay={true} />)
      expect(followIcon()).toBeNull()
    })

    test('sizes with no follow badge placement drop the overlay', () => {
      mockFollowers.following = new Set(['testuser'])
      render(<NameWithIcon username="testuser" avatarSize={32} />)
      expect(followIcon()).toBeNull()
      cleanup()
      render(<NameWithIcon username="testuser" avatarSize={48} />)
      expect(followIcon()).not.toBeNull()
    })

    test('teams never get a follow overlay', () => {
      mockFollowers.following = new Set(['keybase'])
      render(<NameWithIcon teamname="keybase" />)
      expect(followIcon()).toBeNull()
    })
  })

  describe('title vs username', () => {
    test('a title replaces the username text', () => {
      render(<NameWithIcon username="testuser" title="Some Title" />)
      expect(screen.queryByTestId('usernames')).toBeNull()
      expect(document.body.textContent).toContain('Some Title')
    })

    test('without a title the username is rendered', () => {
      render(<NameWithIcon username="testuser" />)
      expect(screen.queryByTestId('usernames')?.textContent).toBe('testuser')
    })
  })

  describe('click handling', () => {
    test('onClick makes the container clickable and passes the username', () => {
      const onClick = jest.fn()
      render(<NameWithIcon username="testuser" onClick={onClick} />)
      screen.getByTestId('clickable').click()
      expect(onClick).toHaveBeenCalledWith('testuser')
    })

    test('no onClick means no clickable wrapper', () => {
      render(<NameWithIcon username="testuser" />)
      expect(screen.queryByTestId('clickable')).toBeNull()
    })

    test('an onClick with no username does not fire', () => {
      const onClick = jest.fn()
      render(<NameWithIcon title="Some Title" onClick={onClick} />)
      screen.getByTestId('clickable').click()
      expect(onClick).not.toHaveBeenCalled()
    })
  })

  test('horizontal metas are separated only when both are present', () => {
    render(<NameWithIcon username="testuser" horizontal={true} metaOne="one" metaTwo="two" />)
    expect(document.body.textContent).toContain('·')
    cleanup()
    render(<NameWithIcon username="testuser" horizontal={true} metaOne="one" />)
    expect(document.body.textContent).not.toContain('·')
  })
})
