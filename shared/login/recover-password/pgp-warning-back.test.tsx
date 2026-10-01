/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {fireEvent, render} from '@testing-library/react'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {newRoutes} from '../routes'
import {startRecoverPassword} from './flow'

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({canGoBack: () => true, goBack: jest.fn()}),
}))

const openModal = 'recoverPasswordPromptResetPassword'
let nav: FakeNavigator

beforeEach(() => {
  nav = installFakeNavigator({
    modalRouteNames: [openModal],
    rootState: makeRootState({above: [{name: openModal}]}),
  })
})

afterEach(() => {
  restoreNavigator()
  jest.restoreAllMocks()
  resetAllStores()
})

test('the pgp warning header back affordance answers the prompt false and leaves the flow', async () => {
  let listener: Parameters<typeof T.RPCGen.loginRecoverPassphraseRpcListener>[0] | undefined
  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async l => {
    listener = l
    await new Promise<void>(() => {})
    return undefined as any
  })
  startRecoverPassword({username: 'testuser'})
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  const response = {error: jest.fn(), result: jest.fn()}
  listener?.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
    {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
    response as any
  )
  nav.setRootState(makeRootState({above: [{name: openModal}]}))

  const headerLeft = (newRoutes.recoverPasswordPgpWarning.getOptions as any).headerLeft
  const {container} = render(headerLeft())
  fireEvent.click((container as unknown as {querySelector: (s: string) => never}).querySelector(".icon"))

  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(false)
  expect(nav.modalsCleared()).toBe(true)
})
