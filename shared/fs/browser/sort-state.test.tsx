/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useCurrentUserState} from '@/stores/current-user'
import {FsBrowserSortProvider, useFsBrowserSort} from './sort-state'

const p = (s: string) => T.FS.stringToPath(s)
const tlfList = p('/keybase/private')
const tlf = p('/keybase/private/testuser')

const inTlf = p('/keybase/private/testuser/dir')

const setUsername = (username: string) => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username,
  })
}

const wrapper = ({children}: {children: React.ReactNode}) => (
  <FsBrowserSortProvider>{children}</FsBrowserSortProvider>
)

beforeEach(() => {
  setUsername('testuser')
})

afterEach(() => {
  cleanup()
  useCurrentUserState.getState().dispatch.resetState()
})

test('tlf lists default to time sorting, folders inside a tlf default to name sorting', () => {
  const {result} = renderHook(
    () => ({
      inTlf: useFsBrowserSort(inTlf).sortSetting,
      tlf: useFsBrowserSort(tlf).sortSetting,
      tlfList: useFsBrowserSort(tlfList).sortSetting,
    }),
    {wrapper}
  )
  expect(result.current.tlfList).toBe(T.FS.SortSetting.TimeAsc)
  // the tlf root itself is already at level 3, so it sorts by name
  expect(result.current.tlf).toBe(T.FS.SortSetting.NameAsc)
  expect(result.current.inTlf).toBe(T.FS.SortSetting.NameAsc)
})

test('without a provider the defaults still apply and setting is a no-op', () => {
  const {result} = renderHook(() => useFsBrowserSort(inTlf))
  expect(result.current.sortSetting).toBe(T.FS.SortSetting.NameAsc)
  act(() => {
    result.current.setSortSetting(inTlf, T.FS.SortSetting.TimeDesc)
  })
  expect(result.current.sortSetting).toBe(T.FS.SortSetting.NameAsc)
})

test('a sort setting is remembered per path and does not leak to siblings', () => {
  const {result} = renderHook(
    () => ({a: useFsBrowserSort(inTlf), b: useFsBrowserSort(tlfList)}),
    {wrapper}
  )
  act(() => {
    result.current.a.setSortSetting(inTlf, T.FS.SortSetting.NameDesc)
  })
  expect(result.current.a.sortSetting).toBe(T.FS.SortSetting.NameDesc)
  expect(result.current.b.sortSetting).toBe(T.FS.SortSetting.TimeAsc)

  act(() => {
    result.current.b.setSortSetting(tlfList, T.FS.SortSetting.TimeDesc)
  })
  expect(result.current.a.sortSetting).toBe(T.FS.SortSetting.NameDesc)
  expect(result.current.b.sortSetting).toBe(T.FS.SortSetting.TimeDesc)
})

test('switching user drops every remembered sort setting', () => {
  const {result} = renderHook(() => useFsBrowserSort(inTlf), {wrapper})
  act(() => {
    result.current.setSortSetting(inTlf, T.FS.SortSetting.NameDesc)
  })
  expect(result.current.sortSetting).toBe(T.FS.SortSetting.NameDesc)

  act(() => {
    setUsername('testuser-mac')
  })
  expect(result.current.sortSetting).toBe(T.FS.SortSetting.NameAsc)
})
