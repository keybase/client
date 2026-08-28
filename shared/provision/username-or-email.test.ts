/// <reference types="jest" />
import * as T from '@/constants/types'
import {usernameHint} from '@/constants/strings'
import {decodeInlineError} from './username-or-email'

describe('decodeInlineError', () => {
  test('scnotfound offers the signup link with no inline error copy', () => {
    expect(decodeInlineError(T.RPCGen.StatusCode.scnotfound)).toEqual({
      inlineError: '',
      inlineSignUpLink: true,
    })
  })

  test('scbadusername shows the username hint and no signup link', () => {
    expect(decodeInlineError(T.RPCGen.StatusCode.scbadusername)).toEqual({
      inlineError: usernameHint,
      inlineSignUpLink: false,
    })
  })

  test('undefined code falls back to no error and no signup link', () => {
    expect(decodeInlineError(undefined)).toEqual({inlineError: '', inlineSignUpLink: false})
    expect(decodeInlineError()).toEqual({inlineError: '', inlineSignUpLink: false})
  })

  test('unknown codes fall back to no error and no signup link', () => {
    const unknown = [
      0,
      -1,
      1,
      T.RPCGen.StatusCode.scgeneric,
      T.RPCGen.StatusCode.scbadloginpassword,
      T.RPCGen.StatusCode.scdeleted,
      T.RPCGen.StatusCode.scinputerror,
      T.RPCGen.StatusCode.scapinetworkerror,
      999999,
    ]
    for (const code of unknown) {
      expect(decodeInlineError(code)).toEqual({inlineError: '', inlineSignUpLink: false})
    }
  })

  test('the two handled codes are mutually exclusive', () => {
    const notFound = decodeInlineError(T.RPCGen.StatusCode.scnotfound)
    const badUsername = decodeInlineError(T.RPCGen.StatusCode.scbadusername)
    expect(notFound.inlineSignUpLink).not.toBe(badUsername.inlineSignUpLink)
    expect(!!notFound.inlineError).not.toBe(!!badUsername.inlineError)
  })
})
