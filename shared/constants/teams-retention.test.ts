/// <reference types="jest" />
import * as T from './types'
import {
  baseRetentionPolicies,
  makeRetentionPolicy,
  retentionPolicies,
  retentionPolicyToServiceRetentionPolicy,
  serviceRetentionPolicyToRetentionPolicy,
} from './teams'

describe('serviceRetentionPolicyToRetentionPolicy', () => {
  test('a missing policy means retain forever', () => {
    expect(serviceRetentionPolicyToRetentionPolicy()).toEqual(makeRetentionPolicy({type: 'retain'}))
    expect(serviceRetentionPolicyToRetentionPolicy(null)).toEqual(makeRetentionPolicy({type: 'retain'}))
  })

  test('explicit retain gets the human title', () => {
    expect(
      serviceRetentionPolicyToRetentionPolicy({retain: {}, typ: T.RPCChat.RetentionPolicyType.retain})
    ).toEqual({seconds: 0, title: 'Never auto-delete', type: 'retain'})
  })

  test('inherit carries no title or seconds', () => {
    expect(
      serviceRetentionPolicyToRetentionPolicy({inherit: {}, typ: T.RPCChat.RetentionPolicyType.inherit})
    ).toEqual({seconds: 0, title: '', type: 'inherit'})
  })

  test('expire uses the known title for known ages', () => {
    expect(
      serviceRetentionPolicyToRetentionPolicy({
        expire: {age: 30 * 3600 * 24},
        typ: T.RPCChat.RetentionPolicyType.expire,
      })
    ).toEqual(retentionPolicies.policyMonth)
  })

  test('expire falls back to a seconds title for unknown ages', () => {
    expect(
      serviceRetentionPolicyToRetentionPolicy({
        expire: {age: 1234},
        typ: T.RPCChat.RetentionPolicyType.expire,
      })
    ).toEqual({seconds: 1234, title: '1234 seconds', type: 'expire'})
  })

  test('ephemeral maps to the explode type', () => {
    expect(
      serviceRetentionPolicyToRetentionPolicy({
        ephemeral: {age: 3600},
        typ: T.RPCChat.RetentionPolicyType.ephemeral,
      })
    ).toEqual(retentionPolicies.policyOneHour)
  })

  test('an unrecognized typ degrades to retain', () => {
    expect(
      serviceRetentionPolicyToRetentionPolicy({typ: 999 as T.RPCChat.RetentionPolicyType} as never)
    ).toEqual(makeRetentionPolicy({type: 'retain'}))
  })
})

describe('retentionPolicyToServiceRetentionPolicy', () => {
  test.each([
    [retentionPolicies.policyRetain, T.RPCChat.RetentionPolicyType.retain],
    [retentionPolicies.policyInherit, T.RPCChat.RetentionPolicyType.inherit],
    [retentionPolicies.policyMonth, T.RPCChat.RetentionPolicyType.expire],
    [retentionPolicies.policyOneHour, T.RPCChat.RetentionPolicyType.ephemeral],
  ])('$type maps to the right service typ', (policy, typ) => {
    expect(retentionPolicyToServiceRetentionPolicy(policy).typ).toBe(typ)
  })

  test('seconds survive the trip out to the service', () => {
    expect(retentionPolicyToServiceRetentionPolicy(retentionPolicies.policyThreeMonths)).toEqual({
      expire: {age: 90 * 3600 * 24},
      typ: T.RPCChat.RetentionPolicyType.expire,
    })
    expect(retentionPolicyToServiceRetentionPolicy(retentionPolicies.policyThirtySeconds)).toEqual({
      ephemeral: {age: 30},
      typ: T.RPCChat.RetentionPolicyType.ephemeral,
    })
  })

  test('every base policy round trips back to itself', () => {
    for (const policy of baseRetentionPolicies) {
      const back = serviceRetentionPolicyToRetentionPolicy(retentionPolicyToServiceRetentionPolicy(policy))
      expect(back).toEqual(policy)
    }
  })

  test('base policies are ordered longest retention first', () => {
    const [retain, ...rest] = baseRetentionPolicies
    expect(retain?.type).toBe('retain')
    const seconds = rest.map(p => p!.seconds)
    expect([...seconds].sort((a, b) => b - a)).toEqual(seconds)
  })
})
