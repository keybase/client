/// <reference types="jest" />
import {defaultUseNativeFrame} from '../../constants/platform'
import * as T from '@/constants/types'
import {useShellState} from '../shell'

const defaultWindowState = {
  dockHidden: false,
  height: 800,
  isFullScreen: false,
  isMaximized: false,
  width: 600,
  windowHidden: false,
  x: 0,
  y: 0,
}

const resetShellState = () => {
  const {dispatch} = useShellState.getState()
  useShellState.setState({
    active: true,
    appFocused: true,
    desktopNotifications: true,
    desktopNotificationsLoaded: false,
    forceSmallNav: false,
    mobileAppState: 'unknown',
    networkStatus: undefined,
    notifySound: false,
    openAtLogin: true,
    useNativeFrame: defaultUseNativeFrame,
    windowState: {...defaultWindowState},
  } as any)
  dispatch.resetState()
}

beforeEach(() => {
  resetShellState()
})

afterEach(() => {
  resetShellState()
})

test('local shell actions update focus and activity state', () => {
  const {dispatch} = useShellState.getState()

  dispatch.changedFocus(false)
  dispatch.setActive(false)
  dispatch.setMobileAppState('background')
  dispatch.setWindowMaximized(true)

  expect(useShellState.getState()).toEqual(
    expect.objectContaining({
      active: false,
      appFocused: false,
      mobileAppState: 'background',
      windowState: expect.objectContaining({isMaximized: true}),
    })
  )
})

test('resetState preserves shell-owned fields across store resets', () => {
  const {dispatch} = useShellState.getState()

  useShellState.setState({
    active: false,
    appFocused: false,
    forceSmallNav: true,
    mobileAppState: 'background',
    networkStatus: {isInit: true, online: false, type: 'notavailable'},
    notifySound: true,
    openAtLogin: false,
    useNativeFrame: !defaultUseNativeFrame,
    windowState: {
      ...defaultWindowState,
      dockHidden: true,
      height: 720,
      isMaximized: true,
      width: 1024,
      x: 10,
      y: 20,
    },
  } as any)

  dispatch.resetState()

  expect(useShellState.getState()).toEqual(
    expect.objectContaining({
      active: false,
      appFocused: false,
      forceSmallNav: true,
      mobileAppState: 'background',
      networkStatus: {isInit: true, online: false, type: 'notavailable'},
      notifySound: true,
      openAtLogin: false,
      useNativeFrame: !defaultUseNativeFrame,
      windowState: {
        ...defaultWindowState,
        dockHidden: true,
        height: 720,
        isMaximized: true,
        width: 1024,
        x: 10,
        y: 20,
      },
    })
  )
})

test('initDesktopNotifications applies the saved setting', async () => {
  const getValue = jest
    .spyOn(T.RPCGen, 'configGuiGetValueRpcPromise')
    .mockResolvedValue({b: false, isNull: false} as T.RPCGen.ConfigValue)

  await useShellState.getState().dispatch.initDesktopNotifications()

  expect(getValue).toHaveBeenCalledWith({path: 'desktopNotifications'})
  expect(useShellState.getState().desktopNotifications).toBe(false)
  expect(useShellState.getState().desktopNotificationsLoaded).toBe(true)
  getValue.mockRestore()
})

test('initDesktopNotifications keeps the default when nothing is saved', async () => {
  const getValue = jest
    .spyOn(T.RPCGen, 'configGuiGetValueRpcPromise')
    .mockResolvedValue({isNull: true} as T.RPCGen.ConfigValue)
  await useShellState.getState().dispatch.initDesktopNotifications()
  expect(useShellState.getState().desktopNotifications).toBe(true)
  expect(useShellState.getState().desktopNotificationsLoaded).toBe(true)
  getValue.mockRestore()
})

test('initDesktopNotifications keeps the default and finishes loading when the read fails', async () => {
  const getValue = jest.spyOn(T.RPCGen, 'configGuiGetValueRpcPromise').mockRejectedValue(new Error('no service'))
  await useShellState.getState().dispatch.initDesktopNotifications()
  expect(useShellState.getState().desktopNotifications).toBe(true)
  expect(useShellState.getState().desktopNotificationsLoaded).toBe(true)
  getValue.mockRestore()
})

test('setDesktopNotifications saves the setting', async () => {
  const setValue = jest.spyOn(T.RPCGen, 'configGuiSetValueRpcPromise').mockResolvedValue(undefined)

  useShellState.getState().dispatch.setDesktopNotifications(false)
  expect(useShellState.getState().desktopNotifications).toBe(false)
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(setValue).toHaveBeenCalledWith({path: 'desktopNotifications', value: {b: false, isNull: false}})
  setValue.mockRestore()
})
