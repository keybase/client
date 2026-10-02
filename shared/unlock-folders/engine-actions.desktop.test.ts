/// <reference types="jest" />
import {handleUnlockFoldersEngineAction} from './engine-actions.desktop'

const mockOpen = jest.fn()

afterEach(() => {
  jest.restoreAllMocks()
  mockOpen.mockReset()
})

test('rekey refresh actions forward the device list to unlock folders', () => {
  handleUnlockFoldersEngineAction(
    {
      payload: {
        params: {
          problemSetDevices: {
            devices: [{deviceID: 'device-1', name: 'device-1', type: 'desktop'}],
          },
        },
      },
      type: 'keybase.1.rekeyUI.refresh',
    } as any,
    mockOpen
  )

  expect(mockOpen).toHaveBeenCalledWith([{deviceID: 'device-1', name: 'device-1', type: 'desktop'}])
})
