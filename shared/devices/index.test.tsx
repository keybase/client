/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as T from '@/constants/types'
import '@/test/viewport.desktop'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {_onEngineIncoming} from '@/constants/init/shared'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {resetAllStores} from '@/util/zustand'
import * as Tabs from '@/constants/tabs'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {navigationWrapper} from '@/test/navigation'
import Devices from './index'

// Each test mounts the full devices tab on the real navigation tree, which can pass 5s on a loaded
// CI runner. A timed-out test keeps running with an act() open, so every later test in the file
// then fails on overlapping act() with nothing rendered.
jest.setTimeout(30_000)

const historyList = 'keybase.1.device.deviceHistoryList'
const dismissBadges = 'keybase.1.device.dismissDeviceChangeNotifications'

// The service answers the history list with whatever `results` holds when the call arrives, and
// its notifications go through the app's own incoming handler.
const serve = (results: () => Array<T.RPCGen.DeviceDetail>) => {
  const fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
  fake.answer(historyList, () => results())
  fake.answer(dismissBadges, () => null)
  return fake
}
const historyCalls = (fake: FakeEngine) => fake.calls.filter(c => c.method === historyList).length

// the desktop devices tab's root, on the real navigation tree, once the list has loaded
let nav: ReturnType<typeof navigationWrapper>
const renderDevices = async () => {
  nav = navigationWrapper({route: 'devicesRoot', tab: Tabs.devicesTab})
  const r = render(<Devices />, {wrapper: nav.wrapper})
  await flush()
  return r
}

const makeDetail = (
  name: string,
  overrides: {currentDevice?: boolean; revokedAt?: number; type?: string} = {}
): T.RPCGen.DeviceDetail =>
  ({
    currentDevice: overrides.currentDevice ?? false,
    device: {
      cTime: 0,
      deviceID: `id-${name}`,
      deviceNumberOfType: 1,
      encryptKey: '',
      lastUsedTime: 0,
      mTime: 0,
      name,
      status: 0,
      type: overrides.type ?? 'desktop',
      verifyKey: '',
    },
    eldest: false,
    provisionedAt: null,
    provisioner: null,
    revokedAt: overrides.revokedAt ?? null,
    revokedBy: '',
    revokedByDevice: null,
  }) as T.RPCGen.DeviceDetail

const rows = () => [...document.querySelectorAll<HTMLElement>(`[data-testid="${TestIDs.DEVICES_ROW}"]`)]
// each row's device name, as the row's first line draws it
const renderedDevices = () =>
  rows().map(row => {
    const name = row.querySelector('.text_BodySemibold')?.firstChild?.textContent?.trim() ?? ''
    return row.textContent.includes('Revoked ') ? `${name} (revoked)` : name
  })
// whether tapping a device's row opens its page offering a revoke
const canRevoke = (name: string) => {
  const row = rows().find(r => r.querySelector('.text_BodySemibold')?.firstChild?.textContent?.trim() === name)
  if (!row) throw new Error(`no row for ${name}`)
  nav.clearActions()
  fireEvent.click(row)
  return (nav.pushes().at(-1)?.params as {canRevoke?: boolean} | undefined)?.canRevoke
}

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('the list starts empty and fills once the service answers the load the screen makes on mount', async () => {
  const fake = installFakeEngine()
  const held = fake.hold(historyList)
  fake.answer(dismissBadges, () => null)
  render(<Devices />, {wrapper: navigationWrapper({route: 'devicesRoot', tab: Tabs.devicesTab}).wrapper})
  await flush()
  expect(held).toHaveLength(1)
  expect(renderedDevices()).toEqual([])
  held[0]!.reply([makeDetail('testuser-mac', {currentDevice: true})])
  await flush()
  expect(renderedDevices()).toEqual(['testuser-mac'])
})

test('active devices list the current device first, then alphabetically', async () => {
  serve(() => [
    makeDetail('testuser-zeta'),
    makeDetail('testuser-alpha'),
    makeDetail('testuser-mac', {currentDevice: true}),
  ])

  await renderDevices()

  expect(renderedDevices()).toEqual(['testuser-mac', 'testuser-alpha', 'testuser-zeta'])
})

