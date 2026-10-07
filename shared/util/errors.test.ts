/// <reference types="jest" />
import * as T from '@/constants/types'
import {convertToError, ensureError, errorKind, isCancelled, isLoginRequired, isQuietCancel, RPCError} from './errors'

const S = T.RPCGen.StatusCode

describe("an error the service sent reads by its code", () => {
  test.each([
    ['sccanceled', S.sccanceled, {reason: 'service', type: 'cancelled'}],
    ['scinputcanceled', S.scinputcanceled, {reason: 'service', type: 'cancelled'}],
    ['scloginrequired', S.scloginrequired, {type: 'loginRequired'}],
    ['sctimeout', S.sctimeout, {type: 'service'}],
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

test.each([
  ['caller', true],
  ['accountChange', true],
  ['service', true],
  ['disconnect', false],
] as const)('isQuietCancel: cancelled by %s -> %s', (reason, expected) => {
  expect(isQuietCancel(new RPCError('x', S.sccanceled, null, undefined, undefined, {reason, type: 'cancelled'}))).toBe(expected)
})

test.each([
  ['a service error', new RPCError('x', S.scgeneric)],
  ['a local failure', new RPCError('x', 101, null, 'EOF', undefined, {type: 'local'})],
  ['a plain Error', new Error('boom')],
])('isQuietCancel: %s is not a cancel', (_, e) => {
  expect(isQuietCancel(e)).toBe(false)
})

test('login-required reads by its kind, also on the Error a listener wraps it in', () => {
  const e = new RPCError('login required', S.scloginrequired)
  expect(isLoginRequired(e)).toBe(true)
  expect(isLoginRequired(ensureError(e))).toBe(true)
  expect(isLoginRequired(new RPCError('x', S.scgeneric))).toBe(false)
  expect(isLoginRequired(new Error('boom'))).toBe(false)
})
