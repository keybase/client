/// <reference types="jest" />
import {handleUnlockFoldersEngineAction} from './engine-actions.desktop'

const mockOpen = jest.fn()
const mockCreateSession = jest.fn()

jest.mock('@/engine/require', () => ({
  getEngine: () => ({
    createSession: mockCreateSession,
  }),
}))

afterEach(() => {
  jest.restoreAllMocks()
  mockCreateSession.mockReset()
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

test('delegateRekeyUI creates a dangling session and returns its id', () => {
  const response = {result: jest.fn()}
  mockCreateSession.mockReturnValue({id: 42})

  handleUnlockFoldersEngineAction(
    {
      payload: {response},
      type: 'keybase.1.rekeyUI.delegateRekeyUI',
    } as any,
    mockOpen
  )

  expect(mockCreateSession).toHaveBeenCalledWith(
    expect.objectContaining({
      dangling: true,
      incomingCallMap: expect.objectContaining({
        'keybase.1.rekeyUI.refresh': expect.any(Function),
        'keybase.1.rekeyUI.rekeySendEvent': expect.any(Function),
      }),
    })
  )
  expect(response.result).toHaveBeenCalledWith(42)
})
