/// <reference types="jest" />
import {noConversationIDKey} from '../../constants/types/chat/common'
import {useConfigState} from '../config'

const resetConfigState = () => {
  const {dispatch} = useConfigState.getState()
  useConfigState.setState({
    configuredAccounts: [],
    defaultUsername: '',
    globalError: undefined,
    outOfDate: {
      critical: false,
      message: '',
      outOfDate: false,
      updating: false,
    },
    remoteWindowNeedsProps: new Map(),
    startup: {
      conversation: noConversationIDKey,
      followUser: '',
      link: '',
      loaded: false,
    },
    userSwitching: false,
  } as any)
  dispatch.resetState()
}

beforeEach(() => {
  resetConfigState()
})

afterEach(() => {
  resetConfigState()
})

test('remoteWindowNeedsProps counts requests per component and params', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.remoteWindowNeedsProps('remote-profile', '{"username":"alice"}')
  dispatch.remoteWindowNeedsProps('remote-profile', '{"username":"alice"}')
  dispatch.remoteWindowNeedsProps('remote-profile', '{"username":"bob"}')

  const counts = useConfigState.getState().remoteWindowNeedsProps.get('remote-profile')
  expect(counts?.get('{"username":"alice"}')).toBe(2)
  expect(counts?.get('{"username":"bob"}')).toBe(1)
})

test('setStartupDetails only records the first startup payload', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setStartupDetails({
    conversation: 'first-convo' as any,
    followUser: 'alice',
    link: 'keybase://first',
  })
  dispatch.setStartupDetails({
    conversation: 'second-convo' as any,
    followUser: 'bob',
    link: 'keybase://second',
  })

  expect(useConfigState.getState().startup).toEqual({
    conversation: 'first-convo',
    followUser: 'alice',
    link: 'keybase://first',
    loaded: true,
  })
})

test('setOutOfDate merges fields and setGlobalError normalizes unknown input', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setOutOfDate({critical: true, message: 'upgrade required', outOfDate: true, updating: false})
  dispatch.setUpdating()
  dispatch.setGlobalError('boom')

  const state = useConfigState.getState()
  expect(state.outOfDate).toEqual({
    critical: true,
    message: 'upgrade required',
    outOfDate: true,
    updating: true,
  })
  expect(state.globalError?.message).toBe('Unknown error: "boom"')
})

test('onEngineIncoming owns audit errors and badge state', () => {
  const {dispatch} = useConfigState.getState()
  const badgeState = {inboxVers: 7} as any

  dispatch.onEngineIncoming({
    payload: {params: {badgeState}},
    type: 'keybase.1.NotifyBadges.badgeState',
  } as any)
  expect(useConfigState.getState().badgeState).toEqual(badgeState)

  dispatch.onEngineIncoming({
    payload: {params: {message: 'root bad'}},
    type: 'keybase.1.NotifyAudit.rootAuditError',
  } as any)
  expect(useConfigState.getState().globalError?.message).toBe(
    'Keybase is buggy, please report this: root bad'
  )

  dispatch.onEngineIncoming({
    payload: {params: {message: 'box bad'}},
    type: 'keybase.1.NotifyAudit.boxAuditError',
  } as any)
  expect(useConfigState.getState().globalError?.message).toBe(
    'Keybase had a problem loading a team, please report this with `keybase log send`: box bad'
  )
})

test('custom resetState preserves the fields config intentionally carries across resets', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setAccounts([{hasStoredSecret: true, username: 'alice'}])
  dispatch.setDefaultUsername('alice')
  useConfigState.setState({
    globalError: new Error('transient'),
    userSwitching: true,
  } as any)

  dispatch.resetState()

  const state = useConfigState.getState()
  expect(state.configuredAccounts).toEqual([{hasStoredSecret: true, username: 'alice'}])
  expect(state.defaultUsername).toBe('alice')
  expect(state.userSwitching).toBe(true)
  expect(state.globalError).toBeUndefined()
})
