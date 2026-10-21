/// <reference types="jest" />
import type {DesktopNotification} from './electron'
import {
  clearDesktopNotificationGroup,
  conversationNotificationGroup,
  onDesktopNotificationEvent,
  showDesktopNotification,
} from './desktop-notifications'

const functions = (globalThis._fromPreload as {functions: Record<string, unknown>}).functions
const shown: Array<DesktopNotification> = []
const cleared: Array<string> = []

beforeEach(() => {
  shown.length = 0
  cleared.length = 0
  functions['showNotification'] = (n: DesktopNotification) => shown.push(n)
  functions['clearNotificationGroup'] = (g: string) => cleared.push(g)
})

afterEach(() => {
  delete functions['showNotification']
  delete functions['clearNotificationGroup']
})

const lastID = () => shown.at(-1)?.id ?? ''

test('asks the main process for the notification, silent unless it has sound', () => {
  showDesktopNotification({body: 'hi', title: 'testuser'})
  showDesktopNotification({
    groupId: 'chat:a',
    groupTitle: 'team',
    onReply: () => {},
    sound: true,
    title: 'team',
  })
  expect(shown).toEqual([
    {body: 'hi', hasReply: false, id: expect.any(String), silent: true, title: 'testuser'},
    {body: '', groupId: 'chat:a', groupTitle: 'team', hasReply: true, id: expect.any(String), silent: false, title: 'team'},
  ])
  expect(shown[0]?.id).not.toEqual(shown[1]?.id)
})

test('a click runs that notification click handler once', () => {
  const onClick = jest.fn()
  const onClose = jest.fn()
  showDesktopNotification({onClick, onClose, title: 'a'})
  const id = lastID()
  showDesktopNotification({title: 'b'})
  onDesktopNotificationEvent({id, type: 'click'})
  onDesktopNotificationEvent({id, type: 'click'})
  onDesktopNotificationEvent({id, type: 'close'})
  expect(onClick).toHaveBeenCalledTimes(1)
  expect(onClose).not.toHaveBeenCalled()
})

test('a close runs the close handler', () => {
  const onClose = jest.fn()
  showDesktopNotification({onClose, title: 'a'})
  onDesktopNotificationEvent({id: lastID(), type: 'close'})
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('a reply passes the trimmed text and skips an empty one', () => {
  const onReply = jest.fn()
  showDesktopNotification({onReply, title: 'a'})
  onDesktopNotificationEvent({id: lastID(), reply: '  on my way \n', type: 'reply'})
  showDesktopNotification({onReply, title: 'b'})
  onDesktopNotificationEvent({id: lastID(), reply: '   ', type: 'reply'})
  expect(onReply).toHaveBeenCalledTimes(1)
  expect(onReply).toHaveBeenCalledWith('on my way')
})

test('ignores events it did not ask for', () => {
  const onClick = jest.fn()
  showDesktopNotification({onClick, title: 'a'})
  onDesktopNotificationEvent(undefined)
  onDesktopNotificationEvent({type: 'click'})
  onDesktopNotificationEvent({id: 'unknown', type: 'click'})
  onDesktopNotificationEvent({id: lastID(), type: 'unknown'})
  expect(onClick).not.toHaveBeenCalled()
})

test('clears a conversation group only after showing one, and only once', () => {
  const group = conversationNotificationGroup('conv1')
  clearDesktopNotificationGroup(group)
  expect(cleared).toEqual([])
  showDesktopNotification({groupId: group, title: 'a'})
  showDesktopNotification({groupId: group, title: 'b'})
  clearDesktopNotificationGroup(group)
  clearDesktopNotificationGroup(group)
  expect(cleared).toEqual([group])
})
