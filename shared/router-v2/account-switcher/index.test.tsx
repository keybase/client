/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'

jest.mock('@/common-adapters', () => {
  const React = require('react')
  const Pass = ({children}: {children?: React.ReactNode}) => React.createElement('div', null, children)
  return {
    Avatar: () => null,
    Box2: Pass,
    Divider: () => null,
    ListItem: ({body, onClick}: {body?: React.ReactNode; onClick?: () => void}) =>
      React.createElement('button', {onClick, type: 'button'}, body),
    ProgressIndicator: () => null,
    ScrollView: Pass,
    Styles: {
      createStyleHook: () => () => ({}),
      platformStyles: () => ({}),
    },
    Text: ({children}: {children?: React.ReactNode}) => React.createElement('span', null, children),
  }
})

import AccountSwitcher from '.'

beforeEach(() => {
  useCurrentUserState
    .getState()
    .dispatch.setBootstrap({deviceID: 'd', deviceName: 'dn', uid: 'testuser', username: 'testuser'})
  useConfigState.getState().dispatch.setAccounts([
    {fullname: '', hasStoredSecret: true, uid: 'testuser-mac', username: 'testuser-mac'},
  ])
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  act(() => {
    resetAllStores()
  })
})

const loginSpy = () => jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockImplementation(async () => new Promise(() => {}))

test('an account row starts a switch when no switch is running', () => {
  const login = loginSpy()
  render(<AccountSwitcher />)

  fireEvent.click(screen.getByRole('button', {name: 'testuser-mac'}))

  expect(login).toHaveBeenCalled()
})

test('account rows are disabled while a switch is running, even after the reset clears the login waiting key', () => {
  const login = loginSpy()
  act(() => {
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-other')
  })
  render(<AccountSwitcher />)

  fireEvent.click(screen.getByRole('button', {name: 'testuser-mac'}))

  expect(login).not.toHaveBeenCalled()
})
