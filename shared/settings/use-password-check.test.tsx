/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {usePasswordCheck} from './use-password-check'

const checkRpc = 'keybase.1.account.passphraseCheck'

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

const renderCheck = () => {
  const fake = installFakeEngine()
  const held = fake.hold(checkRpc)
  const {result} = renderHook(() => usePasswordCheck())
  const check = async (passphrase: string) => {
    act(() => {
      result.current.checkPassword(passphrase)
    })
    await flush()
  }
  const answer = async (a: unknown) => {
    held.shift()!.reply(a)
    await flush()
  }
  return {answer, check, held, result}
}

test('checkPassword forwards the passphrase and records the answer once the service gives it', async () => {
  const {answer, check, held, result} = renderCheck()

  expect(result.current.checkPasswordIsCorrect).toBeUndefined()

  await check('open sesame')
  expect(held[0]!.params).toEqual(expect.objectContaining({passphrase: 'open sesame'}))
  expect(result.current.checkPasswordIsCorrect).toBeUndefined()

  await answer(true)
  expect(result.current.checkPasswordIsCorrect).toBe(true)

  await check('nope')
  await answer(false)
  expect(result.current.checkPasswordIsCorrect).toBe(false)
})

test('a new check clears the previous answer while it is in flight', async () => {
  const {answer, check, result} = renderCheck()

  await check('open sesame')
  await answer(true)
  expect(result.current.checkPasswordIsCorrect).toBe(true)

  await check('again')
  expect(result.current.checkPasswordIsCorrect).toBeUndefined()
  await answer(false)
})

test('errors clear the answer and are logged rather than surfaced', async () => {
  const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const {answer, check, result} = renderCheck()

  await check('open sesame')
  await answer(true)
  await check('boom')
  await answer(fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))

  expect(result.current.checkPasswordIsCorrect).toBeUndefined()
  expect(warnSpy).toHaveBeenCalledWith(
    'Error checking password',
    expect.objectContaining({code: T.RPCGen.StatusCode.scgeneric})
  )
})

test('reset clears the answer', async () => {
  const {answer, check, result} = renderCheck()

  await check('open sesame')
  await answer(true)

  act(() => {
    result.current.reset()
  })
  expect(result.current.checkPasswordIsCorrect).toBeUndefined()
})

test("an older check's late answer does not stand for the newer passphrase", async () => {
  const {check, held, result} = renderCheck()

  await check('the right one')
  await check('a wrong one')
  // the service answers the newer check first, then the older
  const [older, newer] = [held.shift()!, held.shift()!]
  newer.reply(false)
  await flush()
  older.reply(true)
  await flush()

  expect(result.current.checkPasswordIsCorrect).toBe(false)
})
