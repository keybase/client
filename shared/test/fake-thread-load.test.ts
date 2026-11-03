/// <reference types="jest" />
import * as T from '@/constants/types'
import {getChatRpc} from '@/chat/conversation/chat-rpc'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from './fake-engine'
import {answerThreadLoads, getThreadNonblock, holdHandlerTimers, paramsOf, threadLoaded} from './fake-thread-load'
import {settle} from './flush'
import {testWaitingKey} from './waiting-key'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let fake: FakeEngine

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  fake = installFakeEngine()
})

afterEach(() => {
  resetAllStores()
})

const load = async (events: Array<string>, waitingKey?: T.Waiting.WaitingKeys) => {
  const res = await getChatRpc().loadThread({
    conversationIDKey,
    onCachedThread: thread => events.push(`cached ${thread}`),
    onFullThread: thread => events.push(`full ${thread}`),
    onThreadStatus: status => events.push(`status ${status.typ}`),
    waitingKey,
  })
  events.push(`resolved ${JSON.stringify(res)}`)
}

test('the load asks the service for the conversation, and its streams reach the callbacks', async () => {
  answerThreadLoads(fake, async l => {
    expect(l.conversationIDKey).toBe(conversationIDKey)
    await l.status({typ: T.RPCChat.UIChatThreadStatusTyp.server})
    await l.cached('c')
    await l.full('f')
  })
  const events: Array<string> = []
  await load(events)
  await settle()
  expect(events).toContain('status 1')
  expect(events.filter(e => !e.startsWith('resolved'))).toEqual(['status 1', 'cached c', 'full f'])
  expect(paramsOf(fake, getThreadNonblock)).toHaveLength(1)
})

// The session acks a plain call at once and the listener runs the handler on a 0ms timer, so the
// reply, sent once the ack reached the service, can arrive before that timer; the load still
// resolves only after the pass has reached its callback.
test('a reply that arrives before the full pass reaches its callback resolves the load after it', async () => {
  answerThreadLoads(fake, async l => {
    const timers = holdHandlerTimers()
    await l.full('f')
    return timers.replyFirst(threadLoaded)
  })
  const events: Array<string> = []
  await load(events)
  expect(events).toEqual(['full f', 'resolved {"offline":false}'])
})

test('a service that replies once the handler ran resolves the load after the full pass', async () => {
  answerThreadLoads(fake, async l => {
    await l.full('f')
    // set after the listener's own 0ms timer, so it fires after it
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  const events: Array<string> = []
  await load(events)
  expect(events).toEqual(['full f', 'resolved {"offline":false}'])
})

test('the waiting key is up while the load is in flight', async () => {
  const held = fake.hold(getThreadNonblock)
  const key = testWaitingKey('test:thread')
  const done = load([], key)
  expect(useWaitingState.getState().counts.get(key)).toBe(1)
  await settle()
  held[0]!.reply({offline: true})
  await done
  expect(useWaitingState.getState().counts.get(key)).toBeUndefined()
})

test('a service error rejects the load', async () => {
  answerThreadLoads(fake, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'boom'))
  await expect(load([])).rejects.toMatchObject({code: T.RPCGen.StatusCode.scgeneric})
})

test('no request while the chat session is not ready', async () => {
  useConfigState.setState({loggedIn: false})
  await expect(getChatRpc().loadThread({conversationIDKey})).resolves.toBeUndefined()
  expect(fake.calls).toEqual([])
})

test('a held timer cleared after the release, before it runs, does not run', async () => {
  const timers = holdHandlerTimers()
  const ran = jest.fn()
  const handle = setTimeout(ran, 0)
  timers.release()
  clearTimeout(handle)
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setTimeout(resolve, 5))
  expect(ran).not.toHaveBeenCalled()
})
