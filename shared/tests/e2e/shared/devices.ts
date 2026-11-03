// The smoke account's devices as the main service reports them, the name a provisioning flow gives
// the device it makes, the check before a flow revokes one, and the retirement of what a phone
// provisioning flow made. Free of any test framework, so the
// desktop and the iOS flows share it. Relative imports only: plain node loads this too.
import * as fs from 'fs'
import {checkFlowRevokeTarget, protectedPaperKeyIn, type ListedDevice} from '../accounts/device-targets.ts'
import {provisionHomeFor, type E2EEnv} from '../accounts/env.ts'
import {removeRetiredPeerHome, retirePeerHome, stopPeerHomeService} from '../accounts/peer-homes.ts'
import {mainRpc} from './main-rpc.ts'
import {runKeybase} from './peer-service.ts'

type DeviceDetail = {device: ListedDevice; revokedAt?: number | null}

// The device a run's provisioning flow makes: the name the sweeper revokes.
export const provDeviceName = (runId: string) => `e2e-${runId}-prov`

// Revokes `device` through the main service, once requireRevocableFromPhone allows it: the cleanup
// of a flow that failed before the app revoked what it made. A device already revoked is left.
export const revokeLeftoverFromPhoneFlow = async (env: E2EEnv, device: {deviceID: string; name: string}, phoneDeviceID: string) => {
  if ((await deviceHistory()).find(d => d.deviceID === device.deviceID)?.revoked) return
  await requireRevocableFromPhone(env, device, phoneDeviceID)
  await mainRpc('keybase.1.revoke.revokeDevice', {deviceID: device.deviceID, forceLast: false, forceSelf: false, sessionID: 0})
}

// Every device the account ever had, by its own name (deviceList names a paper key
// "Paper Key (<two words>...)"; this has the two words), with whether it is revoked.
export const deviceHistory = async () =>
  ((await mainRpc<Array<DeviceDetail> | null>('keybase.1.device.deviceHistoryList', {sessionID: 0})) ?? []).map(d => ({
    deviceID: d.device.deviceID,
    name: d.device.name,
    revoked: !!d.revokedAt,
    type: d.device.type,
  }))

export const activeDevices = async () => (await deviceHistory()).filter(d => !d.revoked)

// Waits until the service lists the one device with `deviceID` as revoked: a flow's read-back of a
// revoke the app sent. `what` names the device in the error.
export const waitServiceRevoked = async (deviceID: string, what: string, timeoutMs = 30_000) => {
  const until = Date.now() + timeoutMs
  for (;;) {
    const states = (await deviceHistory()).filter(d => d.deviceID === deviceID).map(d => d.revoked)
    if (states.length === 1 && states[0]) return
    if (Date.now() > until) throw new Error(`the service did not list ${what} as revoked within ${timeoutMs / 1000}s`)
    await new Promise(resolve => setTimeout(resolve, 1_000))
  }
}

// The account's active devices as `keybase.1.device.deviceList` names them: the names the sweeper
// (and the paper key ledger it reads) compares.
export const listedDevices = async () => (await mainRpc<Array<ListedDevice> | null>('keybase.1.device.deviceList', {sessionID: 0})) ?? []

// The main service's own device: the host's.
export const mainDevice = async () => {
  const status = JSON.parse(await runKeybase(['status', '-j'], {timeoutMs: 15_000})) as {Device?: {deviceID?: string; name?: string}}
  const deviceID = status.Device?.deviceID ?? ''
  const name = status.Device?.name ?? ''
  if (!deviceID || !name) throw new Error('keybase status names no device for the main service')
  return {deviceID, name}
}

// The paper key the env file holds for the smoke account (KB_OWNER_PAPERKEY): never a revoke target.
const protectedPaperKey = async (env: E2EEnv) => protectedPaperKeyIn(await activeDevices(), env.peers.owner.paperKey)

// Throws unless the one active device named `expected.name` is `expected` and none of the devices
// nothing may revoke (checkFlowRevokeTarget): the host's, the protected paper key and, for a flow on
// the phone, the phone's own (`phoneDeviceID`). Not exported: each platform's entry below says
// which devices are its own, so a phone flow cannot leave the phone out.
const requireRevocable = async (env: E2EEnv, expected: {deviceID: string; name: string}, phoneDeviceID: string | undefined) => {
  const named = (await activeDevices()).filter(d => d.name === expected.name)
  if (named.length !== 1) throw new Error(`refusing to revoke: ${named.length} active devices carry the expected name`)
  const [target] = named
  checkFlowRevokeTarget({
    expected,
    mainDeviceID: (await mainDevice()).deviceID,
    phoneDeviceID,
    protectedPaperKey: await protectedPaperKey(env),
    target: {deviceID: target?.deviceID ?? '', name: target?.name ?? ''},
  })
}

// For a flow on the desktop app, which runs on the host's service: the host's device is the app's.
export const requireRevocableFromHost = async (env: E2EEnv, expected: {deviceID: string; name: string}) =>
  requireRevocable(env, expected, undefined)

// For a flow on the phone: its own device (read from the app) is refused too; an empty id is refused.
export const requireRevocableFromPhone = async (env: E2EEnv, expected: {deviceID: string; name: string}, phoneDeviceID: string) =>
  requireRevocable(env, expected, phoneDeviceID)

// Retires run `runId`'s provisioned device and its home (provisionHomeFor, provDeviceName), made for
// a phone flow, whatever the flow got to: the device id comes from the home's own config
// (retirePeerHome reads it after shutting the service down), so a login that succeeded before a
// later check threw is still found, and a device the server made before its home recorded it (a
// login stopped part way) is found by its stamped name. A device the app did not revoke is revoked
// here through the main service, guarded as a phone flow's revoke is; then the home goes.
export const retirePhoneFlowDevice = async (env: E2EEnv, runId: string, phoneDeviceID: string) => {
  const home = provisionHomeFor(runId)
  const name = provDeviceName(runId)
  const keep = env.peers.owner.home
  const revoke = async (deviceID: string) => {
    await revokeLeftoverFromPhoneFlow(env, {deviceID, name}, phoneDeviceID)
    if (!(await deviceHistory()).find(d => d.deviceID === deviceID)?.revoked) {
      throw new Error(`the service does not list ${name} as revoked after its cleanup`)
    }
  }
  if (fs.existsSync(home)) {
    await retirePeerHome(
      {newHome: keep, oldHome: home, role: 'owner', user: env.smokeUser},
      {
        remove: async h => removeRetiredPeerHome(h, keep, env.smokeUser, () => {}),
        revoke,
        say: () => {},
        stop: stopPeerHomeService,
      }
    )
  }
  for (const d of (await activeDevices()).filter(d => d.name === name)) await revoke(d.deviceID)
}
