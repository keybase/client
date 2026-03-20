import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {usePWState} from '../settings-password'

const navigateUp = jest.fn()
const requestLogout = jest.fn()

jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {
    ...actual,
    navigateUp,
  }
})

jest.mock('@/stores/logout', () => ({
  useLogoutState: {
    getState: () => ({
      dispatch: {
        requestLogout,
      },
    }),
  },
}))

afterEach(() => {
  jest.restoreAllMocks()
  navigateUp.mockReset()
  requestLogout.mockReset()
  resetAllStores()
})

const flush = () => new Promise<void>(resolve => setImmediate(resolve))

test('setPassword and setPasswordConfirm update the staged values and clear errors', () => {
  usePWState.setState({
    ...usePWState.getState(),
    error: 'boom',
  })

  usePWState.getState().dispatch.setPassword('hunter2')
  usePWState.getState().dispatch.setPasswordConfirm('hunter2')

  expect(usePWState.getState().newPassword).toBe('hunter2')
  expect(usePWState.getState().newPasswordConfirm).toBe('hunter2')
  expect(usePWState.getState().error).toBe('')
})

test('submitNewPassword rejects mismatched passwords locally', async () => {
  const changePassword = jest.spyOn(T.RPCGen, 'accountPassphraseChangeRpcPromise')

  usePWState.getState().dispatch.setPassword('one')
  usePWState.getState().dispatch.setPasswordConfirm('two')
  usePWState.getState().dispatch.submitNewPassword()
  await flush()

  expect(usePWState.getState().error).toBe("Passwords don't match")
  expect(changePassword).not.toHaveBeenCalled()
  expect(navigateUp).not.toHaveBeenCalled()
})

test('submitNewPassword logs out and navigates away on success', async () => {
  jest.spyOn(T.RPCGen, 'accountPassphraseChangeRpcPromise').mockResolvedValue(undefined as any)

  usePWState.getState().dispatch.setPassword('hunter2')
  usePWState.getState().dispatch.setPasswordConfirm('hunter2')
  usePWState.getState().dispatch.submitNewPassword(true)
  await flush()

  expect(requestLogout).toHaveBeenCalled()
  expect(navigateUp).toHaveBeenCalled()
  expect(usePWState.getState().error).toBe('')
})
