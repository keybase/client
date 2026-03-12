// RPC expects a string that's interpreted as [16]byte on Go side and it has to
// be unique among all ongoing ops at any given time. uuidv1 may exceed 16
// bytes, so just roll something simple that's seeded with time.
//
// MAX_SAFE_INTEGER after toString(36) is 11 characters, so this should take <=
// 12 chars
const uuidSeed = Date.now().toString(36) + '-'
let counter = 0
// We have 36^4=1,679,616 of space to work with in order to not exceed 16
// bytes.
const counterMod = 36 * 36 * 36 * 36
export const makeUUID = () => {
  counter = (counter + 1) % counterMod
  return uuidSeed + counter.toString(36)
}
