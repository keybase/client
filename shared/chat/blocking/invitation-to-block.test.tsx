/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'

// each icon's latest onClick, by icon type, and the wave button's first onWave: the handlers a
// screen kept through an account switch still holds
const mockIconOnClick = new Map<string, () => void>()
let mockFirstOnWave: (() => void) | undefined
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<{
    Icon: React.ComponentType<{onClick?: () => void; type: string}>
    WaveButton: React.ComponentType<{onWave: () => void}>
  }>('@/common-adapters')
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    Icon: (p: {onClick?: () => void; type: string}) => {
      if (p.onClick) {
        mockIconOnClick.set(p.type, p.onClick)
      }
      return R.createElement(actual.Icon, p)
    },
    WaveButton: (p: {onWave: () => void}) => {
      mockFirstOnWave ??= p.onWave
      return R.createElement(actual.WaveButton, p)
    },
  }
})

import * as Meta from '@/constants/chat/meta'
import {useEffect} from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeMessageText} from '@/constants/chat/message'
import {metasReceived} from '@/chat/inbox/metadata'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {threadWrapper} from '@/test/thread-tree'
import {useConversationThreadActions} from '../conversation/thread-context'
import BlockButtons from './invitation-to-block'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const teamID = 'aabbccdd'
const dismissBlockButtons = 'keybase.1.user.dismissBlockButtons'
const postText = 'chat.1.local.postTextNonblock'

let fake: FakeEngine

const ownMessage = () =>
  makeMessageText({
    author: 'testuser',
    conversationIDKey,
    id: T.Chat.numberToMessageID(1),
    ordinal: T.Chat.numberToOrdinal(1),
  })

// the first thread's actions, which a screen kept through an account switch still holds
let firstThreadActions: ReturnType<typeof useConversationThreadActions> | undefined
// adds a message of your own to the thread when asked
const ThreadActions = (p: {ownMessage: boolean}) => {
  const actions = useConversationThreadActions()
  useEffect(() => {
    if (!firstThreadActions) firstThreadActions = actions
  }, [actions])
  const {addMessages} = actions
  const {ownMessage: own} = p
  useEffect(() => {
    if (own) {
      addMessages([ownMessage()])
    }
  }, [addMessages, own])
  return null
}

const renderBanner = async (opts?: {ownMessage?: boolean}) => {
  render(
    <>
      <ThreadActions ownMessage={!!opts?.ownMessage} />
      <BlockButtons />
    </>,
    {wrapper: threadWrapper(conversationIDKey).wrapper}
  )
  // the block-buttons state the banner loads from gregor
  await flush()
}

const clickDismiss = async () => {
  const onClick = mockIconOnClick.get('iconfont-remove')
  expect(onClick).toBeTruthy()
  act(() => {
    onClick?.()
  })
  await flush()
}

const switchAccount = () => {
  act(() => {
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id2',
      deviceName: 'testuser-mac',
      uid: 'uid2',
      username: 'testuser2',
    })
  })
}

beforeEach(() => {
  mockIconOnClick.clear()
  mockFirstOnWave = undefined
  firstThreadActions = undefined
  fake = installFakeEngine()
  // gregor holds the banner for this team: testuser-mac added you
  fake.answer('keybase.1.gregor.getState', () => ({
    items: [
      {
        item: {
          body: new TextEncoder().encode(JSON.stringify({adder: 'testuser-mac'})),
          category: `blockButtons.${teamID}`,
        },
      },
    ],
  }))
  fake.answer(dismissBlockButtons, () => {})
  fake.answer(postText, () => {})
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  metasReceived(
    [
      {
        ...Meta.makeConversationMeta(),
        conversationIDKey,
        teamID,
        teamType: 'small',
        teamname: 'testteam',
        tlfname: 'testteam',
      },
    ],
    undefined,
    {force: true}
  )
})

const clickWave = async () => {
  act(() => {
    fireEvent.click(screen.getByText('Wave at everyone'))
  })
  await flush()
}

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('dismissing asks the service to dismiss the banner', async () => {
  await renderBanner()
  await clickDismiss()
  expect(paramsOf(fake, dismissBlockButtons)).toEqual([{tlfID: teamID}])
})

test('a message of your own in the thread dismisses the banner', async () => {
  await renderBanner({ownMessage: true})
  expect(paramsOf(fake, dismissBlockButtons)).toEqual([{tlfID: teamID}])
})

test('waving posts a plain wave into the conversation', async () => {
  await renderBanner()
  await clickWave()
  expect(paramsOf(fake, postText)).toEqual([
    expect.objectContaining({
      body: ':wave:',
      clientPrev: 0,
      conversationID: T.Chat.keyToConversationID(conversationIDKey),
      tlfName: 'testteam',
    }),
  ])
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
describe('a banner whose thread has retired', () => {
  test('dismisses nothing when clicked', async () => {
    await renderBanner()
    const onClick = mockIconOnClick.get('iconfont-remove')
    switchAccount()
    act(() => {
      onClick?.()
    })
    await flush()
    expect(onClick).toBeTruthy()
    expect(paramsOf(fake, dismissBlockButtons)).toEqual([])
  })

  test('waves nothing', async () => {
    await renderBanner()
    expect(mockFirstOnWave).toBeDefined()
    switchAccount()
    act(() => {
      mockFirstOnWave?.()
    })
    await flush()
    expect(paramsOf(fake, postText)).toEqual([])
  })

  // a retired store drops what it is handed, so nothing of yours ever shows in its thread
  test('dismisses nothing for a message of your own handed to it', async () => {
    await renderBanner()
    switchAccount()
    act(() => {
      firstThreadActions?.addMessages([ownMessage()])
    })
    await flush()
    expect(firstThreadActions).toBeDefined()
    expect(paramsOf(fake, dismissBlockButtons)).toEqual([])
  })
})
