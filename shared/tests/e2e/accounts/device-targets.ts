// Which device a flow may revoke on the smoke account: only the one it made, never the main
// service's own device and never the paper key the env file holds for the account.
// Relative imports only: plain node loads this too.

export type ListedDevice = {deviceID: string; name: string; type: string}
type DeviceRef = {deviceID: string; name: string}

// The service names a paper key device after the key's first two words.
export const paperKeyDeviceName = (paperKey: string) => {
  const words = paperKey.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) throw new Error('not a paper key: fewer than two words')
  return `${words[0]} ${words[1]}`
}

// The one device of `type` in `after` that `before` lacked; undefined while there is none.
export const newDeviceOf = (before: ReadonlyArray<ListedDevice>, after: ReadonlyArray<ListedDevice>, type: string) => {
  const had = new Set(before.map(d => d.deviceID))
  const added = after.filter(d => d.type === type && !had.has(d.deviceID))
  if (added.length > 1) throw new Error(`${added.length} new ${type} devices appeared; expected one`)
  return added[0]
}

// deviceList names a paper key device "Paper Key (<two words>...)"; deviceHistoryList and the
// service's own records name it by the two words.
const paperKeyNames = (name: string) => [name, `Paper Key (${name}...)`]

// Throws when `target` is `protectedPaperKey`: by id when that is known, and by name in either form.
// An unknown name fails the check rather than letting it pass vacuously.
export const checkNotProtectedPaperKey = (target: DeviceRef, protectedPaperKey: {deviceID?: string; name: string}) => {
  if (!protectedPaperKey.name) throw new Error('refusing to revoke: the protected paper key is unknown')
  if ((protectedPaperKey.deviceID && target.deviceID === protectedPaperKey.deviceID) || paperKeyNames(protectedPaperKey.name).includes(target.name)) {
    throw new Error("refusing to revoke: it is the account's protected paper key (the env file's)")
  }
}

// The protected paper key as `listed` shows it: its id when exactly one listed paper key carries its
// name.
export const protectedPaperKeyIn = (listed: ReadonlyArray<ListedDevice>, paperKey: string) => {
  const name = paperKeyDeviceName(paperKey)
  const named = listed.filter(d => d.type === 'backup' && paperKeyNames(name).includes(d.name))
  return {deviceID: named.length === 1 ? named[0]?.deviceID : undefined, name}
}

// Throws unless `target` is exactly `expected` (by id and name), is not the main service's device and
// is not `protectedPaperKey` (by id when it is listed, and by name). An empty id fails the check
// rather than letting a comparison pass vacuously.
export const checkFlowRevokeTarget = (p: {
  expected: DeviceRef
  mainDeviceID: string
  protectedPaperKey: {deviceID?: string; name: string}
  target: DeviceRef
}) => {
  const {expected, mainDeviceID, protectedPaperKey, target} = p
  if (!target.deviceID || !expected.deviceID || !mainDeviceID || !protectedPaperKey.name) {
    throw new Error('refusing to revoke: the target, expected or main device id, or the protected paper key, is unknown')
  }
  if (target.deviceID === mainDeviceID) throw new Error("refusing to revoke: it is the main service's own device")
  checkNotProtectedPaperKey(target, protectedPaperKey)
  if (target.deviceID !== expected.deviceID || target.name !== expected.name) {
    throw new Error(`refusing to revoke ${target.deviceID}: not the expected device this run made`)
  }
}
