import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '../current-user'
import {useProfileState} from '../profile'

beforeEach(() => {
  resetAllStores()
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  resetAllStores()
})

test('updateUsername normalizes http proofs to the bare hostname', () => {
  useProfileState.setState({platform: 'https'} as never)

  useProfileState.getState().dispatch.updateUsername('https://example.com:3000/path/to/proof')

  const state = useProfileState.getState()
  expect(state.username).toBe('example.com')
  expect(state.usernameValid).toBe(true)
})

test('updateUsername validates bitcoin addresses', () => {
  useProfileState.setState({platform: 'btc'} as never)

  useProfileState.getState().dispatch.updateUsername('not-a-btc-address')
  expect(useProfileState.getState().usernameValid).toBe(false)

  useProfileState.getState().dispatch.updateUsername('1BoatSLRHtKNngkdXEeobR76b53LETtpyT')
  expect(useProfileState.getState().usernameValid).toBe(true)
})

test('clearPlatformGeneric clears proof flow errors and resetState restores defaults', () => {
  useProfileState.setState({
    errorCode: 42,
    errorText: 'boom',
    platformGeneric: 'dns',
    platformGenericChecking: true,
    platformGenericParams: {buttonLabel: 'Add', logoBlack: [], logoFull: [], subtext: '', suffix: '', title: ''},
    platformGenericURL: 'https://keybase.io',
    proofFound: true,
    username: 'alice',
  } as never)

  useProfileState.getState().dispatch.clearPlatformGeneric()

  let state = useProfileState.getState()
  expect(state.errorCode).toBeUndefined()
  expect(state.errorText).toBe('')
  expect(state.platformGeneric).toBeUndefined()
  expect(state.platformGenericChecking).toBe(false)
  expect(state.platformGenericParams).toBeUndefined()
  expect(state.platformGenericURL).toBeUndefined()
  expect(state.username).toBe('')

  useProfileState.setState({revokeError: 'still here', username: 'bob'} as never)
  useProfileState.getState().dispatch.resetState()

  state = useProfileState.getState()
  expect(state.revokeError).toBe('')
  expect(state.username).toBe('')
  expect(state.dispatch).toBeDefined()
})

test('updatePgpInfo stores fields and derives validation errors', () => {
  useProfileState.getState().dispatch.updatePgpInfo({
    pgpEmail1: 'bad-email',
    pgpEmail2: 'also-bad',
    pgpFullName: 'Alice',
  })

  let state = useProfileState.getState()
  expect(state.pgpEmail1).toBe('bad-email')
  expect(state.pgpEmail2).toBe('also-bad')
  expect(state.pgpErrorEmail1).toBe(true)
  expect(state.pgpErrorEmail2).toBe(true)

  useProfileState.getState().dispatch.updatePgpInfo({pgpEmail1: 'alice@keybase.io'})
  state = useProfileState.getState()
  expect(state.pgpEmail1).toBe('alice@keybase.io')
  expect(state.pgpErrorEmail1).toBe(false)
})
