/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {useUnlockFoldersState} from '../unlock-folders'

const mockOpenUnlockFolders = jest.fn()

jest.mock('@/stores/config', () => ({
  useConfigState: {
    getState: () => ({
      dispatch: {
        openUnlockFolders: mockOpenUnlockFolders,
      },
    }),
  },
}))

afterEach(() => {
  jest.restoreAllMocks()
  mockOpenUnlockFolders.mockReset()
  resetAllStores()
})

test('local dispatches move between unlock-folder phases', () => {
  const store = useUnlockFoldersState

  store.getState().dispatch.toPaperKeyInput()
  expect(store.getState().phase).toBe('paperKeyInput')

  store.getState().dispatch.onBackFromPaperKey()
  expect(store.getState().phase).toBe('promptOtherDevice')
})

test('replace stores the provided devices', () => {
  const devices = [{deviceID: 'device-1', name: 'device-1', type: 'desktop'}] as any

  useUnlockFoldersState.getState().dispatch.replace(devices)

  expect(useUnlockFoldersState.getState().devices).toEqual(devices)
})

test('rekey refresh actions forward the device list to config', () => {
  useUnlockFoldersState.getState().dispatch.onEngineIncomingImpl({
    payload: {
      params: {
        problemSetDevices: {
          devices: [{deviceID: 'device-1', name: 'device-1', type: 'desktop'}],
        },
      },
    },
    type: 'keybase.1.rekeyUI.refresh',
  } as any)

  expect(mockOpenUnlockFolders).toHaveBeenCalledWith([{deviceID: 'device-1', name: 'device-1', type: 'desktop'}])
})
