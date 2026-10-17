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

  holdLoggedOutLink('keybase://incoming-share/0000ab')

  expect(pendingURL()).toBe('keybase://incoming-share')
})

test('a link other than a share that arrives while logged out is dropped', () => {
  holdLoggedOutLink('keybase://profile/show/testuser')
  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutLink()
  expect(pendingURL()).toBeUndefined()
})

test('a link other than a share leaves a held share alone', () => {
  holdLoggedOutLink('keybase://incoming-share/0000ab')
  holdLoggedOutLink('keybase://chat/testuser,testuser-mac')
  holdLoggedOutLink(undefined)
  useConfigState.getState().dispatch.setLoggedIn(true)
  releaseLoggedOutLink()
  expect(pendingURL()).toBe('keybase://incoming-share')
})

test('a link while logged in is followed as before', () => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  holdLoggedOutLink('keybase://chat/testuser,testuser-mac')
  expect(pendingURL()).toBe('keybase://chat/testuser,testuser-mac')
})
