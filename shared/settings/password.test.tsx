/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import {act, cleanup, fireEvent, render, renderHook, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import * as NavTree from '@/constants/nav-tree'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import {UpdatePassword, useSubmitNewPassword} from './password'

const changeRpc = 'keybase.1.account.passphraseChange'
const canLogoutRpc = 'keybase.1.user.canLogout'
const logoutRpc = 'keybase.1.login.logout'

const typePasswords = (password: string, confirm: string) => {
  fireEvent.change(screen.getByPlaceholderText('New password'), {target: {value: password}})
  fireEvent.change(screen.getByPlaceholderText('Confirm password'), {target: {value: confirm}})
}

const saveButton = () => screen.getByText('Save').parentElement!
const saveDisabled = () => (saveButton() as unknown as {className: string}).className.includes('button--disabled')

// The screen as the app shows it: a modal over the chat tab.
const renderScreen = (props: Partial<React.ComponentProps<typeof UpdatePassword>> = {}) => {
  const onSave = jest.fn()
  const {wrapper} = navigationWrapper({route: 'settingsTabs.password'})
  const r = render(<UpdatePassword error="" onSave={onSave} {...props} />, {wrapper})
  return {...r, onSave}
}

// The hook as the password screen runs it.
const renderSubmit = (thenLogout: boolean) => {
  const fake = installFakeEngine()
  const nav = navigationWrapper({route: 'settingsTabs.password'})
  const {result} = renderHook(() => useSubmitNewPassword(thenLogout), {wrapper: nav.wrapper})
  const passwordShown = () =>
    NavTree.visibleScreen(nav.getRootState(), {includeModals: true})?.name === 'settingsTabs.password'
  const save = async (password: string) => {
    act(() => {
      result.current.onSave(password)
    })
    await flush()
  }
  return {fake, nav, passwordShown, result, save}
}

const methods = (fake: FakeEngine) => fake.calls.map(c => c.method)

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('save stays disabled until both passwords match and are long enough', () => {
  const {onSave} = renderScreen()

  expect(saveDisabled()).toBe(true)

  typePasswords('short', 'short')
  expect(saveDisabled()).toBe(true)
  expect(screen.queryByText('Password must be at least 8 characters.')).not.toBeNull()

  typePasswords('longenough', 'longenough')
  expect(saveDisabled()).toBe(false)
  expect(screen.queryByText('Passwords match.')).not.toBeNull()

  fireEvent.click(saveButton())
  expect(onSave).toHaveBeenCalledWith('longenough')
})

test('mismatched passwords show an error and block saving', () => {
  const {onSave} = renderScreen()

  typePasswords('longenough', 'longenoughbutdifferent')
  expect(screen.queryByText('Passwords must match.')).not.toBeNull()
  expect(saveDisabled()).toBe(true)

  fireEvent.click(saveButton())
  expect(onSave).not.toHaveBeenCalled()
})

test('the PGP warning shows only when there is no other error', () => {
  const {rerender} = renderScreen({hasPGPKeyOnServer: true})
  expect(screen.queryByText(/delete your PGP key/)).not.toBeNull()

  rerender(<UpdatePassword error="boom" hasPGPKeyOnServer={true} onSave={jest.fn()} />)
  expect(screen.queryByText(/delete your PGP key/)).toBeNull()
  expect(screen.queryByText('boom')).not.toBeNull()
})

test('useSubmitNewPassword force-changes the password and navigates back once the service answers', async () => {
  const {fake, nav, passwordShown, result, save} = renderSubmit(false)
  const held = fake.hold(changeRpc)

  await save('longenough')

  expect(held[0]!.params).toEqual(
    expect.objectContaining({force: true, oldPassphrase: '', passphrase: 'longenough'})
  )
  expect(result.current.waitingForResponse).toBe(true)
  expect(passwordShown()).toBe(true)

  held[0]!.reply(null)
  await flush()
  expect(nav.types()).toContain('GO_BACK')
  expect(passwordShown()).toBe(false)
  expect(result.current.error).toBe('')
  expect(result.current.waitingForResponse).toBe(false)
})

test('useSubmitNewPassword logs the user out after a successful change when asked to', async () => {
  const {fake, nav, passwordShown, save} = renderSubmit(true)
  const held = fake.hold(changeRpc)
  fake.answer(canLogoutRpc, () => ({canLogout: true, reason: ''}))
  fake.answer(logoutRpc, () => null)

  await save('longenough')
  expect(methods(fake)).toEqual([changeRpc])

  held[0]!.reply(null)
  await flush()

  // requestLogout() asks the service whether logging out is safe, then logs out
  expect(methods(fake)).toEqual([changeRpc, canLogoutRpc, logoutRpc])
  expect(nav.types()).toContain('GO_BACK')
  expect(passwordShown()).toBe(false)
})

test('useSubmitNewPassword leaves the session alone when it is not asked to log out', async () => {
  const {fake, nav, passwordShown, save} = renderSubmit(false)
  fake.answer(changeRpc, () => null)

  await save('longenough')

  expect(methods(fake)).toEqual([changeRpc])
  expect(nav.types()).toContain('GO_BACK')
  expect(passwordShown()).toBe(false)
})

test('useSubmitNewPassword does not log out when the change fails', async () => {
  const {fake, nav, passwordShown, result, save} = renderSubmit(true)
  fake.answer(changeRpc, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'too weak'))

  await save('longenough')

  expect(methods(fake)).toEqual([changeRpc])
  expect(nav.types()).not.toContain('GO_BACK')
  expect(passwordShown()).toBe(true)
  expect(result.current.error).toBe('too weak')
})

test('useSubmitNewPassword shows the service description on failure and clears it on retry', async () => {
  const {fake, nav, passwordShown, result, save} = renderSubmit(false)
  const held = fake.hold(changeRpc)

  await save('longenough')
  held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'too weak'))
  await flush()
  expect(result.current.error).toBe('too weak')
  expect(nav.types()).not.toContain('GO_BACK')
  expect(passwordShown()).toBe(true)

  await save('longenough2')
  expect(result.current.error).toBe('')
  held[1]!.reply(null)
  await flush()
})
