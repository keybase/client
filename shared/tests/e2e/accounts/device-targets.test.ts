import {checkFlowRevokeTarget, checkNotProtectedPaperKey, newDeviceOf, paperKeyDeviceName, protectedPaperKeyIn} from './device-targets'

const id = (c: string) => c.repeat(32)

describe('paperKeyDeviceName', () => {
  test('is the first two words, as the service names a paper key device', () => {
    expect(paperKeyDeviceName('  alpha  beta gamma delta\n')).toBe('alpha beta')
  })
  test('refuses a key of fewer than two words', () => {
    expect(() => paperKeyDeviceName('alpha')).toThrow(/not a paper key/)
    expect(() => paperKeyDeviceName('')).toThrow(/not a paper key/)
  })
})

describe('newDeviceOf', () => {
  const before = [{deviceID: id('a'), name: 'one', type: 'desktop'}]
  test('is the one device of the type the listing gained', () => {
    const after = [...before, {deviceID: id('b'), name: 'two', type: 'backup'}, {deviceID: id('c'), name: 'three', type: 'desktop'}]
    expect(newDeviceOf(before, after, 'backup')).toEqual({deviceID: id('b'), name: 'two', type: 'backup'})
  })
  test('is undefined while none is new, and throws on more than one', () => {
    expect(newDeviceOf(before, before, 'backup')).toBeUndefined()
    const two = [...before, {deviceID: id('b'), name: 'b', type: 'backup'}, {deviceID: id('c'), name: 'c', type: 'backup'}]
    expect(() => newDeviceOf(before, two, 'backup')).toThrow(/2 new backup devices/)
  })
})

describe('checkFlowRevokeTarget', () => {
  const base = {
    expected: {deviceID: id('t'), name: 'e2e-0abcd1-prov'},
    mainDeviceID: id('m'),
    protectedPaperKey: {deviceID: id('p'), name: 'alpha beta'},
    target: {deviceID: id('t'), name: 'e2e-0abcd1-prov'},
  }
  test('passes the expected device', () => {
    expect(() => checkFlowRevokeTarget(base)).not.toThrow()
  })
  test("refuses main's own device", () => {
    const target = {deviceID: id('m'), name: 'e2e-0abcd1-prov'}
    expect(() => checkFlowRevokeTarget({...base, expected: target, target})).toThrow(/main service's own device/)
  })
  test("refuses the smoke account's paper key, by id or by name", () => {
    const byId = {deviceID: id('p'), name: 'e2e-0abcd1-prov'}
    expect(() => checkFlowRevokeTarget({...base, expected: byId, target: byId})).toThrow(/protected paper key/)
    const byName = {deviceID: id('t'), name: 'alpha beta'}
    expect(() => checkFlowRevokeTarget({...base, expected: byName, target: byName})).toThrow(/protected paper key/)
  })
  test('refuses any device but the expected one', () => {
    expect(() => checkFlowRevokeTarget({...base, target: {deviceID: id('t'), name: 'e2e-0abcd1-other'}})).toThrow(/not the expected/)
    expect(() => checkFlowRevokeTarget({...base, target: {deviceID: id('u'), name: 'e2e-0abcd1-prov'}})).toThrow(/not the expected/)
  })
  test('refuses when an id it compares against is unknown', () => {
    expect(() => checkFlowRevokeTarget({...base, mainDeviceID: ''})).toThrow(/unknown/)
    const blank = {deviceID: '', name: 'e2e-0abcd1-prov'}
    expect(() => checkFlowRevokeTarget({...base, expected: blank, target: blank})).toThrow(/unknown/)
  })
})

// the sweeper's revoke path: the ledger names the device, this refuses the env file's paper key
describe('checkNotProtectedPaperKey', () => {
  const key = 'alpha beta gamma delta'
  const listed = [
    {deviceID: id('p'), name: 'Paper Key (alpha beta...)', type: 'backup'},
    {deviceID: id('q'), name: 'Paper Key (other words...)', type: 'backup'},
    {deviceID: id('d'), name: 'alpha beta', type: 'desktop'},
  ]
  test("finds the protected key's id in deviceList's naming", () => {
    expect(protectedPaperKeyIn(listed, key)).toEqual({deviceID: id('p'), name: 'alpha beta'})
    expect(protectedPaperKeyIn(listed.slice(1), key)).toEqual({deviceID: undefined, name: 'alpha beta'})
  })
  test('refuses it by id, by its own name, or by its deviceList name', () => {
    const p = protectedPaperKeyIn(listed, key)
    expect(() => checkNotProtectedPaperKey({deviceID: id('p'), name: 'renamed'}, p)).toThrow(/protected paper key/)
    expect(() => checkNotProtectedPaperKey({deviceID: id('z'), name: 'Paper Key (alpha beta...)'}, p)).toThrow(/protected paper key/)
    expect(() => checkNotProtectedPaperKey({deviceID: id('z'), name: 'alpha beta'}, {name: 'alpha beta'})).toThrow(/protected paper key/)
  })
  test('passes another paper key, and refuses when the protected key is unknown', () => {
    const p = protectedPaperKeyIn(listed, key)
    expect(() => checkNotProtectedPaperKey({deviceID: id('q'), name: 'Paper Key (other words...)'}, p)).not.toThrow()
    expect(() => checkNotProtectedPaperKey({deviceID: id('q'), name: 'x'}, {name: ''})).toThrow(/unknown/)
  })
})
