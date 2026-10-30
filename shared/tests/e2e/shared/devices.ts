// The smoke account's devices as the main service reports them, the name a provisioning flow gives
// the device it makes, and the check before a flow revokes one. Free of any test framework, so the
// desktop and the iOS flows share it. Relative imports only: plain node loads this too.
import {checkFlowRevokeTarget, protectedPaperKeyIn, type ListedDevice} from '../accounts/device-targets.ts'
import type {E2EEnv} from '../accounts/env.ts'
import {provDeviceLabel} from '../accounts/sweep-lib.ts'
import {mainRpc} from './main-rpc.ts'
import {runKeybase} from './peer-service.ts'

type DeviceDetail = {device: ListedDevice; revokedAt?: number | null}

// The device a run's provisioning flow makes: the one name the sweeper revokes.
export const provDeviceName = (runId: string) => `e2e-${runId}-${provDeviceLabel}`

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

// How many devices the account has active and revoked (the phone's devices screen shows no counts).
export const serviceDeviceCounts = async () => {
  const all = await deviceHistory()
  const revoked = all.filter(d => d.revoked).length
  return {active: all.length - revoked, revoked}
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
// the phone, the phone's own (`phoneDeviceID`).
export const requireRevocable = async (env: E2EEnv, expected: {deviceID: string; name: string}, opts: {phoneDeviceID?: string} = {}) => {
  const named = (await activeDevices()).filter(d => d.name === expected.name)
  if (named.length !== 1) throw new Error(`refusing to revoke: ${named.length} active devices carry the expected name`)
  const [target] = named
  checkFlowRevokeTarget({
    expected,
    mainDeviceID: (await mainDevice()).deviceID,
    phoneDeviceID: opts.phoneDeviceID,
    protectedPaperKey: await protectedPaperKey(env),
    target: {deviceID: target?.deviceID ?? '', name: target?.name ?? ''},
  })
}
