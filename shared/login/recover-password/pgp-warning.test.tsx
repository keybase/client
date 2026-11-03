/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, screen} from '@testing-library/react'
import {CommonActions, StackActions} from '@react-navigation/core'
import {navigationRef} from '@/constants/navigator'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {installNavigation, makeRootState, stackKeyOf, type InstalledNavigation} from '@/test/navigation'
import {answerRecoverPasswordPgp, startRecoverPassword} from './flow'
import PgpWarning from './pgp-warning'

const warningName = 'recoverPasswordPgpWarning'

let nav: InstalledNavigation
let shownId: number | undefined

// The warning's screen mounts once the gate opens, so a test can act between the push and the mount.
let gateOpen = true
const gateListeners = new Set<() => void>()
const setGate = (open: boolean) => {
  gateOpen = open
  gateListeners.forEach(l => l())
}
const Gate = ({children}: {children: React.ReactNode}): React.ReactNode => {
  const open = React.useSyncExternalStore(
    l => {
      gateListeners.add(l)
      return () => gateListeners.delete(l)
    },
    () => gateOpen
  )
  return open ? children : null
}

beforeEach(() => {
  shownId = undefined
  gateOpen = true
  useConfigState.getState().dispatch.setLoggedIn(true)
  nav = installNavigation({
    rootState: makeRootState(),
    screen: r =>
      r.name === warningName ? (
        <Gate>
          <PgpWarning route={r as never} />
        </Gate>
      ) : null,
  })
})

afterEach(() => {
  cleanup()
  // A prompt left pending would keep its decline timer alive past the test.
  if (shownId !== undefined) answerRecoverPasswordPgp(shownId, false)
  jest.restoreAllMocks()
  resetAllStores()
})

const flush = async () => new Promise<void>(resolve => setTimeout(resolve, 0))

// Starts a run and has Go ask; the flow pushes the warning onto the real tree, where it mounts as its
// route. `before` runs between the push and the screen mounting, as a deferred mount would see it.
const setup = async (before?: (id: number) => void) => {
  let listener: Parameters<typeof T.RPCGen.loginRecoverPassphraseRpcListener>[0] | undefined
  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async l => {
    listener = l
    await new Promise<void>(() => {})
    return undefined as any
  })
  startRecoverPassword({username: 'testuser'})
  await flush()
  const response = {error: jest.fn(), result: jest.fn()}
  setGate(false)
  act(() => {
    listener?.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
      {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
      response as any
    )
  })
  const pushed = nav.pushes().find(p => p.name === warningName)
  const id = (pushed?.params as {id: number}).id
  shownId = id
  before?.(id)
  nav.clearActions()
  act(() => setGate(true))
  return {id, response}
}

const warningRoute = () => nav.getRootState()?.routes?.find(r => r.name === warningName)

// The actions that take a screen away, as the library and its views dispatch them.
const removals = {
  // native-stack's onDismissed: a native back or swipe
  DISMISS: () => ({...StackActions.dismiss(), source: warningRoute()?.key, target: stackKeyOf(warningName)}),
  GO_BACK: () => CommonActions.goBack(),
  POP: () => StackActions.pop(),
}

test('Continue answers true once and closes the warning', async () => {
  const {response} = await setup()

  fireEvent.click(screen.getByText('Continue'))

  expect(nav.types()[0]).toBe('GO_BACK')
  expect(warningRoute()).toBeUndefined()
  // Closing the warning is not a second answer.
  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(true)
})

test.each(Object.keys(removals) as Array<keyof typeof removals>)(
  'the user taking the warning away (%s) answers false once',
  async type => {
    const {response} = await setup()

    act(() => navigationRef.dispatch(removals[type]()))

    expect(warningRoute()).toBeUndefined()
    expect(screen.queryByText('Continue')).toBeNull()
    expect(response.result).toHaveBeenCalledTimes(1)
    expect(response.result).toHaveBeenCalledWith(false)
  }
)

test('an app-initiated reset removing the warning is not an answer', async () => {
  const {response} = await setup()

  const rs = nav.getRootState()!
  act(() => navigationRef.dispatch(CommonActions.reset({...rs, index: 0, routes: rs.routes!.slice(0, 1)} as never)))

  expect(warningRoute()).toBeUndefined()
  expect(response.result).not.toHaveBeenCalled()
})

test('a warning whose prompt was settled before it mounted closes itself without a second answer', async () => {
  const {response} = await setup(id => answerRecoverPasswordPgp(id, false))

  expect(nav.types()).toEqual(['GO_BACK'])
  expect(warningRoute()).toBeUndefined()
  expect(response.result).toHaveBeenCalledTimes(1)
  expect(response.result).toHaveBeenCalledWith(false)
})

test('a warning whose prompt was settled leaves the screen above it alone when covered', async () => {
  await setup(id => {
    answerRecoverPasswordPgp(id, false)
    act(() => navigationRef.dispatch(StackActions.push('proxySettingsModal')))
  })

  expect(nav.types()).toEqual([])
  expect(nav.getRootState()?.routes?.map(r => r.name)).toEqual(['loggedIn', warningName, 'proxySettingsModal'])
})

test('a warning for a still-pending prompt stays open on mount', async () => {
  await setup()

  expect(nav.types()).toEqual([])
  expect(screen.getByText('Continue')).toBeTruthy()
})
