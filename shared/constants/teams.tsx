import * as T from './types'
import invert from 'lodash/invert'

export const makeRetentionPolicy = (
  r?: Partial<T.Retention.RetentionPolicy>
): T.Retention.RetentionPolicy => ({
  seconds: 0,
  title: '',
  type: 'retain',
  ...(r || {}),
})

export const serviceRetentionPolicyToRetentionPolicy = (
  policy?: T.RPCChat.RetentionPolicy | null
): T.Retention.RetentionPolicy => {
  // !policy implies a default policy of retainment
  let retentionPolicy: T.Retention.RetentionPolicy = makeRetentionPolicy({type: 'retain'})
  if (policy) {
    // replace retentionPolicy with whatever is explicitly set
    switch (policy.typ) {
      case T.RPCChat.RetentionPolicyType.retain:
        retentionPolicy = makeRetentionPolicy({title: 'Never auto-delete', type: 'retain'})
        break
      case T.RPCChat.RetentionPolicyType.expire: {
        const {expire} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: expire.age,
          title: baseRetentionPoliciesTitleMap[expire.age] || `${expire.age} seconds`,
          type: 'expire',
        })
        break
      }
      case T.RPCChat.RetentionPolicyType.ephemeral: {
        const {ephemeral} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: ephemeral.age,
          title: baseRetentionPoliciesTitleMap[ephemeral.age] || `${ephemeral.age} seconds`,
          type: 'explode',
        })
        break
      }
      case T.RPCChat.RetentionPolicyType.inherit:
        retentionPolicy = makeRetentionPolicy({type: 'inherit'})
        break
      default:
    }
  }
  return retentionPolicy
}

const dayInS = 3600 * 24
const policyInherit = makeRetentionPolicy({title: '', type: 'inherit'})
const policyRetain = makeRetentionPolicy({title: 'Never auto-delete', type: 'retain'})
const policyThirtySeconds = makeRetentionPolicy({seconds: 30, title: '30 seconds', type: 'explode'})
const policyFiveMinutes = makeRetentionPolicy({seconds: 5 * 60, title: '5 minutes', type: 'explode'})
const policyOneHour = makeRetentionPolicy({seconds: 3600, title: '60 minutes', type: 'explode'})
const policySixHours = makeRetentionPolicy({seconds: 3600 * 6, title: '6 hours', type: 'explode'})
const policyOneDay = makeRetentionPolicy({seconds: dayInS, title: '24 hours', type: 'explode'})
const policyThreeDays = makeRetentionPolicy({seconds: 3 * dayInS, title: '3 days', type: 'explode'})
const policySevenDays = makeRetentionPolicy({seconds: 7 * dayInS, title: '7 days', type: 'explode'})
const policyMonth = makeRetentionPolicy({seconds: 30 * dayInS, title: '30 days', type: 'expire'})
const policyThreeMonths = makeRetentionPolicy({seconds: 90 * dayInS, title: '90 days', type: 'expire'})
const policySixMonths = makeRetentionPolicy({seconds: 180 * dayInS, title: '180 days', type: 'expire'})
const policyYear = makeRetentionPolicy({seconds: 365 * dayInS, title: '365 days', type: 'expire'})
export const baseRetentionPolicies = [
  policyRetain,
  policyYear,
  policySixMonths,
  policyThreeMonths,
  policyMonth,
  policySevenDays,
  policyThreeDays,
  policyOneDay,
  policySixHours,
  policyOneHour,
  policyFiveMinutes,
  policyThirtySeconds,
]

export const retentionPolicies = {
  policyFiveMinutes,
  policyInherit,
  policyMonth,
  policyOneDay,
  policyOneHour,
  policyRetain,
  policySevenDays,
  policySixHours,
  policySixMonths,
  policyThirtySeconds,
  policyThreeDays,
  policyThreeMonths,
  policyYear,
}

const baseRetentionPoliciesTitleMap = baseRetentionPolicies.reduce<{[key: number]: string}>((map, p) => {
  map[p.seconds] = p.title
  return map
}, {})

export const teamRoleByEnum = invert(T.RPCGen.TeamRole) as unknown as {
  [K in keyof typeof T.RPCGen.TeamRole as (typeof T.RPCGen.TeamRole)[K]]: K
}

export const teamRoleTypes = ['reader', 'writer', 'admin', 'owner'] as const

export const rpcMemberStatusToStatus = invert(T.RPCGen.TeamMemberStatus) as unknown as {
  [K in keyof typeof T.RPCGen.TeamMemberStatus as (typeof T.RPCGen.TeamMemberStatus)[K]]: K
}

