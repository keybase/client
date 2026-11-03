/** @jest-environment jsdom */
/// <reference types="jest" />
import {setImmediate} from 'node:timers'
import {act, cleanup, fireEvent, screen} from '@testing-library/react'
import {CommonActions, StackActions} from '@react-navigation/core'
import * as T from '@/constants/types'
import {navigationRef} from '@/constants/navigator'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {installNavigation, makeRootState, stackKeyOf, type InstalledNavigation} from '@/test/navigation'
import {enterResetPipeline} from './account-reset'
import ConfirmReset from './confirm'

const pipeline = 'keybase.1.account.enterResetPipeline'
const promptReset = 'keybase.1.loginUi.promptResetAccount'

let nav: InstalledNavigation
let fake: FakeEngine

const flush = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise<void>(resolve => setImmediate(resolve))
      await new Promise<void>(resolve => setTimeout(resolve, 0))
    })
  }
}

const confirmRoute = () => nav.getRootState()?.routes?.[0]?.state?.routes.find(r => r.name === 'resetConfirm')

// The service asks for the final confirmation; the flow puts the confirm screen up as a real route
// of the logged-out stack, holding the key the service's prompt is answered through.
const showConfirm = async () => {
  fake = installFakeEngine()
  const held = fake.hold(pipeline)
  nav = installNavigation({
    rootState: makeRootState({above: [{name: 'resetEnterPassword'}], loggedIn: false}),
    screen: r =>
      r.name === 'resetConfirm' ? (
        <ConfirmReset route={r as unknown as {params: {hasWallet: boolean; resetKey: string}}} />
      ) : null,
  })
  enterResetPipeline({username: 'testuser'})
  await flush()
  let answer: {result?: unknown; error?: unknown} | undefined
  void fake
    .push(promptReset, {prompt: {complete: {hasWallet: false}, t: T.RPCGen.ResetPromptType.complete}}, {
      sessionID: held[0]!.params.sessionID as number,
    })
    .then(a => {
      answer = a
    })
  await flush()
  expect(screen.getByText('Yes, reset account')).toBeTruthy()
  return {answer: () => answer, held}
}

// The prompt's 'nothing' answer sends the flow back up to login (navUpToScreen) from inside the
// screen's beforeRemove, so that pop removes the screen first and the removal that set it off is
// left with nothing to do: React Navigation reports it as unhandled (a dev-only console.error).
const removedByTheFlow = (type: string, remove: () => void) => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    act(remove)
    expect(errors).toHaveBeenCalledTimes(1)
    expect(String(errors.mock.calls[0]?.[0])).toMatch(new RegExp(`^The action '${type}'.* was not handled by any navigator`))
  } finally {
    errors.mockRestore()
  }
}

const checkAll = () => {
  fireEvent.click(screen.getByText('You will lose your personal chats, files and git data.'))
  fireEvent.click(screen.getByText(/You will be removed from teams/))
  fireEvent.click(screen.getByText("Cryptographically, you'll be a whole new person."))
}

describe('ConfirmReset', () => {
  afterEach(() => {
    cleanup()
    resetAllStores()
  })

  test('does not answer the prompt when it unmounts without being removed', async () => {
    const {answer, held} = await showConfirm()

    nav.unmount()
    await flush()

    expect(answer()).toBeUndefined()
    held[0]!.reply(null)
  })

  test.each([
    ['GO_BACK', () => CommonActions.goBack()],
    ['POP', () => StackActions.pop()],
  ] as const)('the screen being taken away (%s) answers the prompt with nothing', async (_type, action) => {
    const {answer, held} = await showConfirm()

    removedByTheFlow(_type, () => navigationRef.dispatch(action()))
    await flush()

    expect(confirmRoute()).toBeUndefined()
    expect(nav.visibleScreen()?.name).toBe('login')
    expect(answer()).toEqual({result: T.RPCGen.ResetPromptResponse.nothing})
    held[0]!.reply(null)
  })

  test('a native dismissal answers the prompt with nothing', async () => {
    const {answer, held} = await showConfirm()

    removedByTheFlow('DISMISS', () =>
      navigationRef.dispatch({
        ...StackActions.dismiss(),
        source: confirmRoute()?.key,
        target: stackKeyOf('resetConfirm'),
      })
    )
    await flush()

    expect(confirmRoute()).toBeUndefined()
    expect(answer()).toEqual({result: T.RPCGen.ResetPromptResponse.nothing})
    held[0]!.reply(null)
  })

  test('the reset button does nothing until every box is checked', async () => {
    const {answer, held} = await showConfirm()

    fireEvent.click(screen.getByText('Yes, reset account'))
    await flush()

    expect(answer()).toBeUndefined()
    expect(confirmRoute()).toBeDefined()
    held[0]!.reply(null)
  })

  test('removing the screen after an answer does not answer again', async () => {
    const {answer, held} = await showConfirm()

    checkAll()
    fireEvent.click(screen.getByText('Yes, reset account'))
    await flush()
    // confirming moves on to provisioning, pushed above the confirm screen
    expect(answer()).toEqual({result: T.RPCGen.ResetPromptResponse.confirmReset})
    expect(nav.visibleScreen()?.name).toBe('username')
    act(() => navigationRef.dispatch(CommonActions.goBack()))
    await flush()
    expect(nav.visibleScreen()?.name).toBe('resetConfirm')
    act(() => navigationRef.dispatch(CommonActions.goBack()))
    await flush()

    expect(confirmRoute()).toBeUndefined()
    expect(nav.visibleScreen()?.name).toBe('login')
    expect(answer()).toEqual({result: T.RPCGen.ResetPromptResponse.confirmReset})
    held[0]!.reply(null)
  })
})
