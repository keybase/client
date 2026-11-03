/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'

// SearchFilter debounces through its own input chrome and List virtualizes; render both as plain
// elements so the picker's own debounce, search and select logic is what runs
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<object>('@/common-adapters')
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    Input3: (p: {onChangeText: (t: string) => void; value: string}) =>
      R.createElement('input', {
        'data-testid': 'caption',
        onChange: (e: {target: {value: string}}) => p.onChangeText(e.target.value),
        value: p.value,
      }),
    List: (p: {items: ReadonlyArray<unknown>; renderItem: (i: number, item: unknown) => React.ReactNode}) =>
      R.createElement('div', {'data-testid': 'results'}, ...p.items.map((item, i) => R.createElement(R.Fragment, {key: i}, p.renderItem(i, item)))),
    SearchFilter: (p: {onChange: (t: string) => void; waiting?: boolean}) =>
      R.createElement('input', {
        'data-testid': 'search',
        'data-waiting': String(!!p.waiting),
        onChange: (e: {target: {value: string}}) => p.onChange(e.target.value),
      }),
  }
})
jest.mock('@/chat/avatars', () => ({
  Avatars: () => null,
  TeamAvatar: () => null,
}))

import {act, cleanup, fireEvent, render, waitFor} from '@testing-library/react'
import * as C from '@/constants'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {answerThreadLoads, holdHandlerTimers, paramsOf, threadLoaded} from '@/test/fake-thread-load'
import {flush, settle} from '@/test/flush'
import {navigationWrapper, stateShowing, type InstalledNavigation} from '@/test/navigation'
import TeamPicker, {showForwardMessagePicker} from './fwd-msg'

const search = 'chat.1.local.forwardMessageConvSearch'
const forward = 'chat.1.local.forwardMessageNonblock'

let fake: FakeEngine

const srcKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const dstConvID = new Uint8Array([9, 8, 7, 6])
const msgID = T.Chat.numberToMessageID(42)

const textMessage = {id: msgID, type: 'text'} as unknown as T.Chat.Message
const attachmentMessage = {
  attachmentType: 'file',
  fileName: 'a.txt',
  id: msgID,
  type: 'attachment',
} as unknown as T.Chat.Message

const hit = (name: string, convID: Uint8Array = dstConvID): T.RPCChat.ConvSearchHit => ({
  convID,
  isTeam: false,
  name,
  parts: ['testuser', 'testuser-mac'],
})

// what the picker asks the service for
const expectSearchSent = (term: string) => {
  expect(paramsOf(fake, search).at(-1)).toEqual({term})
}
const expectForwardSent = (title: string) => {
  expect(paramsOf(fake, forward)).toEqual([
    {
      dstConvID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      msgID,
      srcConvID: T.Chat.keyToConversationID(srcKey),
      title,
    },
  ])
}

const dstKey = T.Chat.conversationIDToKey(dstConvID)

let nav: Omit<InstalledNavigation, 'setRootState' | 'unmount'>
// The chat, from which the message's menu opens the picker as the modal it is. The menu hands the
// picker the message it showed; without one (`message` null) the route is opened bare, as a
// restored route would be, and the picker has only what its own load finds.
const renderPicker = async (message: T.Chat.Message | null = textMessage) => {
  const {wrapper, ...recorder} = navigationWrapper({
    rootState: stateShowing('chatRoot'),
    route: 'chatForwardMsgPick',
  })
  nav = recorder
  const rendered = render(<TeamPicker conversationIDKey={srcKey} messageID={msgID} />, {wrapper})
  act(() => {
    if (message) {
      showForwardMessagePicker(srcKey, message)
    } else {
      C.Router2.navigateAppend({name: 'chatForwardMsgPick', params: {conversationIDKey: srcKey, messageID: msgID}})
    }
  })
  // the search and the load around the message, across to the service and back
  await flush()
  await act(settle)
  await flush()
  return rendered
}