export const initialMemberInfo = Object.freeze<T.Teams.MemberInfo>({
  fullName: '',
  needsPUK: false,
  status: 'active',
  type: 'reader',
  username: '',
})

export const rpcDetailsToMemberInfos = (
  members: ReadonlyArray<T.RPCGen.TeamMemberDetails>
): Map<string, T.Teams.MemberInfo> => {
  const infos: Array<[string, T.Teams.MemberInfo]> = []
  members.forEach(({fullName, joinTime, needsPUK, status, username, role}) => {
    const maybeRole = teamRoleByEnum[role]
    if (maybeRole === 'none') {
      return
    }
    infos.push([
      username,
      {
        fullName,
        joinTime: joinTime || undefined,
        needsPUK,
        status: rpcMemberStatusToStatus[status],
        type: maybeRole,
        username,
      },
    ])
  })
  return new Map(infos)
}

export const emptyInviteInfo = Object.freeze<T.Teams.InviteInfo>({
  email: '',
  id: '',
  name: '',
  phone: '',
  role: 'writer',
  username: '',
})

/* eslint-disable sort-keys */
const teamRoleToCompare = {
  owner: 6,
  admin: 5,
  writer: 4,
  reader: 3,
  bot: 2,
  restrictedbot: 1,
  none: 0,
}
/* eslint-enable sort-keys */
export const compareTeamRoles = (a: T.Teams.MaybeTeamRoleType, b: T.Teams.MaybeTeamRoleType) => {
  return teamRoleToCompare[b] - teamRoleToCompare[a]
}

/* eslint-disable sort-keys */
const activityLevelToCompare = {
  active: 2,
  recently: 1,
  none: 0,
}
/* eslint-enable sort-keys */
export const compareActivityLevels = (
  a: T.Teams.ActivityLevel | undefined,
  b: T.Teams.ActivityLevel | undefined
) => {
  return activityLevelToCompare[b || 'none'] - activityLevelToCompare[a || 'none']
}

export const typeToLabel = {
  admin: 'Admin',
  bot: 'Bot',
  owner: 'Owner',
  reader: 'Reader',
  restrictedbot: 'Restricted bot',
  writer: 'Writer',
} satisfies T.Teams.TypeMap

export const initialCanUserPerform = Object.freeze<T.Teams.TeamOperations>({
  changeOpenTeam: false,
  changeTarsDisabled: false,
  chat: false,
  createChannel: false,
  deleteChannel: false,
  deleteChatHistory: false,
  deleteOtherEmojis: false,
  deleteOtherMessages: false,
  deleteTeam: false,
  editChannelDescription: false,
  editTeamDescription: false,
  joinTeam: false,
  listFirst: false,
  manageBots: false,
  manageEmojis: false,
  manageMembers: false,
  manageSubteams: false,
  pinMessage: false,
  renameChannel: false,
  renameTeam: false,
  setMinWriterRole: false,
  setPublicityAny: false,
  setRetentionPolicy: false,
  setTeamShowcase: false,
})

export const isBot = (type: T.Teams.TeamRoleType) => type === 'bot' || type === 'restrictedbot'
export const userInTeamNotBotWithInfo = (
  memberInfo: ReadonlyMap<string, T.Teams.MemberInfo>,
  username: string
): boolean => {
  const memb = memberInfo.get(username)
  if (!memb) {
    return false
  }
  return !isBot(memb.type)
}

export const initialPublicitySettings = Object.freeze<T.Teams._PublicitySettings>({
  anyMemberShowcase: false,
  description: '',
  ignoreAccessRequests: false,
  member: false,
  team: false,
})

export function sortTeamnames(a: string, b: string) {
  const aName = a.toUpperCase()
  const bName = b.toUpperCase()
  if (aName < bName) {
    return -1
  } else if (aName > bName) {
    return 1
  } else {
    return 0
  }
}

export const isAdmin = (type: T.Teams.MaybeTeamRoleType) => type === 'admin'
export const isOwner = (type: T.Teams.MaybeTeamRoleType) => type === 'owner'

export const isSubteam = (maybeTeamname: string) => {
  const subteams = maybeTeamname.split('.')
  if (subteams.length <= 1) {
    return false
  }
  return true
}

export const publicAdminsLimit = 6

export const emptyTeamMeta = Object.freeze<T.Teams.TeamMeta>({
  allowPromote: false,
  id: T.Teams.noTeamID,
  isMember: false,
  isOpen: false,
  memberCount: -1,
  role: 'none',
  showcasing: false,
  teamname: '',
})

