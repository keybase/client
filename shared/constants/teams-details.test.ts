/// <reference types="jest" />
import * as T from './types'
import {annotatedTeamToDetails, emptyTeamDetails} from './teams'

const invite = (p: {
  category: T.RPCGen.TeamInviteCategory
  displayName: string
  ext?: T.RPCGen.AnnotatedTeamInviteExt
  id: string
  inviterUsername?: string
  isValid?: boolean
  role?: T.RPCGen.TeamRole
  validityDescription?: string
}) =>
  ({
    displayName: p.displayName,
    inviteExt: p.ext ?? {c: p.category},
    inviteMetadata: {invite: {id: p.id, role: p.role ?? T.RPCGen.TeamRole.writer, type: {c: p.category}}},
    inviterUsername: p.inviterUsername ?? 'testuser',
    isValid: p.isValid ?? true,
    validityDescription: p.validityDescription ?? '',
  }) as unknown as T.RPCGen.AnnotatedTeamInvite

const makeAnnotated = (over?: Partial<T.RPCGen.AnnotatedTeam>) =>
  ({
    invites: [],
    joinRequests: [],
    members: [],
    name: 'testteam',
    settings: {joinAs: T.RPCGen.TeamRole.reader, open: false},
    showcase: {anyMemberShowcase: false, description: '', isShowcased: false},
    tarsDisabled: false,
    transitiveSubteamsUnverified: {entries: []},
    ...over,
  }) as unknown as T.RPCGen.AnnotatedTeam

describe('annotatedTeamToDetails members', () => {
  test('maps members, downgrades role none to reader and drops a zero joinTime', () => {
    const details = annotatedTeamToDetails(
      makeAnnotated({
        members: [
          {
            fullName: 'Test User',
            joinTime: 0,
            needsPUK: false,
            role: T.RPCGen.TeamRole.owner,
            status: T.RPCGen.TeamMemberStatus.active,
            username: 'testuser',
          },
          {
            fullName: 'Mac',
            joinTime: 99,
            needsPUK: true,
            role: T.RPCGen.TeamRole.none,
            status: T.RPCGen.TeamMemberStatus.reset,
            username: 'testuser-mac',
          },
        ],
      } as unknown as Partial<T.RPCGen.AnnotatedTeam>)
    )

    expect(details.members.get('testuser')).toEqual({
      fullName: 'Test User',
      joinTime: undefined,
      needsPUK: false,
      status: 'active',
      type: 'owner',
      username: 'testuser',
    })
    // unlike rpcDetailsToMemberInfos, a `none` role here is kept as a reader
    expect(details.members.get('testuser-mac')?.type).toBe('reader')
    expect(details.members.get('testuser-mac')?.status).toBe('reset')
    expect(details.members.get('testuser-mac')?.joinTime).toBe(99)
  })

  test('an empty team produces the empty details shape', () => {
    const details = annotatedTeamToDetails(makeAnnotated())
    expect(details).toEqual(emptyTeamDetails)
  })
})

describe('annotatedTeamToDetails settings and subteams', () => {
  test('open settings and showcase flow through', () => {
    const details = annotatedTeamToDetails(
      makeAnnotated({
        settings: {joinAs: T.RPCGen.TeamRole.writer, open: true},
        showcase: {anyMemberShowcase: true, description: 'hello', isShowcased: true},
        tarsDisabled: true,
      } as unknown as Partial<T.RPCGen.AnnotatedTeam>)
    )
    expect(details.description).toBe('hello')
    expect(details.settings).toEqual({
      open: true,
      openJoinAs: 'writer',
      tarsDisabled: true,
      teamShowcased: true,
    })
  })

  test('a joinAs of none is normalized to reader', () => {
    const details = annotatedTeamToDetails(
      makeAnnotated({
        settings: {joinAs: T.RPCGen.TeamRole.none, open: true},
      } as unknown as Partial<T.RPCGen.AnnotatedTeam>)
    )
    expect(details.settings.openJoinAs).toBe('reader')
  })

  test('subteams and join requests become sets', () => {
    const details = annotatedTeamToDetails(
      makeAnnotated({
        joinRequests: ['testuser', 'testuser-mac'],
        transitiveSubteamsUnverified: {entries: [{teamID: 'sub1'}, {teamID: 'sub2'}]},
      } as unknown as Partial<T.RPCGen.AnnotatedTeam>)
    )
    expect([...details.subteams]).toEqual(['sub1', 'sub2'])
    expect(details.requests.size).toBe(2)
  })
})