// the picker is still up, and nothing navigated away from it
const expectStillPicking = () => {
  expect(nav.visibleScreen()?.name).toBe('chatForwardMsgPick')
}
// the modal is gone and the chat shows the destination
const expectShowingDestination = () => {
  expect(nav.getRootState()?.routes).toHaveLength(1)
  expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey: dstKey}})
}
// the modal is gone and the chat shows no conversation
const expectClosedWithoutForwarding = () => {
  expect(nav.getRootState()?.routes).toHaveLength(1)
  expect(nav.visibleScreen()?.name).toBe('chatRoot')
  expect((nav.visibleScreen()?.params as {conversationIDKey?: string} | undefined)?.conversationIDKey).toBeUndefined()
}

beforeEach(() => {
  fake = installFakeEngine()
  // the load around the message finds nothing newer than what the menu handed over
  answerThreadLoads(fake)
  fake.answer(forward, () => {})
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('search', () => {
  test('searches with the empty term on mount and lists the hits', async () => {
    fake.answer(search, () => [hit('testteam#general')])
    const {getByTestId} = await renderPicker()
    expectSearchSent('')
    expect(getByTestId('results').textContent).toBe('testteam#general')
    expect(getByTestId('search').getAttribute('data-waiting')).toBe('false')
  })

  test('typing searches again with the debounced term', async () => {
    const held = fake.hold(search)
    const {getByTestId} = await renderPicker()
    held[0]!.reply([hit('hit-')])
    await flush()

    fireEvent.change(getByTestId('search'), {target: {value: 'test'}})
    await flush()
    expect(paramsOf(fake, search)).toHaveLength(1)
    // the 200ms debounce
    await waitFor(() => expect(paramsOf(fake, search)).toHaveLength(2))
    expectSearchSent('test')
    expect(getByTestId('search').getAttribute('data-waiting')).toBe('true')

    held[1]!.reply([hit('hit-test')])
    await flush()
    expect(getByTestId('results').textContent).toBe('hit-test')
  })

  test('a result for a superseded term is dropped', async () => {
    const held = fake.hold(search)
    const {getByTestId} = await renderPicker()
    fireEvent.change(getByTestId('search'), {target: {value: 'new'}})
    await waitFor(() => expect(paramsOf(fake, search)).toHaveLength(2))

    held[0]!.reply([hit('stale')])
    await flush()
    expect(getByTestId('results').textContent).toBe('')
    expect(getByTestId('search').getAttribute('data-waiting')).toBe('true')

    held[1]!.reply([hit('fresh')])
    await flush()
    expect(getByTestId('results').textContent).toBe('fresh')
  })

  test('a failed search shows a generic error and logs via logger.info', async () => {
    fake.answer(search, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'search broke'))
    const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
    const {container, queryByTestId} = await renderPicker()

    expect(container.textContent).toContain('Something went wrong, please try again.')
    expect(queryByTestId('results')).toBeNull()
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0]?.[0]).toMatch(/^TeamPicker: error loading search results: .*search broke/)
  })

  test('an empty result lists no hits', async () => {
    fake.answer(search, () => null)
    const {getByTestId} = await renderPicker()
    expect(getByTestId('results').textContent).toBe('')
  })
})

