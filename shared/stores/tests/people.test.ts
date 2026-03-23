/// <reference types="jest" />
import * as EngineGen from '@/constants/rpc'
import {resetAllStores} from '@/util/zustand'
import {usePeopleState} from '../people'

beforeEach(() => {
  resetAllStores()
})

afterEach(() => {
  resetAllStores()
})

test('setResentEmail stores the latest resent address', () => {
  usePeopleState.getState().dispatch.setResentEmail('alice@keybase.io')

  expect(usePeopleState.getState().resentEmail).toBe('alice@keybase.io')
})

test('resetState clears people screen data and resent email', () => {
  usePeopleState.setState({
    followSuggestions: [{username: 'alice'}],
    newItems: [{badged: true}],
    oldItems: [{badged: false}],
    resentEmail: 'alice@keybase.io',
  } as never)

  usePeopleState.getState().dispatch.resetState()

  const state = usePeopleState.getState()
  expect(state.followSuggestions).toEqual([])
  expect(state.newItems).toEqual([])
  expect(state.oldItems).toEqual([])
  expect(state.resentEmail).toBe('')
})

test('engine actions refresh people data and update verified email', () => {
  const loadPeople = jest.fn()
  usePeopleState.setState(s => ({
    ...s,
    dispatch: {
      ...s.dispatch,
      loadPeople: loadPeople as never,
    },
  }))

  usePeopleState.getState().dispatch.onEngineIncomingImpl({
    payload: {params: {}},
    type: EngineGen.actionTypes.keybase1HomeUIHomeUIRefresh,
  } as never)
  expect(loadPeople).toHaveBeenCalledWith(false)

  usePeopleState.getState().dispatch.onEngineIncomingImpl({
    payload: {params: {emailAddress: 'verified@keybase.io'}},
    type: EngineGen.actionTypes.keybase1NotifyEmailAddressEmailAddressVerified,
  } as never)
  expect(usePeopleState.getState().resentEmail).toBe('verified@keybase.io')
})
