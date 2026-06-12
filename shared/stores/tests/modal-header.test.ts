/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useModalHeaderState} from '../modal-header'
import {useNotifState} from '../notifications'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('resetState restores the modal header defaults', () => {
  const store = useModalHeaderState

  store.setState(
    {
      ...store.getState(),
      actionEnabled: true,
      actionWaiting: true,
      botInTeam: true,
      botReadOnly: true,
      botSubScreen: 'install',
      onAction: () => undefined,
      title: 'custom title',
    }
  )

  resetAllStores()

  expect(store.getState().actionEnabled).toBe(false)
  expect(store.getState().actionWaiting).toBe(false)
  expect(store.getState().botSubScreen).toBe('')
  expect(store.getState().title).toBe('')
})

test('clearDeviceBadges clears badge state and dismisses device badge notifications', () => {
  const dismiss = jest
    .spyOn(T.RPCGen, 'deviceDismissDeviceChangeNotificationsRpcPromise')
    .mockResolvedValue(undefined as never)
  const store = useNotifState

  store.setState({deviceBadges: new Set(['device-1', 'device-2'])})
  expect(store.getState().deviceBadges).toEqual(new Set(['device-1', 'device-2']))

  store.getState().dispatch.clearDeviceBadges()
  expect(store.getState().deviceBadges).toEqual(new Set())
  expect(dismiss).toHaveBeenCalled()
})