describe('forward', () => {
  test('selecting a hit for a text message forwards immediately with an empty title', async () => {
    fake.answer(search, () => [hit('testuser-mac')])
    // passes through: only records when the preview started, relative to the forward
    const previewConversation = jest.spyOn(C.Router2, 'previewConversation')
    const previewCalledAtForward: Array<boolean> = []
    fake.answer(forward, () => {
      previewCalledAtForward.push(previewConversation.mock.calls.length === 1)
    })
    const {getByText} = await renderPicker()

    fireEvent.click(getByText('testuser-mac'))
    await flush()

    expectForwardSent('')
    expectShowingDestination()
    // preview is started before the forward goes out, and modals clear without waiting on it
    expect(previewCalledAtForward).toEqual([true])
  })

  test('an attachment asks for a caption first and sends it as the title', async () => {
    fake.answer(search, () => [hit('testuser-mac')])
    const {getByTestId, getByText} = await renderPicker(attachmentMessage)

    fireEvent.click(getByText('testuser-mac'))
    await flush()
    expect(paramsOf(fake, forward)).toEqual([])
    expectStillPicking()

    fireEvent.change(getByTestId('caption'), {target: {value: 'a caption'}})
    fireEvent.click(getByText('Send'))
    await flush()

    expectForwardSent('a caption')
    expectShowingDestination()
  })

  test('cancel on the caption step clears modals without forwarding', async () => {
    fake.answer(search, () => [hit('testuser-mac')])
    const {getByText} = await renderPicker(attachmentMessage)

    fireEvent.click(getByText('testuser-mac'))
    fireEvent.click(getByText('Cancel'))
    await flush()

    expectClosedWithoutForwarding()
    expect(paramsOf(fake, forward)).toEqual([])
  })

  test('a failed forward is only logged via logger.info; navigation already happened', async () => {
    fake.answer(search, () => [hit('testuser-mac')])
    fake.answer(forward, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'forward broke'))
    const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {getByText} = await renderPicker()

    fireEvent.click(getByText('testuser-mac'))
    await flush()

    expectForwardSent('')
    expectShowingDestination()
    expect(info).toHaveBeenCalledTimes(1)
    expect(info.mock.calls[0]?.[0]).toMatch(/^TeamPicker: error forwarding message: .*forward broke/)
    expect(error).not.toHaveBeenCalled()
  })

  test('with no message handed over or loaded, selecting shows the error and sends nothing', async () => {
    fake.answer(search, () => [hit('testuser-mac')])
    const {container, getByText} = await renderPicker(null)

    fireEvent.click(getByText('testuser-mac'))

    expect(container.textContent).toContain('Something went wrong, please try again.')
    expect(paramsOf(fake, forward)).toEqual([])
    await flush()
    expectStillPicking()
  })

  describe('opened with no message handed over', () => {
    const validText = {
      state: T.RPCChat.MessageUnboxedState.valid,
      valid: {
        bodySummary: 'hi',
        ctime: 200,
        messageBody: {messageType: T.RPCChat.MessageType.text, text: {body: 'hi'}},
        messageID: msgID,
        outboxID: '',
        reactions: {},
        senderDeviceID: new Uint8Array([1]),
        senderDeviceName: 'testuser-mac',
        senderDeviceType: 'desktop',
        senderUID: new Uint8Array([2]),
        senderUsername: 'testuser',
      },
    }
    // the load around the message streams it as the full pass; `answerRightAway` answers as soon as
    // the GUI acked that pass, before its handler has run, as the IPC hop usually orders it
    const loadFinds = (answerRightAway: boolean) =>
      answerThreadLoads(fake, async load => {
        const timers = answerRightAway ? holdHandlerTimers() : undefined
        await load.full(JSON.stringify({messages: [validText]}))
        if (!timers) {
          await settle()
        }
        return timers?.replyFirst(threadLoaded)
      })

    test('forwards the message its own load found', async () => {
      fake.answer(search, () => [hit('testuser-mac')])
      loadFinds(false)
      const {getByText} = await renderPicker(null)

      fireEvent.click(getByText('testuser-mac'))
      await flush()

      expectForwardSent('')
    })

    // useConversationMessage's load reads what its stream callbacks collected right after awaiting
    // the load, so the load must not resolve before the full pass's handler has run
    test('forwards the message its own load found when the service answers right after the ack', async () => {
      fake.answer(search, () => [hit('testuser-mac')])
      loadFinds(true)
      const {getByText} = await renderPicker(null)

      fireEvent.click(getByText('testuser-mac'))
      await flush()

      expectForwardSent('')
    })
  })
})
