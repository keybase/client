/// <reference types="jest" />
import * as T from '@/constants/types'
import {convertToError, ensureError, errorKind, isCancelled, RPCError} from './errors'

const S = T.RPCGen.StatusCode

describe("an error the service sent reads by its code", () => {
  test.each([
    ['sccanceled', S.sccanceled, {reason: 'service', type: 'cancelled'}],
    ['scinputcanceled', S.scinputcanceled, {reason: 'service', type: 'cancelled'}],
    ['scloginrequired', S.scloginrequired, {type: 'loginRequired'}],
    ['scgenericapierror', S.scgenericapierror, {type: 'network'}],
    ['scapinetworkerror', S.scapinetworkerror, {type: 'network'}],
    ['sctimeout', S.sctimeout, {type: 'network'}],
    ['scassertionparseerror (101, the EOF code)', S.scassertionparseerror, {type: 'service'}],
    ['scgeneric', S.scgeneric, {type: 'service'}],
    ['scnotfound', S.scnotfound, {type: 'service'}],
  ])('%s', (_, code, kind) => {
    expect(new RPCError('desc', code).kind).toEqual(kind)
    expect(errorKind(convertToError({code, desc: 'desc'}))).toEqual(kind)
  })
})

test('a kind the client gave its error wins over the code', () => {
  const kind = {reason: 'disconnect', type: 'cancelled'} as const
  expect(new RPCError('lost', 101, null, 'EOF', undefined, kind).kind).toEqual(kind)
  expect(errorKind(convertToError({code: 101, desc: 'lost', kind}))).toEqual(kind)
})

test('the kind rides on the Error a listener wraps an RPCError in', () => {
  const wrapped = ensureError(new RPCError('x', S.sccanceled, null, undefined, undefined, {reason: 'caller', type: 'cancelled'}))
  expect(wrapped).toBeInstanceOf(Error)
  expect(errorKind(wrapped)).toEqual({reason: 'caller', type: 'cancelled'})
  expect(isCancelled(wrapped, 'caller')).toBe(true)
})

test('anything that is not an RPCError has no kind', () => {
  expect(errorKind(new Error('boom'))).toBeUndefined()
  expect(errorKind(undefined)).toBeUndefined()
  expect(errorKind('boom')).toBeUndefined()
  expect(errorKind({kind: 'cancelled'})).toBeUndefined()
  expect(isCancelled(new Error('boom'))).toBe(false)
})

test('isCancelled matches any reason, or only the ones named', () => {
  const byCaller = new RPCError('x', S.sccanceled, null, undefined, undefined, {reason: 'caller', type: 'cancelled'})
  expect(isCancelled(byCaller)).toBe(true)
  expect(isCancelled(byCaller, 'caller')).toBe(true)
  expect(isCancelled(byCaller, 'accountChange', 'disconnect')).toBe(false)
  expect(isCancelled(new RPCError('x', S.scgeneric))).toBe(false)
})
