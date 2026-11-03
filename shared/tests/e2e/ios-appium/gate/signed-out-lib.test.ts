import {recoveryPicks, recoveryRowPredicate} from './signed-out-lib'

const peerNames = ['e2e-second-svc', 'e2e-second-svc-2', 'e2e-second-svc-3']
const dev = (name: string, type: string) => ({deviceNumberOfType: 0, id: `id-${name}`, name, type})

describe('recoveryPicks', () => {
  test("picks the peer's live device and the first paper key by name", () => {
    const devices = [
      dev('phone', 'mobile'),
      dev('zebra yak', 'backup'),
      dev('e2e-second-svc', 'desktop'),
      dev('e2e-second-svc-2', 'desktop'),
      dev('apple bat', 'backup'),
    ]
    expect(recoveryPicks(devices, peerNames)).toEqual({
      paperKey: dev('apple bat', 'backup'),
      peer: dev('e2e-second-svc-2', 'desktop'),
    })
  })

  test('says what is missing', () => {
    expect(recoveryPicks(undefined, peerNames)).toBe('the device selector has no device list in its params')
    expect(recoveryPicks([{name: 'x'}], peerNames)).toBe('the device selector has no device list in its params')
    expect(recoveryPicks([dev('phone', 'mobile')], peerNames)).toBe(
      "the recovery lists none of the peer's device names (e2e-second-svc...); it lists phone"
    )
    expect(recoveryPicks([dev('phone', 'mobile'), dev('apple banana', 'backup'), dev('cherry date', 'backup')], peerNames)).toBe(
      "the recovery lists none of the peer's device names (e2e-second-svc...); it lists phone, 2 paper keys"
    )
    expect(recoveryPicks([], peerNames)).toBe("the recovery lists none of the peer's device names (e2e-second-svc...); it lists no device")
    expect(recoveryPicks([dev('e2e-second-svc', 'desktop')], peerNames)).toBe(
      'the recovery lists no paper key, so no wrong paper key can be refused'
    )
  })
})

describe('recoveryRowPredicate', () => {
  test('matches the exact name, alone or leading a merged label, quoted', () => {
    expect(recoveryRowPredicate('a "b"')).toBe(
      '-ios predicate string:label == "a \\"b\\"" OR label BEGINSWITH "a \\"b\\", " OR label BEGINSWITH "a \\"b\\" , "'
    )
  })
})
