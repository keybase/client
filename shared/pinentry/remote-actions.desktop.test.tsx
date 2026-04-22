/// <reference types="jest" />
import * as RemoteGen from '@/constants/remote-actions'

import {dispatchPinentryRemoteAction, subscribeToPinentryRemoteAction} from './remote-actions.desktop'

afterEach(() => {
  jest.restoreAllMocks()
})

test('pinentry remote actions dispatch to the subscribed owner', () => {
  const listener = jest.fn()
  const unsubscribe = subscribeToPinentryRemoteAction(listener)

  dispatchPinentryRemoteAction(RemoteGen.createPinentryOnSubmit({password: 'hunter2'}))
  dispatchPinentryRemoteAction(RemoteGen.createPinentryOnCancel())

  expect(listener).toHaveBeenNthCalledWith(1, RemoteGen.createPinentryOnSubmit({password: 'hunter2'}))
  expect(listener).toHaveBeenNthCalledWith(2, RemoteGen.createPinentryOnCancel())

  unsubscribe()
})

test('pinentry remote actions stop after unsubscribe', () => {
  const listener = jest.fn()
  const unsubscribe = subscribeToPinentryRemoteAction(listener)

  unsubscribe()
  dispatchPinentryRemoteAction(RemoteGen.createPinentryOnSubmit({password: 'hunter2'}))

  expect(listener).not.toHaveBeenCalled()
})
