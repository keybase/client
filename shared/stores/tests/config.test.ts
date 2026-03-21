/// <reference types="jest" />
import {defaultUseNativeFrame} from '../../constants/platform'
import {noConversationIDKey} from '../../constants/types/chat/common'
import {useConfigState} from '../config'

const resetConfigState = () => {
  const {dispatch} = useConfigState.getState()
  useConfigState.setState({
    appFocused: true,
    configuredAccounts: [],
    defaultUsername: '',
    forceSmallNav: false,
    globalError: undefined,
    mobileAppState: 'unknown',
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
    useNativeFrame: defaultUseNativeFrame,
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
    tab: undefined,
  })
  dispatch.setStartupDetails({
    conversation: 'second-convo' as any,
    followUser: 'bob',
    link: 'keybase://second',
    tab: undefined,
  })

  expect(useConfigState.getState().startup).toEqual({
    conversation: 'first-convo',
    followUser: 'alice',
    link: 'keybase://first',
    loaded: true,
    tab: undefined,
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

test('custom resetState preserves the fields config intentionally carries across resets', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setAccounts([{hasStoredSecret: true, username: 'alice'}])
  dispatch.setDefaultUsername('alice')
  useConfigState.setState({
    forceSmallNav: true,
    globalError: new Error('transient'),
    mobileAppState: 'active',
    userSwitching: true,
  } as any)

  dispatch.resetState()

  const state = useConfigState.getState()
  expect(state.configuredAccounts).toEqual([{hasStoredSecret: true, username: 'alice'}])
  expect(state.defaultUsername).toBe('alice')
  expect(state.forceSmallNav).toBe(true)
  expect(state.mobileAppState).toBe('active')
  expect(state.userSwitching).toBe(true)
  expect(state.globalError).toBeUndefined()
})