test('revoked devices stay behind the collapsed section until it is expanded', async () => {
  serve(() => [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-old', {revokedAt: 1000})])

  await renderDevices()

  expect(renderedDevices()).toEqual(['testuser-mac'])

  fireEvent.click(screen.getByText('Revoked devices'))

  expect(renderedDevices()).toEqual(['testuser-mac', 'testuser-old (revoked)'])
  expect(screen.queryByText(/Revoked devices are no longer able/)).not.toBeNull()
})

test('revoking is only offered when more than one active device would remain', async () => {
  let results = [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-old', {revokedAt: 1})]
  serve(() => results)

  const {unmount} = await renderDevices()
  // the revoked device does not count towards the active total
  expect(canRevoke('testuser-mac')).toBe(false)
  unmount()

  results = [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-phone')]
  await renderDevices()
  expect(canRevoke('testuser-mac')).toBe(true)
})

test('the paper key nudge shows only when the user has devices but no paper key', async () => {
  let results: Array<T.RPCGen.DeviceDetail> = []
  serve(() => results)
  const {unmount} = await renderDevices()
  expect(screen.queryAllByText('Create a paper key')).toHaveLength(0)
  unmount()

  results = [makeDetail('testuser-mac', {currentDevice: true})]
  const second = await renderDevices()
  expect(screen.queryAllByText('Create a paper key').length).toBeGreaterThan(0)
  second.unmount()

  results = [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-paper', {type: 'backup'})]
  await renderDevices()
  expect(screen.queryAllByText('Create a paper key')).toHaveLength(0)
})

// The service's badge state names the new and revoked devices; the store keeps them
const badgeDevices = async (fake: FakeEngine, revokedDevices: Array<string>) => {
  await fake.push(
    'keybase.1.NotifyBadges.badgeState',
    {badgeState: {inboxVers: 0, revokedDevices}},
    {oneway: true}
  )
  await flush()
}

test('a newly badged revoked device expands the revoked section on its own', async () => {
  const fake = serve(() => [
    makeDetail('testuser-mac', {currentDevice: true}),
    makeDetail('testuser-old', {revokedAt: 1000}),
  ])

  await renderDevices()
  expect(renderedDevices()).toEqual(['testuser-mac'])

  await badgeDevices(fake, ['id-testuser-old'])

  expect(renderedDevices()).toEqual(['testuser-mac', 'testuser-old (revoked)'])
})

test('badging an active device leaves the revoked section collapsed', async () => {
  const fake = serve(() => [
    makeDetail('testuser-mac', {currentDevice: true}),
    makeDetail('testuser-old', {revokedAt: 1000}),
  ])

  await renderDevices()
  await badgeDevices(fake, ['id-testuser-mac'])

  expect(renderedDevices()).toEqual(['testuser-mac'])
})

test('a device history change from the service reloads the list, until the screen unmounts', async () => {
  let results = [makeDetail('testuser-mac', {currentDevice: true})]
  const fake = serve(() => results)
  const deviceHistoryChanged = async () => {
    await fake.push('keybase.1.NotifyDeviceHistory.deviceHistoryChanged', {}, {oneway: true})
    await flush()
  }
  const {unmount} = await renderDevices()
  expect(historyCalls(fake)).toBe(1)

  results = [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-phone')]
  await deviceHistoryChanged()
  expect(historyCalls(fake)).toBe(2)
  expect(renderedDevices()).toEqual(['testuser-mac', 'testuser-phone'])

  unmount()
  await deviceHistoryChanged()
  expect(historyCalls(fake)).toBe(2)
})

test('a user change from the service reloads the list, so a device revoked elsewhere leaves the active section', async () => {
  let results = [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-old')]
  const fake = serve(() => results)

  await renderDevices()
  expect(renderedDevices()).toEqual(['testuser-mac', 'testuser-old'])
  expect(historyCalls(fake)).toBe(1)

  // a revoke from elsewhere: the service sends userChanged, not deviceHistoryChanged
  results = [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-old', {revokedAt: 1000})]
  await fake.push('keybase.1.NotifyUsers.userChanged', {uid: 'testuser-uid'}, {oneway: true})
  await flush()

  expect(historyCalls(fake)).toBe(2)
  // gone from the active section, into the collapsed revoked one
  expect(renderedDevices()).toEqual(['testuser-mac'])
  fireEvent.click(screen.getByText('Revoked devices'))
  expect(renderedDevices()).toEqual(['testuser-mac', 'testuser-old (revoked)'])
})

test('a burst of user changes loads the list once more after the load in flight, not once per notice', async () => {
  let results = [makeDetail('testuser-mac', {currentDevice: true})]
  const fake = serve(() => results)
  await renderDevices()
  expect(historyCalls(fake)).toBe(1)

  // a service start replays every unexpired key change, each one a userChanged
  const held = fake.hold(historyList)
  for (let i = 0; i < 5; i++) {
    await fake.push('keybase.1.NotifyUsers.userChanged', {uid: 'testuser-uid'}, {oneway: true})
    await flush()
  }
  expect(historyCalls(fake)).toBe(2)

  // the in-flight load may predate the last key change, so one more runs once it lands
  results = [makeDetail('testuser-mac', {currentDevice: true}), makeDetail('testuser-phone')]
  fake.answer(historyList, () => results)
  held[0]?.reply(results)
  await flush()
  await flush()
  expect(historyCalls(fake)).toBe(3)
  expect(renderedDevices()).toEqual(['testuser-mac', 'testuser-phone'])
})
