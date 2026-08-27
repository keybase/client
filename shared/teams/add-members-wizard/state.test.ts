/// <reference types="jest" />
import {expect, jest, test, describe, beforeEach} from '@jest/globals'
import * as T from '@/constants/types'
import {
  addMembersToWizard,
  makeAddMembersWizard,
  searchResultsToMembers,
  setWizardDefaultChannels,
  setWizardRole,
} from './state'

const teamID = 'tid1' as T.Teams.TeamID

// addMembersToWizard branches on isPhone, which is fixed per platform build, so
// drive it explicitly rather than inheriting whatever the test env happens to be
let mockIsPhone = false
jest.mock('@/constants/platform', () => ({
  ...jest.requireActual<object>('@/constants/platform'),
  get isPhone() {
    return mockIsPhone
  },
}))

let assertionsInTeam: Array<string> = []
let findCalls = 0
jest.spyOn(T.RPCGen, 'teamsFindAssertionsInTeamNoResolveRpcPromise').mockImplementation(async () => {
  findCalls++
  await Promise.resolve()
  return assertionsInTeam as never
})

beforeEach(() => {
  assertionsInTeam = []
  findCalls = 0
  mockIsPhone = false
})

const convKey = (s: string) => s as T.Chat.ConversationIDKey
const channel = (name: string): T.Teams.ChannelNameID => ({
  channelname: name,
  conversationIDKey: convKey(name),
})

describe('makeAddMembersWizard', () => {
  test('defaults to an empty writer wizard for the given team', () => {
    expect(makeAddMembersWizard(teamID)).toEqual({
      addToChannels: undefined,
      addingMembers: [],
      membersAlreadyInTeam: [],
      role: 'writer',
      teamID,
    })
  })

  test('the teamID cannot be clobbered by overrides', () => {
    const wizard = makeAddMembersWizard(teamID, {role: 'admin', teamID: 'other'} as never)
    expect(wizard.teamID).toBe(teamID)
    expect(wizard.role).toBe('admin')
  })
})

describe('addMembersToWizard', () => {
  test('only assertions and resolved contacts are checked against the team', async () => {
    const wizard = makeAddMembersWizard(teamID)
    await addMembersToWizard(wizard, [
      {assertion: 'testuser', role: 'writer'},
      {assertion: 'a@b.com', role: 'writer'},
      {assertion: 'testuser-mac', resolvedFrom: '+15551212', role: 'writer'},
    ])
    expect(findCalls).toBe(1)
    const arg = (T.RPCGen.teamsFindAssertionsInTeamNoResolveRpcPromise as never as jest.Mock).mock
      .calls[0]![0] as {assertions: Array<string>; teamID: string}
    // a plain keybase username needs no lookup
    expect(arg.assertions).toEqual(['a@b.com', 'testuser-mac'])
    expect(arg.teamID).toBe(teamID)
  })

  test('the new team wizard skips the rpc entirely - the team does not exist yet', async () => {
    const wizard = makeAddMembersWizard(T.Teams.newTeamWizardTeamID)
    const next = await addMembersToWizard(wizard, [{assertion: 'a@b.com', role: 'writer'}])
    expect(findCalls).toBe(0)
    expect(next.addingMembers.map(m => m.assertion)).toEqual(['a@b.com'])
    expect(next.membersAlreadyInTeam).toEqual([])
  })

  test('members already in the team are reported and not added', async () => {
    assertionsInTeam = ['a@b.com', 'testuser-mac']
    const wizard = makeAddMembersWizard(teamID)
    const next = await addMembersToWizard(wizard, [
      {assertion: 'a@b.com', role: 'writer'},
      {assertion: 'testuser-mac', resolvedFrom: '+15551212', role: 'writer'},
      {assertion: 'c@d.com', role: 'writer'},
    ])
    expect(next.addingMembers.map(m => m.assertion)).toEqual(['c@d.com'])
    // the already-in-team report uses the thing the user typed, not the resolution
    expect(next.membersAlreadyInTeam).toEqual(['a@b.com', '+15551212'])
  })

  test('adding is idempotent - an assertion already staged is not duplicated', async () => {
    let wizard = makeAddMembersWizard(teamID, {addingMembers: [{assertion: 'a@b.com', role: 'writer'}]})
    wizard = await addMembersToWizard(wizard, [
      {assertion: 'a@b.com', role: 'writer'},
      {assertion: 'c@d.com', role: 'writer'},
    ])
    expect(wizard.addingMembers.map(m => m.assertion)).toEqual(['c@d.com', 'a@b.com'])
  })

  test('new members land at the top of the list', async () => {
    let wizard = makeAddMembersWizard(teamID, {addingMembers: [{assertion: 'old', role: 'writer'}]})
    wizard = await addMembersToWizard(wizard, [
      {assertion: 'a@b.com', role: 'writer'},
      {assertion: 'c@d.com', role: 'writer'},
    ])
    expect(wizard.addingMembers.map(m => m.assertion)).toEqual(['c@d.com', 'a@b.com', 'old'])
  })

  test('a non-keybase assertion cannot be added as admin or owner', async () => {
    const wizard = makeAddMembersWizard(teamID)
    const next = await addMembersToWizard(wizard, [
      {assertion: 'a@b.com', role: 'admin'},
      {assertion: 'c@d.com', role: 'owner'},
      {assertion: 'testuser', role: 'admin'},
    ])
    const byAssertion = new Map(next.addingMembers.map(m => [m.assertion, m.role]))
    expect(byAssertion.get('a@b.com')).toBe('writer')
    expect(byAssertion.get('c@d.com')).toBe('writer')
    // a real keybase user keeps the requested role
    expect(byAssertion.get('testuser')).toBe('admin')
  })

  test('on desktop an admin-wide wizard flips to per-member roles once an email is added', async () => {
    const wizard = makeAddMembersWizard(teamID, {
      addingMembers: [{assertion: 'testuser-mac', role: 'admin'}],
      role: 'admin',
    })
    const next = await addMembersToWizard(wizard, [
      {assertion: 'testuser', role: 'admin'},
      {assertion: 'a@b.com', role: 'admin'},
    ])
    expect(next.role).toBe('setIndividually')
    // per-member roles are kept as-is, only the email itself is coerced
    expect(new Map(next.addingMembers.map(m => [m.assertion, m.role]))).toEqual(
      new Map([
        ['a@b.com', 'writer'],
        ['testuser', 'admin'],
        ['testuser-mac', 'admin'],
      ])
    )
  })

  test('on phone there is no per-member role screen, so everyone is downgraded to writer', async () => {
    mockIsPhone = true
    const wizard = makeAddMembersWizard(teamID, {
      addingMembers: [{assertion: 'testuser-mac', role: 'admin'}],
      role: 'admin',
    })
    const next = await addMembersToWizard(wizard, [
      {assertion: 'testuser', role: 'admin'},
      {assertion: 'a@b.com', role: 'admin'},
    ])
    expect(next.role).toBe('writer')
    expect(next.addingMembers.every(m => m.role === 'writer')).toBe(true)
  })

  test('a wizard already on writer leaves the staged roles alone', async () => {
    mockIsPhone = true
    const wizard = makeAddMembersWizard(teamID, {
      addingMembers: [{assertion: 'testuser-mac', role: 'admin'}],
    })
    const next = await addMembersToWizard(wizard, [{assertion: 'a@b.com', role: 'writer'}])
    expect(next.role).toBe('writer')
    expect(new Map(next.addingMembers.map(m => [m.assertion, m.role]))).toEqual(
      new Map([
        ['a@b.com', 'writer'],
        ['testuser-mac', 'admin'],
      ])
    )
  })

  test('the wizard role is untouched when every addition is a keybase user', async () => {
    const wizard = makeAddMembersWizard(teamID, {role: 'admin'})
    const next = await addMembersToWizard(wizard, [{assertion: 'testuser', role: 'admin'}])
    expect(next.role).toBe('admin')
  })

  test('an email that is already in the team does not force the role change', async () => {
    assertionsInTeam = ['a@b.com']
    const wizard = makeAddMembersWizard(teamID, {role: 'owner'})
    const next = await addMembersToWizard(wizard, [
      {assertion: 'testuser', role: 'owner'},
      {assertion: 'a@b.com', role: 'owner'},
    ])
    expect(next.role).toBe('owner')
  })
})

