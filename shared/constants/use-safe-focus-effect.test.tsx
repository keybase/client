/** @jest-environment jsdom */
/// <reference types="jest" />
// useSafeFocusEffect on the real navigation tree: its effect runs once per focus.
import {act, render} from '@testing-library/react'
import {navigateAppend, navigateUp, useSafeFocusEffect} from '@/constants/router'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'

const calls: Array<string> = []
const effect = () => {
  calls.push('run')
  return () => {
    calls.push('cleanup')
  }
}
function Screen() {
  useSafeFocusEffect(effect)
  return null
}

beforeEach(() => {
  calls.length = 0
})

test('a screen mounted focused runs its effect once', async () => {
  const {wrapper: Nav} = navigationWrapper({route: 'gitRoot', tab: 'tabs.gitTab'})
  render(
    <Nav>
      <Screen />
    </Nav>
  )
  await flush()
  expect(calls).toEqual(['run'])
})

test('covering the screen cleans up, and coming back runs it again once', async () => {
  const {wrapper: Nav} = navigationWrapper({route: 'gitRoot', tab: 'tabs.gitTab'})
  render(
    <Nav>
      <Screen />
    </Nav>
  )
  await flush()
  act(() => {
    navigateAppend({name: 'profile', params: {username: 'testuser'}})
  })
  await flush()
  expect(calls).toEqual(['run', 'cleanup'])
  act(() => {
    navigateUp()
  })
  await flush()
  expect(calls).toEqual(['run', 'cleanup', 'run'])
})
