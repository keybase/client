/** @jest-environment jsdom */
/// <reference types="jest" />
import * as NavTree from '@/constants/nav-tree'
import * as Tabs from '@/constants/tabs'
import {act, cleanup, render} from '@testing-library/react'
import {navigationRef} from '@/constants/router'
import {useRouterState} from '@/stores/router'
import {resetAllStores} from '@/util/zustand'
import {FsDaemonProvider} from './daemon'
import {fsUserIn, fsUserOut} from './lifecycle'

jest.mock('./lifecycle', () => ({
  afterKbfsDaemonRpcStatusChanged: jest.fn(),
  fsUserIn: jest.fn(),
  fsUserOut: jest.fn(),
}))

const fsState = NavTree.tabState(Tabs.fsTab, [{name: 'fsRoot'}]) as unknown as NavTree.NavState

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
  resetAllStores()
})

// The router store starts with no nav state, so the first state the provider sees has an
// undefined predecessor. That must read as "was on no screen", not as whatever the live
// navigator shows right now - which is already the new state.
test('landing on a files screen from the initial undefined nav state counts as entering files', () => {
  NavTree.setModalRouteNames([])
  ;(navigationRef as unknown as Record<string, unknown>)['getRootState'] = () => fsState
  render(<FsDaemonProvider>{null}</FsDaemonProvider>)

  act(() => {
    useRouterState.setState({navState: fsState})
  })

  expect(fsUserIn).toHaveBeenCalledTimes(1)
  expect(fsUserOut).not.toHaveBeenCalled()
})
