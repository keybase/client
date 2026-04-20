/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'

import {
  callNamed,
  clearNamedIfToken,
  consumeKeyed,
  registerKeyed,
  registerKeyedScoped,
  setNamed,
  setNamedScoped,
  clearOwner,
} from '../flow-handles'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('named handles can be set, called, and cleared by owner', () => {
  const fn = jest.fn()

  setNamed('recoverPassword', 'submitPassword', fn)
  callNamed('recoverPassword', 'submitPassword', 'hunter2')
  expect(fn).toHaveBeenCalledWith('hunter2')

  clearOwner('recoverPassword')
  callNamed('recoverPassword', 'submitPassword', 'again')
  expect(fn).toHaveBeenCalledTimes(1)
})

test('token-based named cleanup does not clear newer replacement handlers', () => {
  const stale = jest.fn()
  const current = jest.fn()

  const staleToken = setNamed('recoverPassword', 'submitPassword', stale)
  const currentToken = setNamed('recoverPassword', 'submitPassword', current)
  expect(staleToken).toBeDefined()
  expect(currentToken).toBeDefined()

  clearNamedIfToken('recoverPassword', 'submitPassword', staleToken ?? -1)
  callNamed('recoverPassword', 'submitPassword', 'hunter2')
  expect(stale).not.toHaveBeenCalled()
  expect(current).toHaveBeenCalledWith('hunter2')

  clearNamedIfToken('recoverPassword', 'submitPassword', currentToken ?? -1)
  callNamed('recoverPassword', 'submitPassword', 'again')
  expect(current).toHaveBeenCalledTimes(1)
})

test('scoped named disposers do not clear newer replacement handlers', () => {
  const stale = jest.fn()
  const current = jest.fn()

  const staleHandle = setNamedScoped('recoverPassword', 'submitPassword', stale)
  const currentHandle = setNamedScoped('recoverPassword', 'submitPassword', current)

  staleHandle.dispose()
  callNamed('recoverPassword', 'submitPassword', 'hunter2')
  expect(stale).not.toHaveBeenCalled()
  expect(current).toHaveBeenCalledWith('hunter2')

  currentHandle.dispose()
  callNamed('recoverPassword', 'submitPassword', 'again')
  expect(current).toHaveBeenCalledTimes(1)
})

test('keyed handles are one-shot when consumed', () => {
  const fn = jest.fn()

  const key = registerKeyed('reset', 'submitResetPrompt', fn)
  consumeKeyed(key, 'confirm')
  consumeKeyed(key, 'confirm-again')

  expect(fn).toHaveBeenCalledTimes(1)
  expect(fn).toHaveBeenCalledWith('confirm')
})

test('scoped keyed disposers clear unconsumed handlers', () => {
  const fn = jest.fn()

  const handle = registerKeyedScoped('reset', 'submitResetPrompt', fn)
  handle.dispose()
  consumeKeyed(handle.key, 'confirm')

  expect(fn).not.toHaveBeenCalled()
})
