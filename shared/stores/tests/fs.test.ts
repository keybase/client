/// <reference types="jest" />
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