export const makeTeamMeta = (td: Partial<T.Teams.TeamMeta>): T.Teams.TeamMeta => ({...emptyTeamMeta, ...td})

export const teamListToMeta = (
  list: ReadonlyArray<T.RPCGen.AnnotatedMemberInfo>
): Map<T.Teams.TeamID, T.Teams.TeamMeta> => {
  return new Map(
    list.map(t => [
      t.teamID,
      {
        allowPromote: t.allowProfilePromote,
        id: t.teamID,
        isMember: t.role !== T.RPCGen.TeamRole.none,
        isOpen: t.isOpenTeam,
        memberCount: t.memberCount,
        role: teamRoleByEnum[t.role],
        showcasing: t.isMemberShowcased,
        teamname: t.fqName,
      },
    ])
  )
}

type InviteDetails = {inviteLinks: ReadonlyArray<T.Teams.InviteLink>; invites: Set<T.Teams.InviteInfo>}
type InviteDetailsMutable = {inviteLinks: Array<T.Teams.InviteLink>; invites: Set<T.Teams.InviteInfo>}
const annotatedInvitesToInviteDetails = (
  annotatedInvites: ReadonlyArray<T.RPCGen.AnnotatedTeamInvite> = []
): InviteDetails =>
  annotatedInvites.reduce<InviteDetailsMutable>(
    (invitesAndLinks, annotatedInvite) => {
      const inviteMD = annotatedInvite.inviteMetadata
      const teamInvite = inviteMD.invite

      const {invites, inviteLinks} = invitesAndLinks
      const role = teamRoleByEnum[teamInvite.role]
      if (role === 'none') {
        return invitesAndLinks
      }

      if (annotatedInvite.inviteExt.c === T.RPCGen.TeamInviteCategory.invitelink) {
        const ext = annotatedInvite.inviteExt.invitelink
        const annotatedUsedInvites = ext.annotatedUsedInvites ?? []
        const lastJoinedUsername = annotatedUsedInvites.at(-1)?.username
        inviteLinks.push({
          creatorUsername: annotatedInvite.inviterUsername,
          id: teamInvite.id,
          isValid: annotatedInvite.isValid,
          lastJoinedUsername,
          numUses: annotatedUsedInvites.length,
          role,
          url: annotatedInvite.displayName,
          validityDescription: annotatedInvite.validityDescription,
        })
      } else {
        if (!annotatedInvite.isValid) {
          return invitesAndLinks
        }

        let username = ''
        if (teamInvite.type.c === T.RPCGen.TeamInviteCategory.sbs) {
          username = annotatedInvite.displayName
        }
        invites.add({
          email: teamInvite.type.c === T.RPCGen.TeamInviteCategory.email ? annotatedInvite.displayName : '',
          id: teamInvite.id,
          name: [T.RPCGen.TeamInviteCategory.seitan].includes(teamInvite.type.c)
            ? annotatedInvite.displayName
            : '',
          phone: teamInvite.type.c === T.RPCGen.TeamInviteCategory.phone ? annotatedInvite.displayName : '',
          role,
          username,
        })
      }
      return invitesAndLinks
    },
    {inviteLinks: [], invites: new Set()}
  )

export const emptyTeamDetails: T.Teams.TeamDetails = {
  description: '',
  inviteLinks: [],
  invites: new Set(),
  members: new Map(),
  requests: new Set(),
  settings: {open: false, openJoinAs: 'reader', tarsDisabled: false, teamShowcased: false},
  subteams: new Set(),
}

export const emptyTeamSettings = Object.freeze(emptyTeamDetails.settings)

export const annotatedTeamToDetails = (t: T.RPCGen.AnnotatedTeam): T.Teams.TeamDetails => {
  const maybeOpenJoinAs = teamRoleByEnum[t.settings.joinAs]
  const members = new Map<string, T.Teams.MemberInfo>()
  t.members?.forEach(member => {
    const {fullName, needsPUK, status, username} = member
    const maybeRole = teamRoleByEnum[member.role]
    members.set(username, {
      fullName,
      joinTime: member.joinTime || undefined,
      needsPUK,
      status: rpcMemberStatusToStatus[status],
      type: maybeRole === 'none' ? 'reader' : maybeRole,
      username,
    })
  })
  return {
    ...annotatedInvitesToInviteDetails(t.invites ?? undefined),
    description: t.showcase.description ?? '',
    members,
    requests: t.joinRequests ? new Set(t.joinRequests) : new Set(),
    settings: {
      open: !!t.settings.open,
      openJoinAs: maybeOpenJoinAs === 'none' ? 'reader' : maybeOpenJoinAs,
      tarsDisabled: t.tarsDisabled,
      teamShowcased: t.showcase.isShowcased,
    },
    subteams: new Set(t.transitiveSubteamsUnverified.entries?.map(e => e.teamID) ?? []),
  }
}

