/// <reference types="jest" />
import * as T from '../../constants/types'
import {useConfigState} from '../config'
import {makeEditID, useFSState} from '../fs'

beforeEach(() => {
  useConfigState.setState({loggedIn: false, userSwitching: false} as any)
  useFSState.getState().dispatch.resetState()
})

afterEach(() => {
  useConfigState.setState({loggedIn: false, userSwitching: false} as any)
  useFSState.getState().dispatch.resetState()
})

test('makeEditID returns distinct non-empty edit identifiers', () => {
  const first = makeEditID()
  const second = makeEditID()

  expect(first).toBeTruthy()
  expect(second).toBeTruthy()
  expect(first).not.toBe(second)
})

test('soft error setters add and remove path and tlf errors', () => {
  const {dispatch} = useFSState.getState()
  const path = T.FS.stringToPath('/keybase/private/alice/file.txt')
  const tlfPath = T.FS.stringToPath('/keybase/private/alice')

  dispatch.setPathSoftError(path, T.FS.SoftError.Nonexistent)
  dispatch.setTlfSoftError(tlfPath, T.FS.SoftError.NoAccess)
  expect(useFSState.getState().softErrors.pathErrors.get(path)).toBe(T.FS.SoftError.Nonexistent)
  expect(useFSState.getState().softErrors.tlfErrors.get(tlfPath)).toBe(T.FS.SoftError.NoAccess)

  dispatch.setPathSoftError(path)
  dispatch.setTlfSoftError(tlfPath)
  expect(useFSState.getState().softErrors.pathErrors.has(path)).toBe(false)
  expect(useFSState.getState().softErrors.tlfErrors.has(tlfPath)).toBe(false)
})
