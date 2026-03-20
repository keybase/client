/// <reference types="jest" />
import {resetAllStores} from '../../util/zustand'
import {useConfigState} from '../config'
import {useState as useWalletsState} from '../wallets'
import * as T from '../../constants/types'

const mockLocalGetWalletAccountsLocalRpcPromise = jest.fn()
const mockLocalDeleteWalletAccountLocalRpcPromise = jest.fn()

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  mockLocalGetWalletAccountsLocalRpcPromise.mockReset()
  mockLocalDeleteWalletAccountLocalRpcPromise.mockReset()
  jest.restoreAllMocks()
  resetAllStores()
})

test('load populates the wallet account map when logged in', async () => {
  mockLocalGetWalletAccountsLocalRpcPromise.mockResolvedValue([
    {
      accountID: 'acct-1',
      balanceDescription: '1.00 XLM',
      deviceReadOnly: false,
      isDefault: true,
      name: 'Primary',
    },
  ])
  jest.spyOn(T.RPCStellar, 'localGetWalletAccountsLocalRpcPromise').mockImplementation(
    mockLocalGetWalletAccountsLocalRpcPromise
  )

  useWalletsState.getState().dispatch.load()
  await new Promise<void>(resolve => setImmediate(resolve))

  expect(mockLocalGetWalletAccountsLocalRpcPromise).toHaveBeenCalled()
  expect(useWalletsState.getState().accountMap.get('acct-1')).toMatchObject({
    accountID: 'acct-1',
    balanceDescription: '1.00 XLM',
    deviceReadOnly: false,
    isDefault: true,
    name: 'Primary',
  })
})

test('removeAccount deletes then reloads the wallet account list', async () => {
  mockLocalGetWalletAccountsLocalRpcPromise.mockResolvedValue([])
  mockLocalDeleteWalletAccountLocalRpcPromise.mockResolvedValue(undefined)
  jest.spyOn(T.RPCStellar, 'localGetWalletAccountsLocalRpcPromise').mockImplementation(
    mockLocalGetWalletAccountsLocalRpcPromise
  )
  jest.spyOn(T.RPCStellar, 'localDeleteWalletAccountLocalRpcPromise').mockImplementation(
    mockLocalDeleteWalletAccountLocalRpcPromise
  )

  useWalletsState.getState().dispatch.removeAccount('acct-1')
  await new Promise<void>(resolve => setImmediate(resolve))
  await new Promise<void>(resolve => setImmediate(resolve))
  await new Promise<void>(resolve => setImmediate(resolve))

  expect(mockLocalDeleteWalletAccountLocalRpcPromise).toHaveBeenCalledWith(
    {accountID: 'acct-1', userAcknowledged: 'yes'},
    expect.any(String)
  )
  expect(mockLocalGetWalletAccountsLocalRpcPromise).toHaveBeenCalledTimes(1)
})
