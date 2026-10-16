/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {holdLoggedOutLink, loggedOutShareToHold, releaseLoggedOutLink} from './logged-out-share'

const pendingURL = () => useNavigationIntentsState.getState().intent?.url

beforeEach(() => {
  useConfigState.getState().dispatch.setLoggedIn(false)
})

afterEach(() => {
  releaseLoggedOutLink()
  resetAllStores()
})

describe('loggedOutShareToHold', () => {
  test('holds a share, without the conversation it was aimed at', () => {
    expect(loggedOutShareToHold('keybase://incoming-share')).toBe('keybase://incoming-share')
    expect(loggedOutShareToHold('keybase://incoming-share/0000ab')).toBe('keybase://incoming-share')
  })

  test('holds nothing else', () => {
    expect(loggedOutShareToHold('keybase://convid/0000ab')).toBeUndefined()
    expect(loggedOutShareToHold('keybase://incoming-shares')).toBeUndefined()
    expect(loggedOutShareToHold('https://keybase.io/testuser')).toBeUndefined()
    expect(loggedOutShareToHold('mailto:testuser@example.com')).toBeUndefined()
  })
})

test('a share made while logged out opens once someone logs in, and only once', () => {
  holdLoggedOutLink('keybase://incoming-share/0000ab')
  expect(pendingURL()).toBeUndefined()

  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutLink()

  expect(pendingURL()).toBe('keybase://incoming-share')
  const {intent, dispatch} = useNavigationIntentsState.getState()
  dispatch.acknowledge(intent!.id)

  releaseLoggedOutLink()
  expect(pendingURL()).toBeUndefined()
})

test('a share read after login has already happened goes straight to the router', () => {
  useConfigState.getState().dispatch.setLoggedIn(true)

  holdLoggedOutLink('keybase://incoming-share')

  expect(pendingURL()).toBe('keybase://incoming-share')
})

test('the latest link while logged out wins, a share or not', () => {
  holdLoggedOutLink('keybase://profile/show/testuser')
  holdLoggedOutLink('keybase://convid/0000ab')
  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutLink()
  expect(pendingURL()).toBe('keybase://convid/0000ab')
})

test('a share made after a launch link replaces it', () => {
  holdLoggedOutLink('keybase://profile/show/testuser')
  holdLoggedOutLink('keybase://incoming-share/0000ab')
  holdLoggedOutLink(undefined)
  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutLink()
  expect(pendingURL()).toBe('keybase://incoming-share')
})

test('the link that launched the app while logged out, of any kind, opens once someone logs in', () => {
  holdLoggedOutLink('keybase://profile/show/testuser')
  expect(pendingURL()).toBeUndefined()

  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutLink()
  expect(pendingURL()).toBe('keybase://profile/show/testuser')
  const {intent, dispatch} = useNavigationIntentsState.getState()
  dispatch.acknowledge(intent!.id)

  releaseLoggedOutLink()
  expect(pendingURL()).toBeUndefined()
})

test('a share that launched the app is held without its conversation', () => {
  holdLoggedOutLink('keybase://incoming-share/0000ab')
  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutLink()
  expect(pendingURL()).toBe('keybase://incoming-share')
})

test('a link that is not keybase or a keybase web link is not held', () => {
  holdLoggedOutLink('mailto:testuser@example.com')
  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutLink()
  expect(pendingURL()).toBeUndefined()
})