export const getTeamRowBadgeCount = (
  newTeamRequests: ReadonlyMap<T.Teams.TeamID, ReadonlySet<string>>,
  teamIDToResetUsers: ReadonlyMap<T.Teams.TeamID, ReadonlySet<string>>,
  teamID: T.Teams.TeamID
) => {
  return (newTeamRequests.get(teamID)?.size ?? 0) + (teamIDToResetUsers.get(teamID)?.size ?? 0)
}

const canUserPerformCache: {[key: string]: T.Teams.TeamOperations} = {}
const canUserPerformCacheKey = (t: T.Teams.TeamRoleAndDetails) => t.role + t.implicitAdmin
export const deriveCanPerform = (roleAndDetails?: T.Teams.TeamRoleAndDetails): T.Teams.TeamOperations => {
  if (!roleAndDetails) {
    return initialCanUserPerform
  }

  const ck = canUserPerformCacheKey(roleAndDetails)
  if (canUserPerformCache[ck]) return canUserPerformCache[ck]

  const {role, implicitAdmin} = roleAndDetails
  const isAdminOrAbove = role === 'admin' || role === 'owner'
  const isWriterOrAbove = role === 'writer' || isAdminOrAbove
  const isBotOrAbove = role === 'bot' || role === 'reader' || isWriterOrAbove

  const canPerform = {
    changeOpenTeam: isAdminOrAbove || implicitAdmin,
    changeTarsDisabled: isAdminOrAbove || implicitAdmin,
    chat: isBotOrAbove,
    createChannel: isWriterOrAbove,
    deleteChannel: isAdminOrAbove,
    deleteChatHistory: isAdminOrAbove,
    deleteOtherEmojis: isAdminOrAbove,
    deleteOtherMessages: isAdminOrAbove,
    deleteTeam: role === 'owner' || implicitAdmin,
    editChannelDescription: isWriterOrAbove,
    editTeamDescription: isAdminOrAbove || implicitAdmin,
    joinTeam: role === 'none' && implicitAdmin,
    listFirst: implicitAdmin,
    manageBots: isAdminOrAbove || implicitAdmin,
    manageEmojis: isWriterOrAbove,
    manageMembers: isAdminOrAbove || implicitAdmin,
    manageSubteams: isAdminOrAbove || implicitAdmin,
    pinMessage: isWriterOrAbove,
    renameChannel: isWriterOrAbove,
    renameTeam: implicitAdmin,
    setMemberShowcase: false,
    setMinWriterRole: isAdminOrAbove,
    setPublicityAny: isAdminOrAbove || implicitAdmin,
    setRetentionPolicy: isAdminOrAbove,
    setTeamShowcase: isAdminOrAbove,
  }
  canUserPerformCache[ck] = canPerform
  return canPerform
}

export const stringifyPeople = (people: string[]): string => {
  switch (people.length) {
    case 0:
      return 'nobody'
    case 1:
      return people[0]!
    case 2:
      return `${people[0]!} and ${people[1]!}`
    case 3:
      return `${people[0]!}, ${people[1]!} and ${people[2]!}`
    default:
      return `${people[0] ?? ''}, ${people[1] ?? ''}, and ${people.length - 2} others`
  }
}

export const retentionPolicyToServiceRetentionPolicy = (
  policy: T.Retention.RetentionPolicy
): T.RPCChat.RetentionPolicy => {
  switch (policy.type) {
    case 'retain':
      return {retain: {}, typ: T.RPCChat.RetentionPolicyType.retain}
    case 'expire':
      return {expire: {age: policy.seconds}, typ: T.RPCChat.RetentionPolicyType.expire}
    case 'explode':
      return {ephemeral: {age: policy.seconds}, typ: T.RPCChat.RetentionPolicyType.ephemeral}
    case 'inherit':
      return {inherit: {}, typ: T.RPCChat.RetentionPolicyType.inherit}
  }
}

export const userIsRoleInTeamWithInfo = (
  memberInfo: ReadonlyMap<string, T.Teams.MemberInfo>,
  username: string,
  role: T.Teams.TeamRoleType
): boolean => {
  const member = memberInfo.get(username)
  if (!member) {
    return false
  }
  return member.type === role
}
