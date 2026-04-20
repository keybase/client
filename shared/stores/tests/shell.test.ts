/// <reference types="jest" />
import {defaultUseNativeFrame} from '../../constants/platform'
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
