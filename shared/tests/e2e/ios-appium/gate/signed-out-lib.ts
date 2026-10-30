// Pure part of the signed-out flows (flows/account-signed-out.test.ts), kept apart so jest can test it
// without wdio.

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
  if (!peer) return `the recovery lists none of the peer's device names (${peerNames[0]}...); it lists ${devices.map(d => d.name).join(', ') || 'no device'}`
  const paperKey = devices.filter(d => d.type === 'backup').sort((a, b) => a.name.localeCompare(b.name))[0]
  if (!paperKey) return 'the recovery lists no paper key, so no wrong paper key can be refused'
  return {paperKey, peer}
}

const escapePredicate = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

// The device selector's row for the device named exactly `name`: its name text, or the row itself
// when the row merges its texts into one label ("<name>, <kind>"), so "a b" never matches "a bc".
export const recoveryRowPredicate = (name: string) => {
  const n = escapePredicate(name)
  return `-ios predicate string:label == "${n}" OR label BEGINSWITH "${n}, " OR label BEGINSWITH "${n} , "`
}
