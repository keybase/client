/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'

import {callNamed, consumeKeyed, registerKeyed, setNamed, clearOwner} from '../flow-handles'

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

test('keyed handles are one-shot when consumed', () => {
  const fn = jest.fn()

  const key = registerKeyed('reset', 'submitResetPrompt', fn)
  consumeKeyed(key, 'confirm')
  consumeKeyed(key, 'confirm-again')

  expect(fn).toHaveBeenCalledTimes(1)
  expect(fn).toHaveBeenCalledWith('confirm')
})
