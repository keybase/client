/** @jest-environment jsdom */
/// <reference types="jest" />

import {act, cleanup, render} from '@testing-library/react'
import * as T from '@/constants/types'
import {useUsersState} from '@/stores/users'
import Avatar from '.'

const poop = (container: HTMLElement) => container.querySelector('img[srcset*="icon-poop-"]')

const notifyBlocked = (username: string, blocked: boolean) =>
  useUsersState.getState().dispatch.onEngineIncomingImpl({
    payload: {
      params: {
        b: {
          blocks: {[username]: [{blockType: T.RPCGen.UserBlockType.chat, blocked}]},
          username: 'testuser-mac',
        },
      },
    },
    type: 'keybase.1.NotifyTracking.notifyUserBlocked',
  } as never)

describe('Avatar blocked overlay', () => {
  afterEach(() => {
    cleanup()
    useUsersState.getState().dispatch.resetState()
  })

  test('appears when the user gets chat-blocked and goes away on unblock', () => {
    const {container} = render(<Avatar username="testuser" size={128} />)
    expect(poop(container)).toBeNull()

    act(() => notifyBlocked('testuser', true))
    expect(poop(container)?.getAttribute('srcset')).toContain('icon-poop-96')

    act(() => notifyBlocked('testuser', false))
    expect(poop(container)).toBeNull()
  })

  test('sizes too small for the overlay show none', () => {
    act(() => notifyBlocked('testuser', true))
    const {container} = render(<Avatar username="testuser" size={24} />)
    expect(poop(container)).toBeNull()
  })

  test('teams never show it', () => {
    act(() => notifyBlocked('testuser', true))
    const {container} = render(<Avatar teamname="testuser" size={128} />)
    expect(poop(container)).toBeNull()
  })
})