describe('setWizardRole', () => {
  test('setIndividually leaves each member on its own role', () => {
    const wizard = makeAddMembersWizard(teamID, {
      addingMembers: [
        {assertion: 'testuser', role: 'admin'},
        {assertion: 'testuser-mac', role: 'reader'},
      ],
      role: 'admin',
    })
    const next = setWizardRole(wizard, 'setIndividually')
    expect(next.role).toBe('setIndividually')
    expect(next.addingMembers.map(m => m.role)).toEqual(['admin', 'reader'])
  })
})

describe('setWizardDefaultChannels', () => {
  test('adds channels and ignores duplicates by conversation id', () => {
    let wizard: ReturnType<typeof makeAddMembersWizard> = makeAddMembersWizard(teamID)
    wizard = setWizardDefaultChannels(wizard, [channel('general'), channel('random')])
    wizard = setWizardDefaultChannels(wizard, [channel('random'), channel('design')])
    expect(wizard.addToChannels?.map(c => c.channelname)).toEqual(['general', 'random', 'design'])
  })

  test('removes a channel by conversation id', () => {
    let wizard: ReturnType<typeof makeAddMembersWizard> = makeAddMembersWizard(teamID)
    wizard = setWizardDefaultChannels(wizard, [channel('general'), channel('random')])
    wizard = setWizardDefaultChannels(wizard, undefined, channel('general'))
    expect(wizard.addToChannels?.map(c => c.channelname)).toEqual(['random'])
  })

  test('removing something that is not there is a no-op', () => {
    let wizard: ReturnType<typeof makeAddMembersWizard> = makeAddMembersWizard(teamID)
    wizard = setWizardDefaultChannels(wizard, [channel('general')])
    wizard = setWizardDefaultChannels(wizard, undefined, channel('nope'))
    expect(wizard.addToChannels?.map(c => c.channelname)).toEqual(['general'])
  })

  test('the first call turns undefined into a real list without mutating the input', () => {
    const wizard = makeAddMembersWizard(teamID)
    const next = setWizardDefaultChannels(wizard, [channel('general')])
    expect(wizard.addToChannels).toBeUndefined()
    expect(next.addToChannels).toEqual([channel('general')])
  })

  test('adding and removing in one call happens in that order', () => {
    const wizard = setWizardDefaultChannels(makeAddMembersWizard(teamID), [channel('general')], undefined)
    const next = setWizardDefaultChannels(wizard, [channel('random')], channel('general'))
    expect(next.addToChannels?.map(c => c.channelname)).toEqual(['random'])
  })
})

describe('searchResultsToMembers', () => {
  test('found users are staged under their username with the search term recorded', () => {
    expect(
      searchResultsToMembers([
        {assertion: '+15551212', foundUser: true, username: 'testuser'},
        {assertion: 'a@b.com', foundUser: false, username: ''},
      ])
    ).toEqual([
      {assertion: 'testuser', resolvedFrom: '+15551212', role: 'writer'},
      {assertion: 'a@b.com', role: 'writer'},
    ])
  })
})
