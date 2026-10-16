/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {
  holdLoggedOutLaunchLink,
  holdLoggedOutShare,
  loggedOutShareToHold,
  releaseLoggedOutShare,
} from './logged-out-share'

const pendingURL = () => useNavigationIntentsState.getState().intent?.url

beforeEach(() => {
  useConfigState.getState().dispatch.setLoggedIn(false)
})

afterEach(() => {
  releaseLoggedOutShare()
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
  holdLoggedOutShare('keybase://incoming-share/0000ab')
  expect(pendingURL()).toBeUndefined()

  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutShare()

  expect(pendingURL()).toBe('keybase://incoming-share')
  const {intent, dispatch} = useNavigationIntentsState.getState()
  dispatch.acknowledge(intent!.id)

  releaseLoggedOutShare()
  expect(pendingURL()).toBeUndefined()
})

test('a share read after login has already happened goes straight to the router', () => {
  useConfigState.getState().dispatch.setLoggedIn(true)

  holdLoggedOutShare('keybase://incoming-share')

  expect(pendingURL()).toBe('keybase://incoming-share')
})

test('a link that is not a share is not held', () => {
  holdLoggedOutShare('keybase://convid/0000ab')
  holdLoggedOutShare(undefined)
  useConfigState.getState().dispatch.setLoggedIn(true)

  releaseLoggedOutShare()

  expect(pendingURL()).toBeUndefined()
})

test('the link that launched the app while logged out, of any kind, opens once someone logs in', () => {
  holdLoggedOutLaunchLink('keybase://profile/show/testuser')
  expect(pendingURL()).toBeUndefined()

  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutShare()
  expect(pendingURL()).toBe('keybase://profile/show/testuser')
  const {intent, dispatch} = useNavigationIntentsState.getState()
  dispatch.acknowledge(intent!.id)

  releaseLoggedOutShare()
  expect(pendingURL()).toBeUndefined()
})

test('a share that launched the app is held without its conversation', () => {
  holdLoggedOutLaunchLink('keybase://incoming-share/0000ab')
  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutShare()
  expect(pendingURL()).toBe('keybase://incoming-share')
})

test('a link that is not keybase or a keybase web link is not held', () => {
  holdLoggedOutLaunchLink('mailto:testuser@example.com')
  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutShare()
  expect(pendingURL()).toBeUndefined()
})
