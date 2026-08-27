/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as T from '@/constants/types'

// the real chrome is native/electron-only; what matters here is the sentence the
// notice ends up rendering
jest.mock('@/common-adapters', () => {
  const React = require('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    React.createElement('div', null, children)
  return {
    Box2: passThrough,
    ConnectedUsernames: ({usernames}: {usernames: string}) => React.createElement('span', null, usernames),
    Styles: {createStyleHook: () => () => ({})},
    Text: passThrough,
  }
})
jest.mock('../user-notice', () => ({
  __esModule: true,
  default: ({children}: {children?: React.ReactNode}) =>
    require('react').createElement('div', null, children),
}))
jest.mock('@/stores/current-user', () => ({useCurrentUserState: (sel: (s: unknown) => unknown) => sel({username: 'testuser'})}))
jest.mock('../../thread-context', () => ({useThreadMeta: (sel: (m: unknown) => unknown) => sel({channelname: 'general'})}))

import {cleanup, render} from '@testing-library/react'
import UsersAddedToConversation from './container'

afterEach(cleanup)

const message = (usernames: Array<string>) =>
  ({usernames} as unknown as T.Chat.MessageSystemUsersAddedToConversation)

describe('UsersAddedToConversation', () => {
  // with nobody to name the notice used to read "added  to #general."
  test('renders nothing when nobody was added', () => {
    expect(render(<UsersAddedToConversation message={message([])} />).container.innerHTML).toBe('')
  })

  test('names the added user', () => {
    const {container} = render(<UsersAddedToConversation message={message(['testuser-mac'])} />)
    expect(container.textContent).toBe('added testuser-mac to #general.')
  })

  test('addresses you directly when you are one of them', () => {
    const {container} = render(<UsersAddedToConversation message={message(['testuser', 'testuser-mac'])} />)
    expect(container.textContent).toBe('added you and testuser-mac to #general.')
  })
})
