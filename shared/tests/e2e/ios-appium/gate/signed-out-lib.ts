// Pure part of the signed-out flows (flows/account-signed-out.test.ts), kept apart so jest can test it
// without wdio.

import {escapePredicate} from '../helpers/elements.ts'

export type RecoveryDevice = {id: string; name: string; type: string}

const isDevice = (d: unknown): d is RecoveryDevice => {
  const r = d as Partial<RecoveryDevice> | null
  return typeof r === 'object' && r !== null && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.type === 'string'
}

// From the devices a password recovery offers (the device selector's own params): the peer's device,
// picked by the names a peer provisions as (`peerNames`, in the order a reprovisioned peer takes
// them, so the last one listed is the live one), and a paper key, which a wrong key is refused
// against whichever it is (the first by name, so a rerun picks the same one). A string says what is
// missing.
export const recoveryPicks = (
  devices: unknown,
  peerNames: ReadonlyArray<string>
): {paperKey: RecoveryDevice; peer: RecoveryDevice} | string => {
  if (!Array.isArray(devices) || !devices.every(isDevice)) return 'the device selector has no device list in its params'
  const peer = peerNames
    .map(n => devices.find(d => d.name === n))
    .filter(d => d !== undefined)
    .at(-1)
  if (!peer) {
    // a paper key's name is the first two words of its phrase, so paper keys are only counted
    const keys = devices.filter(d => d.type === 'backup').length
    const listed = [...devices.filter(d => d.type !== 'backup').map(d => d.name), ...(keys ? [`${keys} paper key${keys > 1 ? 's' : ''}`] : [])]
    return `the recovery lists none of the peer's device names (${peerNames[0]}...); it lists ${listed.join(', ') || 'no device'}`
  }
  const paperKey = devices.filter(d => d.type === 'backup').sort((a, b) => a.name.localeCompare(b.name))[0]
  if (!paperKey) return 'the recovery lists no paper key, so no wrong paper key can be refused'
  return {paperKey, peer}
}

// The device selector's row for the device named exactly `name`: its name text, or the row itself
// when the row merges its texts into one label, so "a b" never matches "a bc". A merged label joins
// the texts with ", " (the accessibility default) or, for a Kb.ListItem row, " , " (as the Devices
// screen's rows read, devices-lib.ts); which one this row uses is unproven, so both are matched.
export const recoveryRowPredicate = (name: string) => {
  const n = escapePredicate(name)
  return `-ios predicate string:label == "${n}" OR label BEGINSWITH "${n}, " OR label BEGINSWITH "${n} , "`
}
