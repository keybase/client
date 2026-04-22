/// <reference types="jest" />
import * as RemoteGen from '@/constants/remote-actions'
import {resetAllStores} from '@/util/zustand'

import {handlePinentryPopupRemoteAction, registerPinentryPopupHandlers} from './desktop-popup-handles'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('pinentry popup handlers dispatch remote submit and cancel actions', () => {
  const cancel = jest.fn()
  const submit = jest.fn()

  registerPinentryPopupHandlers({cancel, submit})

  handlePinentryPopupRemoteAction(RemoteGen.createPinentryOnSubmit({password: 'hunter2'}))
  handlePinentryPopupRemoteAction(RemoteGen.createPinentryOnCancel())

  expect(submit).toHaveBeenCalledWith('hunter2')
  expect(cancel).toHaveBeenCalledTimes(1)
})

test('resetAllStores clears registered pinentry popup handlers', () => {
  const submit = jest.fn()

  registerPinentryPopupHandlers({cancel: jest.fn(), submit})
  resetAllStores()

  handlePinentryPopupRemoteAction(RemoteGen.createPinentryOnSubmit({password: 'hunter2'}))

  expect(submit).not.toHaveBeenCalled()
})
