/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  cloneDetails,
  identifyResultToDetailsState,
  makeDetails,
  noAssertion,
  rpcAssertionToAssertion,
  updateTrackerDetailsBlocked,
  updateTrackerDetailsReset,
  updateTrackerDetailsResult,
  updateTrackerDetailsRow,
  updateTrackerDetailsSummary,
  updateTrackerDetailsUserCard,
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

// the reset warning has to survive the 'valid' result that follows it: the reset
// is reported during the identify whose proofs then come back fine
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

test('identifyResultToDetailsState maps every rpc result, treating canceled as an error', () => {
  expect(identifyResultToDetailsState(T.RPCGen.Identify3ResultType.ok)).toBe('valid')
  expect(identifyResultToDetailsState(T.RPCGen.Identify3ResultType.broken)).toBe('broken')
  expect(identifyResultToDetailsState(T.RPCGen.Identify3ResultType.needsUpgrade)).toBe('needsUpgrade')
  expect(identifyResultToDetailsState(T.RPCGen.Identify3ResultType.canceled)).toBe('error')
})

test('rpcAssertionToAssertion keys on type:value and normalizes the nullable icon lists', () => {
  const assertion = rpcAssertionToAssertion(
    makeIdentifyRow({
      kid: undefined,
      metas: [{color: T.RPCGen.Identify3RowColor.orange, label: 'PENDING'}],
      siteIcon: undefined,
      siteIconDarkmode: undefined,
      siteIconFull: undefined,
      siteIconFullDarkmode: undefined,
      state: T.RPCGen.Identify3RowState.revoked,
    })
  )

  expect(assertion).toEqual(
    expect.objectContaining({
      assertionKey: 'twitter:alice',
      color: 'green',
      kid: '',
      metas: [{color: 'orange', label: 'PENDING'}],
      siteIcon: [],
      siteIconDarkmode: [],
      siteIconFull: [],
      siteIconFullDarkmode: [],
      state: 'revoked',
      timestamp: 123,
      type: 'twitter',
      value: 'alice',
    })
  )
})

test('updateTrackerDetailsRow replaces an assertion when the same proof updates', () => {
  const first = updateTrackerDetailsRow(
    makeDetails('alice'),
    makeIdentifyRow({state: T.RPCGen.Identify3RowState.checking})
  )
  const second = updateTrackerDetailsRow(
    first,
    makeIdentifyRow({state: T.RPCGen.Identify3RowState.valid})
  )

  expect(first.assertions?.get('twitter:alice')?.state).toBe('checking')
  expect(second.assertions?.size).toBe(1)
  expect(second.assertions?.get('twitter:alice')?.state).toBe('valid')
})

test('updateTrackerDetailsUserCard copies the card fields and flattens team showcase', () => {
  const next = updateTrackerDetailsUserCard(makeDetails('alice'), {
    bio: 'hi there',
    blocked: true,
    fullName: 'Alice A',
    hidFromFollowers: true,
    location: 'Anywhere',
    stellarHidden: true,
    teamShowcase: [
      {description: 'a team', fqName: 'keybase.friends', numMembers: 3, open: true, publicAdmins: ['bob']},
      {description: '', fqName: 'other', numMembers: 1, open: false, publicAdmins: undefined},
    ],
    unverifiedNumFollowers: 7,
    unverifiedNumFollowing: 9,
  } as never)

  expect(next).toEqual(
    expect.objectContaining({
      bio: 'hi there',
      blocked: true,
      followersCount: 7,
      followingCount: 9,
      fullname: 'Alice A',
      hidFromFollowers: true,
      location: 'Anywhere',
      stellarHidden: true,
    })
  )
  expect(next.teamShowcase).toEqual([
    {description: 'a team', isOpen: true, membersCount: 3, name: 'keybase.friends', publicAdmins: ['bob']},
    {description: '', isOpen: false, membersCount: 1, name: 'other', publicAdmins: []},
  ])
})

test('updateTrackerDetailsSummary records how many proofs to expect', () => {
  const prev = makeDetails('alice')
  const next = updateTrackerDetailsSummary(prev, {guiID: 'gui-id', numProofsToCheck: 4})

  expect(next.numAssertionsExpected).toBe(4)
  expect(prev.numAssertionsExpected).toBeUndefined()
})

test('updateTrackerDetailsBlocked ignores a summary about somebody else', () => {
  const prev = makeDetails('alice')
  const next = updateTrackerDetailsBlocked(prev, {
    blocker: 'bob',
    blocks: {carol: [makeBlockState(T.RPCGen.UserBlockType.chat, true)]},
  })

  expect(next).toBe(prev)
})

test('cloneDetails copies the collections so later mutation cannot leak backwards', () => {
  const followers = new Set(['bob'])
  const following = new Set(['carol'])
  const assertions = new Map([['twitter:alice', {...noAssertion, assertionKey: 'twitter:alice'}]])
  const teamShowcase = [{description: '', isOpen: false, membersCount: 1, name: 'team', publicAdmins: []}]
  const prev: T.Tracker.Details = {
    ...makeDetails('alice'),
    assertions,
    followers,
    following,
    teamShowcase,
  }

  const next = cloneDetails(prev)
  ;(next.followers as Set<string>).add('dave')
  ;(next.following as Set<string>).delete('carol')
  ;(next.assertions as Map<string, unknown>).clear()
  ;(next.teamShowcase as Array<unknown>).pop()

  expect(prev.followers).toEqual(new Set(['bob']))
  expect(prev.following).toEqual(new Set(['carol']))
  expect(prev.assertions?.size).toBe(1)
  expect(prev.teamShowcase).toHaveLength(1)
})
