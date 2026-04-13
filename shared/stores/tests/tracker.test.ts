/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {noDetails, useTrackerState} from '../tracker'

beforeEach(() => {
  resetAllStores()
})

afterEach(() => {
  resetAllStores()
})

test('replace swaps the tracker details map wholesale', () => {
  const details: Map<string, T.Tracker.Details> = new Map([
    ['alice', {...noDetails, guiID: 'gui-alice', state: 'checking' as const, username: 'alice'}],
    ['bob', {...noDetails, guiID: 'gui-bob', state: 'valid' as const, username: 'bob'}],
  ])

  useTrackerState.getState().dispatch.replace(details)

  expect(useTrackerState.getState().usernameToDetails).toBe(details)
})

test('closeTracker removes the shown tracker entry by guiID and updateResult changes status', () => {
  useTrackerState.setState({
    showTrackerSet: new Set(['alice']),
    usernameToDetails: new Map([['alice', {...noDetails, guiID: 'gui-alice', username: 'alice'}]]),
  } as never)

  useTrackerState.getState().dispatch.updateResult('gui-alice', 'broken')
  let details = useTrackerState.getState().usernameToDetails.get('alice')
  expect(details?.state).toBe('broken')
  expect(details?.reason).toBe("Some of alice's proofs have changed since you last followed them.")

  useTrackerState.getState().dispatch.notifyReset('gui-alice')
  useTrackerState.getState().dispatch.updateResult('gui-alice', 'valid')
  details = useTrackerState.getState().usernameToDetails.get('alice')
  expect(details?.resetBrokeTrack).toBe(false)
  expect(details?.reason).toBe('alice reset their account since you last followed them.')

  useTrackerState.getState().dispatch.closeTracker('gui-alice')
  expect(useTrackerState.getState().showTrackerSet.has('alice')).toBe(false)
})

test('loadProfile delegates to load with a profile load', () => {
  const load = jest.fn()
  useTrackerState.setState(s => ({
    ...s,
    dispatch: {
      ...s.dispatch,
      load: load as never,
    },
  }))

  useTrackerState.getState().dispatch.loadProfile('alice')

  expect(load).toHaveBeenCalledWith(
    expect.objectContaining({
      assertion: 'alice',
      forceDisplay: false,
      ignoreCache: true,
      inTracker: false,
      reason: '',
    })
  )
})

test('showTracker delegates to load with a tracker load', () => {
  const load = jest.fn()
  useTrackerState.setState(s => ({
    ...s,
    dispatch: {
      ...s.dispatch,
      load: load as never,
    },
  }))

  useTrackerState.getState().dispatch.showTracker('alice')

  expect(load).toHaveBeenCalledWith(
    expect.objectContaining({
      assertion: 'alice',
      forceDisplay: true,
      ignoreCache: true,
      inTracker: true,
      reason: '',
    })
  )
})

test('notifySummary and notifyRow enrich an existing tracker entry', () => {
  useTrackerState.setState({
    usernameToDetails: new Map([['alice', {...noDetails, guiID: 'gui-alice', username: 'alice'}]]),
  } as never)

  useTrackerState.getState().dispatch.notifySummary({guiID: 'gui-alice', numProofsToCheck: 3} as never)
  useTrackerState.getState().dispatch.notifyRow({
    color: T.RPCGen.Identify3RowColor.green,
    ctime: 123,
    guiID: 'gui-alice',
    key: 'twitter',
    kid: '',
    metas: [],
    priority: 1,
    proofURL: 'https://twitter.com/alice',
    sigID: 'sig',
    siteIcon: [],
    siteIconDarkmode: [],
    siteIconFull: [],
    siteIconFullDarkmode: [],
    siteURL: 'https://twitter.com',
    state: T.RPCGen.Identify3RowState.valid,
    value: 'alice',
  } as never)

  const details = useTrackerState.getState().usernameToDetails.get('alice')
  expect(details?.numAssertionsExpected).toBe(3)
  expect(details?.assertions?.get('twitter:alice')).toEqual(
    expect.objectContaining({
      assertionKey: 'twitter:alice',
      proofURL: 'https://twitter.com/alice',
      state: 'valid',
      type: 'twitter',
      value: 'alice',
    })
  )
})
