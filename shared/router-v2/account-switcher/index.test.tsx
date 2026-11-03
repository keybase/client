/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {setImmediate} from 'node:timers'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import AccountSwitcher from '.'

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine()
  useCurrentUserState
    .getState()
    .dispatch.setBootstrap({deviceID: 'd', deviceName: 'dn', uid: 'testuser', username: 'testuser'})
  useConfigState.getState().dispatch.setAccounts([
    {fullname: '', hasStoredSecret: true, uid: 'testuser-mac', username: 'testuser-mac'},
  ])
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  act(() => {
    resetAllStores()
  })
})

const login = 'keybase.1.login.login'
// The service holds the login open, as it does while it works
const holdLogin = () => fake.hold(login)
const settle = async () =>
  act(async () => {
    await new Promise<void>(resolve => setImmediate(resolve))
    await new Promise<void>(resolve => setImmediate(resolve))
  })

test('an account row starts a switch when no switch is running', async () => {
  const held = holdLogin()
  render(<AccountSwitcher />)

  fireEvent.click(screen.getByText('testuser-mac'))
  await settle()

  expect(held.map(c => (c.params as {username: string}).username)).toEqual(['testuser-mac'])
})

test('account rows are disabled while a switch is running, even after the reset clears the login waiting key', async () => {
  const held = holdLogin()
  act(() => {
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-other')
  })
  const {container} = render(<AccountSwitcher />)
  const html = () => (container as unknown as {innerHTML: string}).innerHTML
  const before = html()

  fireEvent.click(screen.getByText('testuser-mac'))
  await settle()

  // the row takes no click: no spinner on it, and nothing reaches the service
  expect(html()).toBe(before)
  expect(held).toEqual([])
  expect(fake.calls).toEqual([])
})
