/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  makeDetails,
  updateTrackerDetailsBlocked,
  updateTrackerDetailsReset,
  updateTrackerDetailsResult,
  updateTrackerDetailsRow,
} from './model'

const makeIdentifyRow = (
  overrides: Partial<T.RPCGen.Identify3Row> = {}
): T.RPCGen.Identify3Row => ({
  color: T.RPCGen.Identify3RowColor.green,
  ctime: 123,
  guiID: 'gui-id',
  key: 'twitter',
  kid: '',
  metas: [],
  priority: 1,
  proofURL: 'https://twitter.com/alice',
  sigID: 'sig-id',
  siteIcon: [],
  siteIconDarkmode: [],
  siteIconFull: [],
  siteIconFullDarkmode: [],
  siteURL: 'https://twitter.com',
  state: T.RPCGen.Identify3RowState.valid,
  value: 'alice',
  ...overrides,
})

const makeBlockState = (
  blockType: T.RPCGen.UserBlockType,
  blocked: boolean
): T.RPCGen.UserBlockState => ({
  blockType,
  blocked,
})

test('updateTrackerDetailsResult applies the default broken-track reason', () => {
  const next = updateTrackerDetailsResult(makeDetails('alice'), 'broken')

  expect(next.state).toBe('broken')
  expect(next.reason).toBe("Some of alice's proofs have changed since you last followed them.")
  expect(next.resetBrokeTrack).toBe(false)
})

test('updateTrackerDetailsReset marks the reset and a later valid result clears only the flag', () => {
  const reset = updateTrackerDetailsReset(makeDetails('alice'))
  const next = updateTrackerDetailsResult(reset, 'valid')

  expect(reset.reason).toBe('alice reset their account since you last followed them.')
  expect(reset.resetBrokeTrack).toBe(true)
  expect(next.state).toBe('valid')
  expect(next.reason).toBe('alice reset their account since you last followed them.')
  expect(next.resetBrokeTrack).toBe(false)
})

test('updateTrackerDetailsResult preserves the reset reason while resetBrokeTrack is set', () => {
  const reset = updateTrackerDetailsReset(makeDetails('alice'))
  const next = updateTrackerDetailsResult(reset, 'broken', 'custom broken reason')

  expect(next.state).toBe('broken')
  expect(next.reason).toBe('alice reset their account since you last followed them.')
  expect(next.resetBrokeTrack).toBe(true)
})

test('updateTrackerDetailsRow stores the mapped assertion without mutating the previous map', () => {
  const prev = makeDetails('alice')
  const next = updateTrackerDetailsRow(prev, makeIdentifyRow())

  expect(prev.assertions?.size).toBe(0)
  expect(next.assertions?.get('twitter:alice')).toEqual(
    expect.objectContaining({
      assertionKey: 'twitter:alice',
      proofURL: 'https://twitter.com/alice',
      state: 'valid',
      type: 'twitter',
      value: 'alice',
    })
  )
})

test('updateTrackerDetailsBlocked updates chat and follow block flags for the tracked user', () => {
  const prev = makeDetails('alice')
  const next = updateTrackerDetailsBlocked(prev, {
    blocker: 'bob',
    blocks: {
      alice: [
        makeBlockState(T.RPCGen.UserBlockType.chat, true),
        makeBlockState(T.RPCGen.UserBlockType.follow, true),
      ],
    },
  })

  expect(next.blocked).toBe(true)
  expect(next.hidFromFollowers).toBe(true)
})

test('updateTrackerDetailsBlocked removes blocked followers and updates the count', () => {
  const prev = {
    ...makeDetails('alice'),
    followers: new Set(['bob', 'carol']),
    followersCount: 2,
  }
  const next = updateTrackerDetailsBlocked(prev, {
    blocker: 'alice',
    blocks: {
      bob: [makeBlockState(T.RPCGen.UserBlockType.follow, true)],
      carol: [makeBlockState(T.RPCGen.UserBlockType.chat, true)],
      dave: [makeBlockState(T.RPCGen.UserBlockType.follow, true)],
    },
  })

  expect(prev.followers).toEqual(new Set(['bob', 'carol']))
  expect(next.followers).toEqual(new Set(['carol']))
  expect(next.followersCount).toBe(1)
})
