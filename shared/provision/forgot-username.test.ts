/// <reference types="jest" />
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {decodeForgotUsernameError} from './forgot-username'

const makeError = (code: number, desc: string) => new RPCError(desc, code)

describe('decodeForgotUsernameError', () => {
  test('scnotfound explains no account matched the email', () => {
    expect(decodeForgotUsernameError(makeError(T.RPCGen.StatusCode.scnotfound, 'ignored desc'))).toBe(
      "We couldn't find an account with that email address. Try again?"
    )
  })

  test('scinputerror explains the address is malformed', () => {
    expect(decodeForgotUsernameError(makeError(T.RPCGen.StatusCode.scinputerror, 'ignored desc'))).toBe(
      "That doesn't look like a valid email address. Try again?"
    )
  })

  test('handled codes ignore the server desc entirely', () => {
    for (const code of [T.RPCGen.StatusCode.scnotfound, T.RPCGen.StatusCode.scinputerror]) {
      const withDesc = decodeForgotUsernameError(makeError(code, 'some raw server text'))
      const withoutDesc = decodeForgotUsernameError(makeError(code, ''))
      expect(withDesc).toBe(withoutDesc)
      expect(withDesc).not.toBe('some raw server text')
    }
  })

  test('unknown codes pass the raw desc through', () => {
    const unknown = [
      0,
      -1,
      T.RPCGen.StatusCode.scgeneric,
      T.RPCGen.StatusCode.scbadusername,
      T.RPCGen.StatusCode.scapinetworkerror,
      T.RPCGen.StatusCode.scdeleted,
      999999,
    ]
    for (const code of unknown) {
      expect(decodeForgotUsernameError(makeError(code, 'raw server text'))).toBe('raw server text')
    }
  })

  test('unknown code with an empty desc yields an empty string, not undefined', () => {
    const result = decodeForgotUsernameError(makeError(T.RPCGen.StatusCode.scgeneric, ''))
    expect(result).toBe('')
    expect(typeof result).toBe('string')
  })

  test('unknown code with a whitespace-only desc is passed through verbatim', () => {
    expect(decodeForgotUsernameError(makeError(T.RPCGen.StatusCode.scgeneric, '   '))).toBe('   ')
    expect(decodeForgotUsernameError(makeError(T.RPCGen.StatusCode.scgeneric, '\n\t'))).toBe('\n\t')
  })

  test('an empty result never equals the sentinel the screen uses for success', () => {
    // the screen treats a result of exactly 'success' as "sent", everything else as an error banner
    expect(decodeForgotUsernameError(makeError(T.RPCGen.StatusCode.scgeneric, ''))).not.toBe('success')
    expect(decodeForgotUsernameError(makeError(T.RPCGen.StatusCode.scnotfound, ''))).not.toBe('success')
  })
})
