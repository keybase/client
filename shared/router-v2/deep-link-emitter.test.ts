/// <reference types="jest" />
import {emitDeepLink, setDeepLinkListener, setInitialURLOnce} from './deep-link-emitter'

afterEach(() => {
  setDeepLinkListener(undefined)
})

test('delivers a deep link emitted while navigation is temporarily unsubscribed', () => {
  setDeepLinkListener(undefined)
  emitDeepLink('keybase://convid/test-conversation')

  const listener = jest.fn()
  setDeepLinkListener(listener)

  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith('keybase://convid/test-conversation')
})

test('keeps the latest deep link emitted while navigation is unsubscribed', () => {
  setDeepLinkListener(undefined)
  emitDeepLink('keybase://convid/older-conversation')
  emitDeepLink('keybase://convid/newer-conversation')

  const listener = jest.fn()
  setDeepLinkListener(listener)

  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith('keybase://convid/newer-conversation')
})

test('delivers immediately while navigation is subscribed', () => {
  const listener = jest.fn()
  setDeepLinkListener(listener)

  emitDeepLink('keybase://convid/test-conversation')

  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith('keybase://convid/test-conversation')
})

test('deduplicates a queued deep link handled as the initial URL', () => {
  setDeepLinkListener(undefined)
  emitDeepLink('keybase://convid/test-conversation')
  setInitialURLOnce('keybase://convid/test-conversation')

  const listener = jest.fn()
  setDeepLinkListener(listener)

  expect(listener).not.toHaveBeenCalled()
})