describe('annotatedTeamToDetails invites', () => {
  test('routes the display name into email, phone or name by category', () => {
    const details = annotatedTeamToDetails(
      makeAnnotated({
        invites: [
          invite({category: T.RPCGen.TeamInviteCategory.email, displayName: 'a@b.com', id: 'i1'}),
          invite({category: T.RPCGen.TeamInviteCategory.phone, displayName: '+15551212', id: 'i2'}),
          invite({category: T.RPCGen.TeamInviteCategory.seitan, displayName: 'a token', id: 'i3'}),
          invite({category: T.RPCGen.TeamInviteCategory.sbs, displayName: 'testuser@twitter', id: 'i4'}),
        ],
      })
    )
    const byID = new Map([...details.invites].map(i => [i.id, i]))
    expect(byID.get('i1')).toEqual({email: 'a@b.com', id: 'i1', name: '', phone: '', role: 'writer', username: ''})
    expect(byID.get('i2')?.phone).toBe('+15551212')
    expect(byID.get('i3')?.name).toBe('a token')
    expect(byID.get('i4')?.username).toBe('testuser@twitter')
    expect(details.inviteLinks).toEqual([])
  })

  test('drops invalid non-link invites and any invite with role none', () => {
    const details = annotatedTeamToDetails(
      makeAnnotated({
        invites: [
          invite({category: T.RPCGen.TeamInviteCategory.email, displayName: 'gone@b.com', id: 'i1', isValid: false}),
          invite({
            category: T.RPCGen.TeamInviteCategory.email,
            displayName: 'noone@b.com',
            id: 'i2',
            role: T.RPCGen.TeamRole.none,
          }),
          invite({category: T.RPCGen.TeamInviteCategory.email, displayName: 'ok@b.com', id: 'i3'}),
        ],
      })
    )
    expect([...details.invites].map(i => i.id)).toEqual(['i3'])
  })

  test('invite links keep their use count, last joiner and validity', () => {
    const details = annotatedTeamToDetails(
      makeAnnotated({
        invites: [
          invite({
            category: T.RPCGen.TeamInviteCategory.invitelink,
            displayName: 'keybase.io/invite/abc',
            ext: {
              c: T.RPCGen.TeamInviteCategory.invitelink,
              invitelink: {
                annotatedUsedInvites: [{username: 'testuser'}, {username: 'testuser-mac'}],
              },
            } as unknown as T.RPCGen.AnnotatedTeamInviteExt,
            id: 'link1',
            inviterUsername: 'testuser',
            role: T.RPCGen.TeamRole.reader,
            validityDescription: 'expires in a day',
          }),
        ],
      })
    )
    expect(details.inviteLinks).toEqual([
      {
        creatorUsername: 'testuser',
        id: 'link1',
        isValid: true,
        lastJoinedUsername: 'testuser-mac',
        numUses: 2,
        role: 'reader',
        url: 'keybase.io/invite/abc',
        validityDescription: 'expires in a day',
      },
    ])
    expect(details.invites.size).toBe(0)
  })

  test('an expired invite link is still listed so it can be shown as invalid', () => {
    const details = annotatedTeamToDetails(
      makeAnnotated({
        invites: [
          invite({
            category: T.RPCGen.TeamInviteCategory.invitelink,
            displayName: 'keybase.io/invite/dead',
            ext: {
              c: T.RPCGen.TeamInviteCategory.invitelink,
              invitelink: {annotatedUsedInvites: null},
            } as unknown as T.RPCGen.AnnotatedTeamInviteExt,
            id: 'link2',
            isValid: false,
          }),
        ],
      })
    )
    expect(details.inviteLinks).toHaveLength(1)
    expect(details.inviteLinks[0]?.isValid).toBe(false)
    expect(details.inviteLinks[0]?.numUses).toBe(0)
    expect(details.inviteLinks[0]?.lastJoinedUsername).toBeUndefined()
  })
})
