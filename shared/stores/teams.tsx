import * as S from '@/constants/strings'
import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import {
  clearModals,
  navigateAppend,
  navigateUp,
  navUpToScreen,
  navToProfile,
} from '@/constants/router'
import * as Z from '@/util/zustand'
import invert from 'lodash/invert'
import logger from '@/logger'
import {RPCError, logError} from '@/util/errors'
import {fixCrop} from '@/util/crop'
import {getTBStore} from '@/stores/team-building'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useUsersState} from '@/stores/users'
import * as Util from '@/constants/teams'

export {
  baseRetentionPolicies,
  retentionPolicies,
  makeRetentionPolicy,
  serviceRetentionPolicyToRetentionPolicy,
  teamRoleByEnum,
  retentionPolicyToServiceRetentionPolicy,
  userIsRoleInTeamWithInfo,
} from '@/constants/teams'

export const teamRoleTypes = ['reader', 'writer', 'admin', 'owner'] as const

export const rpcMemberStatusToStatus = invert(T.RPCGen.TeamMemberStatus) as unknown as {
  [K in keyof typeof T.RPCGen.TeamMemberStatus as (typeof T.RPCGen.TeamMemberStatus)[K]]: K
}

export const addToTeamSearchKey = 'addToTeamSearch'

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
    const maybeRole = Util.teamRoleByEnum[role]
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

const emptyTeamChannelInfo = {
  channelname: '',
  conversationIDKey: '', // would be noConversationIDKey but causes import cycle
  description: '',
} satisfies T.Teams.TeamChannelInfo

export const getTeamChannelInfo = (
  state: State,
  teamID: T.Teams.TeamID,
  conversationIDKey: T.Chat.ConversationIDKey
) => state.channelInfo.get(teamID)?.get(conversationIDKey) ?? emptyTeamChannelInfo

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

export const rpcTeamRoleMapAndVersionToTeamRoleMap = (
  m: T.RPCGen.TeamRoleMapAndVersion
): T.Teams.TeamRoleMap => {
  const ret: T.Teams.TeamRoleMap = {
    latestKnownVersion: m.version,
    loadedVersion: m.version,
    roles: new Map<T.Teams.TeamID, T.Teams.TeamRoleAndDetails>(),
  }
  for (const key in m.teams) {
    const value = m.teams[key]
    if (value) {
      ret.roles.set(key, {
        implicitAdmin:
          value.implicitRole === T.RPCGen.TeamRole.admin || value.implicitRole === T.RPCGen.TeamRole.owner,
        role: Util.teamRoleByEnum[value.role],
      })
    }
  }
  return ret
}

export const typeToLabel = {
  admin: 'Admin',
  bot: 'Bot',
  owner: 'Owner',
  reader: 'Reader',
  restrictedbot: 'Restricted bot',
  writer: 'Writer',
} satisfies T.Teams.TypeMap

export const initialTeamSettings = Object.freeze({
  joinAs: T.RPCGen.TeamRole.reader,
  open: false,
})

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

export const userIsRoleInTeam = (
  state: State,
  teamID: T.Teams.TeamID,
  username: string,
  role: T.Teams.TeamRoleType
): boolean => {
  return Util.userIsRoleInTeamWithInfo(
    state.teamIDToMembers.get(teamID) || new Map<string, T.Teams.MemberInfo>(),
    username,
    role
  )
}
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

export const getRole = (state: State, teamID: T.Teams.TeamID): T.Teams.MaybeTeamRoleType =>
  state.teamRoleMap.roles.get(teamID)?.role || 'none'

export const getRoleByName = (state: State, teamname: string): T.Teams.MaybeTeamRoleType =>
  getRole(state, getTeamID(state, teamname))

export const isLastOwner = (state: State, teamID: T.Teams.TeamID): boolean =>
  isOwner(getRole(state, teamID)) && !isMultiOwnerTeam(state, teamID)

const subteamsCannotHaveOwners = {owner: 'Subteams cannot have owners.'}
const onlyOwnersCanTurnTeamMembersIntoOwners = {owner: 'Only owners can turn team members into owners.'}
const roleChangeSub = {
  admin: 'You must be at least an admin to make role changes.',
  owner: 'Subteams cannot have owners.',
  reader: 'You must be at least an admin to make role changes.',
  writer: 'You must be at least an admin to make role changes.',
}
const roleChangeNotSub = {
  admin: 'You must be at least an admin to make role changes.',
  owner: 'You must be at least an admin to make role changes.',
  reader: 'You must be at least an admin to make role changes.',
  writer: 'You must be at least an admin to make role changes.',
}

const anotherRoleChangeSub = {
  admin: `Only owners can change another owner's role`,
  owner: 'Subteams cannot have owners.',
  reader: `Only owners can change another owner's role`,
  writer: `Only owners can change another owner's role`,
}
const anotherRoleChangeNotSub = {
  admin: `Only owners can change another owner's role`,
  owner: `Only owners can change another owner's role`,
  reader: `Only owners can change another owner's role`,
  writer: `Only owners can change another owner's role`,
}

const notOwnerSub = {owner: 'Subteams cannot have owners.'}
const notOwnerNotSub = {owner: `Only owners can turn members into owners`}
const emptyObj = {}
const noRemoveLastOwner = {
  admin: `You can't demote a team's last owner`,
  reader: `You can't demote a team's last owner`,
  writer: `You can't demote a team's last owner`,
}

export const getDisabledReasonsForRolePicker = (
  state: State,
  teamID: T.Teams.TeamID,
  membersToModify?: string | string[]
): T.Teams.DisabledReasonsForRolePicker => {
  const canManageMembers = getCanPerformByID(state, teamID).manageMembers
  const teamMeta = getTeamMeta(state, teamID)
  const teamDetails = useTeamsState.getState().teamDetails.get(teamID)
  const members: ReadonlyMap<string, T.Teams.MemberInfo> =
    teamDetails?.members || state.teamIDToMembers.get(teamID) || new Map<string, T.Teams.MemberInfo>()
  const teamname = teamMeta.teamname
  let theyAreOwner = false
  if (typeof membersToModify === 'string') {
    const member = members.get(membersToModify)
    theyAreOwner = member?.type === 'owner'
  } else if (Array.isArray(membersToModify)) {
    theyAreOwner = membersToModify.some(username => members.get(username)?.type === 'owner')
  }

  const myUsername = useCurrentUserState.getState().username
  const you = members.get(myUsername)
  // Fallback to the lowest role, although this shouldn't happen
  const yourRole = you?.type ?? 'reader'

  if (canManageMembers) {
    // If you're an implicit admin, the tests below will fail for you, but you can still change roles.
    if (isSubteam(teamname)) {
      return subteamsCannotHaveOwners
    }
    if (yourRole !== 'owner') {
      return theyAreOwner
        ? isSubteam(teamname)
          ? anotherRoleChangeSub
          : anotherRoleChangeNotSub
        : onlyOwnersCanTurnTeamMembersIntoOwners
    }
    const modifyingSelf =
      membersToModify === myUsername ||
      (Array.isArray(membersToModify) && membersToModify.includes(myUsername))
    let noOtherOwners = true as boolean
    members.forEach(({type}, name) => {
      if (name !== myUsername && type === 'owner') {
        if (typeof membersToModify === 'string' || !membersToModify?.includes(name)) {
          noOtherOwners = false
        }
      }
    })

    if (modifyingSelf && noOtherOwners) {
      return noRemoveLastOwner
    }
    return emptyObj
  }

  // We shouldn't get here, but in case we do this is correct.
  if (yourRole !== 'owner' && yourRole !== 'admin') {
    return isSubteam(teamname) ? roleChangeSub : roleChangeNotSub
  }

  // We shouldn't get here, but in case we do this is correct.
  if (theyAreOwner && yourRole !== 'owner') {
    return isSubteam(teamname) ? anotherRoleChangeSub : anotherRoleChangeNotSub
  }

  // We shouldn't get here, but in case we do this is correct.
  if (yourRole !== 'owner') {
    return isSubteam(teamname) ? notOwnerSub : notOwnerNotSub
  }

  return {}
}

const isMultiOwnerTeam = (state: State, teamID: T.Teams.TeamID): boolean => {
  let countOfOwners = 0
  const allTeamMembers = state.teamDetails.get(teamID)?.members || new Map<string, T.Teams.MemberInfo>()
  const moreThanOneOwner = [...allTeamMembers.values()].some(tm => {
    if (isOwner(tm.type)) {
      countOfOwners++
    }
    return countOfOwners > 1
  })
  return moreThanOneOwner
}

export const getTeamID = (state: State, teamname: T.Teams.Teamname) =>
  state.teamNameToID.get(teamname) || T.Teams.noTeamID

export const getTeamNameFromID = (state: State, teamID: T.Teams.TeamID) =>
  state.teamMeta.get(teamID)?.teamname

export const getTeamRetentionPolicyByID = (state: State, teamID: T.Teams.TeamID) =>
  state.teamIDToRetentionPolicy.get(teamID)

/**
 *  Gets the number of channels you're subscribed to on a team
 */

export const initialPublicitySettings = Object.freeze<T.Teams._PublicitySettings>({
  anyMemberShowcase: false,
  description: '',
  ignoreAccessRequests: false,
  member: false,
  team: false,
})

// Note that for isInTeam and isInSomeTeam, we don't use 'teamnames',
// since that may contain subteams you're not a member of.

export const isInTeam = (state: State, teamname: T.Teams.Teamname): boolean =>
  getRoleByName(state, teamname) !== 'none'

export const isInSomeTeam = (state: State): boolean =>
  [...state.teamRoleMap.roles.values()].some(rd => rd.role !== 'none')

// Sorts teamnames canonically.
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

export const sortTeamsByName = (teamMeta: ReadonlyMap<T.Teams.TeamID, T.Teams.TeamMeta>) =>
  [...teamMeta.values()].sort((a, b) => sortTeamnames(a.teamname, b.teamname))

export const isAdmin = (type: T.Teams.MaybeTeamRoleType) => type === 'admin'
export const isOwner = (type: T.Teams.MaybeTeamRoleType) => type === 'owner'

// TODO make this check for only valid subteam names
export const isSubteam = (maybeTeamname: string) => {
  const subteams = maybeTeamname.split('.')
  if (subteams.length <= 1) {
    return false
  }
  return true
}

// How many public admins should we display on a showcased team card at once?
export const publicAdminsLimit = 6

const newRequestsGregorPrefix = 'team.request_access:'
const newRequestsGregorKey = (teamID: T.Teams.TeamID) => `${newRequestsGregorPrefix}${teamID}`

// Merge new teamMeta objs into old ones, removing any old teams that are not in the new map
export const mergeTeamMeta = (oldMap: State['teamMeta'], newMap: State['teamMeta']) => {
  const ret = new Map(newMap)
  for (const [teamID, teamMeta] of newMap.entries()) {
    ret.set(teamID, {...oldMap.get(teamID), ...teamMeta})
  }
  return ret
}

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

export const getTeamMeta = (state: State, teamID: T.Teams.TeamID) => state.teamMeta.get(teamID) ?? emptyTeamMeta

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
        role: Util.teamRoleByEnum[t.role],
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
      const role = Util.teamRoleByEnum[teamInvite.role]
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
        // skip invalid invites for non-invitelinks
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
  const maybeOpenJoinAs = Util.teamRoleByEnum[t.settings.joinAs]
  const members = new Map<string, T.Teams.MemberInfo>()
  t.members?.forEach(member => {
    const {fullName, needsPUK, status, username} = member
    const maybeRole = Util.teamRoleByEnum[member.role]
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

// Don't count new team because those are shown with a 'NEW' meta instead of badge
export const getTeamRowBadgeCount = (
  newTeamRequests: ReadonlyMap<T.Teams.TeamID, ReadonlySet<string>>,
  teamIDToResetUsers: ReadonlyMap<T.Teams.TeamID, ReadonlySet<string>>,
  teamID: T.Teams.TeamID
) => {
  return (newTeamRequests.get(teamID)?.size ?? 0) + (teamIDToResetUsers.get(teamID)?.size ?? 0)
}

export const canShowcase = (state: State, teamID: T.Teams.TeamID) => {
  const role = getRole(state, teamID)
  return getTeamMeta(state, teamID).allowPromote || role === 'admin' || role === 'owner'
}

const _canUserPerformCache: {[key: string]: T.Teams.TeamOperations} = {}
const _canUserPerformCacheKey = (t: T.Teams.TeamRoleAndDetails) => t.role + t.implicitAdmin
export const deriveCanPerform = (roleAndDetails?: T.Teams.TeamRoleAndDetails): T.Teams.TeamOperations => {
  if (!roleAndDetails) {
    // can happen if an empty teamID was passed to a getter
    return initialCanUserPerform
  }

  const ck = _canUserPerformCacheKey(roleAndDetails)
  if (_canUserPerformCache[ck]) return _canUserPerformCache[ck]

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
    deleteTeam: role === 'owner' || implicitAdmin, // role = owner for root teams, otherwise implicitAdmin
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
    setMemberShowcase: false, // TODO remove, depends on team publicity settings
    setMinWriterRole: isAdminOrAbove,
    setPublicityAny: isAdminOrAbove || implicitAdmin,
    setRetentionPolicy: isAdminOrAbove,
    setTeamShowcase: isAdminOrAbove,
  }
  _canUserPerformCache[ck] = canPerform
  return canPerform
}

export const getCanPerform = (state: State, teamname: T.Teams.Teamname): T.Teams.TeamOperations =>
  getCanPerformByID(state, getTeamID(state, teamname))

export const getCanPerformByID = (state: State, teamID: T.Teams.TeamID): T.Teams.TeamOperations =>
  deriveCanPerform(state.teamRoleMap.roles.get(teamID))

export const lastActiveStatusToActivityLevel: {
  [key in T.RPCChat.LastActiveStatus]: T.Teams.ActivityLevel
} = {
  [T.RPCChat.LastActiveStatus.active]: 'active',
  [T.RPCChat.LastActiveStatus.none]: 'none',
  [T.RPCChat.LastActiveStatus.recentlyActive]: 'recently',
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

export const countValidInviteLinks = (inviteLinks: ReadonlyArray<T.Teams.InviteLink>): number => {
  return inviteLinks.reduce((t, inviteLink) => {
    if (inviteLink.isValid) {
      return t + 1
    }
    return t
  }, 0)
}

export const maybeGetMostRecentValidInviteLink = (inviteLinks: ReadonlyArray<T.Teams.InviteLink>) =>
  inviteLinks.find(inviteLink => inviteLink.isValid)

type Store = T.Immutable<{
  activityLevels: T.Teams.ActivityLevels
  channelInfo: Map<T.Teams.TeamID, Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>>
  teamNameToID: Map<T.Teams.Teamname, string>
  teamnames: Set<T.Teams.Teamname> // TODO remove
  teamMeta: Map<T.Teams.TeamID, T.Teams.TeamMeta>
  teamRoleMap: T.Teams.TeamRoleMap
  teamDetails: Map<T.Teams.TeamID, T.Teams.TeamDetails>
  teamIDToMembers: Map<T.Teams.TeamID, Map<string, T.Teams.MemberInfo>> // Used by chat sidebar until team loading gets easier
  teamIDToRetentionPolicy: Map<T.Teams.TeamID, T.Retention.RetentionPolicy>
}>

const initialStore: Store = {
  activityLevels: {channels: new Map(), loaded: false, teams: new Map()},
  channelInfo: new Map(),
  teamDetails: new Map(),
  teamIDToMembers: new Map(),
  teamIDToRetentionPolicy: new Map(),
  teamMeta: new Map(),
  teamNameToID: new Map(),
  teamRoleMap: {latestKnownVersion: -1, loadedVersion: -1, roles: new Map()},
  teamnames: new Set(),
}

export type State = Store & {
  dispatch: {
    addToTeam: (
      teamID: T.Teams.TeamID,
      users: Array<{assertion: string; role: T.Teams.TeamRoleType}>,
      sendChatNotification: boolean,
      fromTeamBuilder?: boolean
    ) => void
    clearNavBadges: () => void
    deleteChannelConfirmed: (teamID: T.Teams.TeamID, conversationIDKey: T.Chat.ConversationIDKey) => void
    deleteTeam: (teamID: T.Teams.TeamID) => void
    getActivityForTeams: () => void
    getMembers: (teamID: T.Teams.TeamID, forceReload?: boolean) => Promise<void>
    getTeamRetentionPolicy: (teamID: T.Teams.TeamID) => void
    getTeams: (forceReload?: boolean) => void
    ignoreRequest: (teamID: T.Teams.TeamID, teamname: string, username: string) => void
    leaveTeam: (teamname: string, permanent: boolean, context: 'teams' | 'chat') => void
    loadTeam: (teamID: T.Teams.TeamID) => void
    loadTeamChannelList: (teamID: T.Teams.TeamID) => void
    notifyTeamTeamRoleMapChanged: (newVersion: number) => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    reAddToTeam: (teamID: T.Teams.TeamID, username: string) => void
    refreshTeamRoleMap: () => void
    removeMember: (teamID: T.Teams.TeamID, username: string) => void
    removePendingInvite: (teamID: T.Teams.TeamID, inviteID: string) => void
    renameTeam: (oldName: string, newName: string) => void
    resetState: () => void
    saveChannelMembership: (
      teamID: T.Teams.TeamID,
      oldChannelState: T.Teams.ChannelMembershipState,
      newChannelState: T.Teams.ChannelMembershipState
    ) => void
    setMemberPublicity: (teamID: T.Teams.TeamID, showcase: boolean) => void
    setTeamRetentionPolicy: (teamID: T.Teams.TeamID, policy: T.Retention.RetentionPolicy) => void
    setTeamRoleMapLatestKnownVersion: (version: number) => void
    teamChangedByID: (c: EngineGen.ParamsOf<'keybase.1.NotifyTeam.teamChangedByID'>) => void
    teamSeen: (teamID: T.Teams.TeamID) => void
    updateCachedBotMember: (teamID: T.Teams.TeamID, username: string, role?: 'bot' | 'restrictedbot') => void
    updateChannelName: (
      teamID: T.Teams.TeamID,
      conversationIDKey: T.Chat.ConversationIDKey,
      newChannelName: string
    ) => Promise<void>
    updateTopic: (
      teamID: T.Teams.TeamID,
      conversationIDKey: T.Chat.ConversationIDKey,
      newTopic: string
    ) => Promise<void>
    uploadTeamAvatar: (
      teamname: string,
      filename: string,
      sendChatNotification: boolean,
      crop?: T.RPCGen.ImageCropRect
    ) => void
  }
}

export const useTeamsState = Z.createZustand<State>('teams', (set, get) => {
  let inflightMemberLoads = new Map<T.Teams.TeamID, Promise<void>>()
  let inflightMemberLoadTokens = new Map<T.Teams.TeamID, symbol>()
  let queuedMemberReloads = new Set<T.Teams.TeamID>()
  let memberLoadGeneration = 0
  const clearMemberLoadTracking = () => {
    memberLoadGeneration += 1
    inflightMemberLoads = new Map()
    inflightMemberLoadTokens = new Map()
    queuedMemberReloads = new Set()
  }
  const resetState = () => {
    clearMemberLoadTracking()
    set({...initialStore, dispatch}, true)
  }
  const dispatch: State['dispatch'] = {
    addToTeam: (teamID, users, sendChatNotification, fromTeamBuilder) => {
      const f = async () => {
        try {
          const res = await T.RPCGen.teamsTeamAddMembersMultiRoleRpcPromise(
            {
              sendChatNotification,
              teamID,
              users: users.map(({assertion, role}) => ({
                assertion: assertion,
                role: T.RPCGen.TeamRole[role],
              })),
            },
            [
              S.waitingKeyTeamsTeam(teamID),
              S.waitingKeyTeamsAddMember(teamID, ...users.map(({assertion}) => assertion)),
            ]
          )
          if (res.notAdded && res.notAdded.length > 0) {
            const usernames = res.notAdded.map(elem => elem.username)
            getTBStore('teams').dispatch.finishedTeamBuilding()
            navigateAppend({
              name: 'contactRestricted',
              params: {source: 'teamAddSomeFailed', usernames},
            })
            return
          }

          if (fromTeamBuilder) {
            getTBStore('teams').dispatch.finishedTeamBuilding()
          }
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          // If all of the users couldn't be added due to contact settings, the RPC fails.
          if (error.code === T.RPCGen.StatusCode.scteamcontactsettingsblock) {
            const users = (error.fields as Array<{key?: string; value?: string} | undefined> | undefined)
              ?.filter(elem => elem?.key === 'usernames')
              .map(elem => elem?.value)
            const usernames = users?.[0]?.split(',') ?? []
            getTBStore('teams').dispatch.finishedTeamBuilding()
            navigateAppend({
              name: 'contactRestricted',
              params: {source: 'teamAddAllFailed', usernames},
            })
            return
          }

          const msg = error.desc
          // TODO this should not error on member already in team
          if (fromTeamBuilder) {
            getTBStore('teams').dispatch.setError(msg)
          } else {
            logger.error(`addToTeam failed for ${teamID}: ${msg}`)
          }
        }
      }
      ignorePromise(f())
    },
    clearNavBadges: () => {
      const f = async () => {
        try {
          await T.RPCGen.gregorDismissCategoryRpcPromise({category: 'team.newly_added_to_team'})
          await T.RPCGen.gregorDismissCategoryRpcPromise({category: 'team.delete'})
        } catch (err) {
          logError(err)
        }
      }
      ignorePromise(f())
    },
    deleteChannelConfirmed: (teamID, conversationIDKey) => {
      const f = async () => {
        // channelName is only needed for confirmation, so since we handle
        // confirmation ourselves we don't need to plumb it through.
        await T.RPCChat.localDeleteConversationLocalRpcPromise(
          {
            channelName: '',
            confirmed: true,
            convID: T.Chat.keyToConversationID(conversationIDKey),
          },
          S.waitingKeyTeamsTeam(teamID)
        )
        get().dispatch.loadTeamChannelList(teamID)
        clearModals()
      }
      ignorePromise(f())
    },
    deleteTeam: teamID => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamDeleteRpcListener({
            customResponseIncomingCallMap: {
              'keybase.1.teamsUi.confirmRootTeamDelete': (_, response) => response.result(true),
              'keybase.1.teamsUi.confirmSubteamDelete': (_, response) => response.result(true),
            },
            incomingCallMap: {},
            params: {teamID},
            waitingKey: S.waitingKeyTeamsDeleteTeam(teamID),
          })
        } catch (error) {
          if (error instanceof RPCError) {
            // handled through waiting store
            logger.warn('error:', error.message)
          }
        }
      }
      ignorePromise(f())
    },
    getActivityForTeams: () => {
      const f = async () => {
        try {
          const results = await T.RPCChat.localGetLastActiveForTeamsRpcPromise()
          const teams = Object.entries(results.teams ?? {}).reduce((res, [teamID, status]) => {
            if (status === T.RPCChat.LastActiveStatus.none) {
              return res
            }
            res.set(teamID, lastActiveStatusToActivityLevel[status])
            return res
          }, new Map<T.Teams.TeamID, T.Teams.ActivityLevel>())
          const channels = Object.entries(results.channels ?? {}).reduce(
            (res, [conversationIDKey, status]) => {
              if (status === T.RPCChat.LastActiveStatus.none) {
                return res
              }
              res.set(conversationIDKey, lastActiveStatusToActivityLevel[status])
              return res
            },
            new Map<T.Chat.ConversationIDKey, T.Teams.ActivityLevel>()
          )
          set(s => {
            s.activityLevels = {channels, loaded: true, teams}
          })
        } catch (e) {
          logger.warn(e)
        }
        return
      }
      ignorePromise(f())
    },
    getMembers: async (teamID: T.Teams.TeamID, forceReload = false) => {
      if (!teamID || teamID === T.Teams.noTeamID || teamID === T.Teams.newTeamWizardTeamID) {
        logger.warn(`bail on invalid team ID ${teamID}`)
        return
      }
      const generation = memberLoadGeneration
      const inflight = inflightMemberLoads.get(teamID)
      if (inflight) {
        if (!forceReload) {
          return inflight
        }
        queuedMemberReloads.add(teamID)
        await inflight
        if (generation !== memberLoadGeneration) {
          return
        }
        if (!queuedMemberReloads.delete(teamID)) {
          return
        }
        return get().dispatch.getMembers(teamID)
      }
      const requestToken = Symbol(String(teamID))
      const promise = (async () => {
        try {
          const res = await T.RPCGen.teamsTeamGetMembersByIDRpcPromise({
            id: teamID,
          })
          if (generation !== memberLoadGeneration) {
            return
          }
          const members = rpcDetailsToMemberInfos(res ?? [])
          set(s => {
            s.teamIDToMembers.set(teamID, members)
          })
          useUsersState.getState().dispatch.updates(
            [...members.values()].map(m => ({
              info: {fullname: m.fullName},
              name: m.username,
            }))
          )
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(`Error updating members for ${teamID}: ${error.desc}`)
          }
        } finally {
          if (inflightMemberLoadTokens.get(teamID) === requestToken) {
            inflightMemberLoads.delete(teamID)
            inflightMemberLoadTokens.delete(teamID)
          }
        }
      })()
      inflightMemberLoads.set(teamID, promise)
      inflightMemberLoadTokens.set(teamID, requestToken)
      return promise
    },
    getTeamRetentionPolicy: teamID => {
      const f = async () => {
        let retentionPolicy = Util.makeRetentionPolicy()
        try {
          const policy = await T.RPCChat.localGetTeamRetentionLocalRpcPromise(
            {teamID},
            S.waitingKeyTeamsTeam(teamID)
          )
          try {
            retentionPolicy = Util.serviceRetentionPolicyToRetentionPolicy(policy)
            if (retentionPolicy.type === 'inherit') {
              throw new Error(`RPC returned retention policy of type 'inherit' for team policy`)
            }
          } catch (error) {
            if (error instanceof RPCError) {
              logger.error(error.message)
            }
          }
        } catch {}
        set(s => {
          s.teamIDToRetentionPolicy.set(teamID, retentionPolicy)
        })
      }
      ignorePromise(f())
    },
    getTeams: _forceReload => {
      const f = async () => {
        const username = useCurrentUserState.getState().username
        const loggedIn = useConfigState.getState().loggedIn
        if (!username || !loggedIn) {
          logger.warn('getTeams while logged out')
          return
        }
        try {
          const results = await T.RPCGen.teamsTeamListUnverifiedRpcPromise(
            {includeImplicitTeams: false, userAssertion: username},
            S.waitingKeyTeamsLoaded
          )
          const teams: ReadonlyArray<T.RPCGen.AnnotatedMemberInfo> = results.teams || []
          const teamnames: Array<string> = []
          const teamNameToID = new Map<string, T.Teams.TeamID>()
          teams.forEach(team => {
            teamnames.push(team.fqName)
            teamNameToID.set(team.fqName, team.teamID)
          })
          set(s => {
            s.teamNameToID = teamNameToID
            s.teamnames = new Set<string>(teamnames)
            s.teamMeta = mergeTeamMeta(s.teamMeta, teamListToMeta(teams))
          })
        } catch (error) {
          if (error instanceof RPCError) {
            if (error.code === T.RPCGen.StatusCode.scapinetworkerror) {
              // Ignore API errors due to offline
            } else {
              logger.error(error)
            }
          }
        }
      }
      ignorePromise(f())
    },
    ignoreRequest: (teamID, teamname, username) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamIgnoreRequestRpcPromise(
            {name: teamname, username},
            S.waitingKeyTeamsTeam(teamID)
          )
        } catch {}
      }
      ignorePromise(f())
    },
    leaveTeam: (teamname, permanent, context) => {
      const f = async () => {
        logger.info(`leaveTeam: Leaving ${teamname} from context ${context}`)
        try {
          await T.RPCGen.teamsTeamLeaveRpcPromise(
            {name: teamname, permanent},
            S.waitingKeyTeamsLeaveTeam(teamname)
          )
          logger.info(`leaveTeam: left ${teamname} successfully`)
          clearModals()
          navUpToScreen(context === 'chat' ? 'chatRoot' : 'teamsRoot')
          get().dispatch.getTeams(true)
        } catch (error) {
          if (error instanceof RPCError) {
            // handled through waiting store
            logger.warn('error:', error.message)
          }
        }
      }
      ignorePromise(f())
    },
    loadTeam: teamID => {
      const f = async () => {
        if (!teamID || teamID === T.Teams.noTeamID) {
          logger.warn(`bail on invalid team ID ${teamID}`)
          return
        }
        try {
          const team = await T.RPCGen.teamsGetAnnotatedTeamRpcPromise({teamID})
          set(s => {
            const maybeMeta = s.teamMeta.get(teamID)
            if (maybeMeta && maybeMeta.teamname !== team.name) {
              if (team.name.includes('.')) {
                // subteam name changed. store loaded name
                maybeMeta.teamname = team.name
              } else {
                // bad. teamlist lied to us about the teamname
                throw new Error('Team name mismatch! Please report this error.')
              }
            }
            const details = annotatedTeamToDetails(team)
            s.teamDetails.set(teamID, T.castDraft(details))
          })
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(error.message)
          }
        }
      }
      ignorePromise(f())
    },
    loadTeamChannelList: teamID => {
      const f = async () => {
        const teamname = getTeamMeta(get(), teamID).teamname
        if (!teamname) {
          logger.warn('bailing on no teamMeta')
          return
        }
        try {
          const {convs} = await T.RPCChat.localGetTLFConversationsLocalRpcPromise({
            membersType: T.RPCChat.ConversationMembersType.team,
            tlfName: teamname,
            topicType: T.RPCChat.TopicType.chat,
          })
          const channels =
            convs?.reduce((res, inboxUIItem) => {
              const conversationIDKey = T.Chat.stringToConversationIDKey(inboxUIItem.convID)
              res.set(conversationIDKey, {
                channelname: inboxUIItem.channel,
                conversationIDKey,
                description: inboxUIItem.headline,
              })
              return res
            }, new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()) ??
            new Map<T.Chat.ConversationIDKey, T.Teams.TeamChannelInfo>()

          // ensure we refresh participants, but don't fail the saga if this somehow fails
          try {
            for (const c of channels.values()) {
              ignorePromise(
                T.RPCChat.localRefreshParticipantsRpcPromise({
                  convID: T.Chat.keyToConversationID(c.conversationIDKey),
                })
              )
            }
          } catch (e) {
            logger.error('this should never happen', e)
          }
          set(s => {
            s.channelInfo.set(teamID, channels)
          })
        } catch (err) {
          logger.warn(err)
        }
      }
      ignorePromise(f())
    },
    notifyTeamTeamRoleMapChanged: (newVersion: number) => {
      const loadedVersion = get().teamRoleMap.loadedVersion
      logger.info(`Got teamRoleMapChanged with version ${newVersion}, loadedVersion is ${loadedVersion}`)
      if (loadedVersion < newVersion) {
        get().dispatch.refreshTeamRoleMap()
      }
      get().dispatch.setTeamRoleMapLatestKnownVersion(newVersion)
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case 'chat.1.NotifyChat.ChatSetTeamRetention': {
          const {convs, teamID} = action.payload.params
          const first = convs?.[0]
          if (!first?.teamRetention) {
            logger.warn(
              `Got ChatSetTeamRetention with incomplete data for ${teamID}; refetching team retention policy`
            )
            get().dispatch.getTeamRetentionPolicy(teamID)
            break
          }
          set(s => {
            s.teamIDToRetentionPolicy.set(
              teamID,
              Util.serviceRetentionPolicyToRetentionPolicy(first.teamRetention)
            )
          })
          break
        }
        case 'keybase.1.NotifyTeam.teamRoleMapChanged': {
          const {newVersion} = action.payload.params
          get().dispatch.notifyTeamTeamRoleMapChanged(newVersion)
          break
        }
        case 'keybase.1.NotifyTeam.teamChangedByID':
          get().dispatch.teamChangedByID(action.payload.params)
          break
        default:
      }
    },
    reAddToTeam: (teamID, username) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamReAddMemberAfterResetRpcPromise(
            {id: teamID, username},
            S.waitingKeyTeamsAddMember(teamID, username)
          )
        } catch (error) {
          if (error instanceof RPCError) {
            // identify error
            if (error.code === T.RPCGen.StatusCode.scidentifysummaryerror) {
              // show profile card
              navToProfile(username)
            }
          }
        }
      }
      ignorePromise(f())
    },
    refreshTeamRoleMap: () => {
      const f = async () => {
        try {
          const _map = await T.RPCGen.teamsGetTeamRoleMapRpcPromise()
          const map = rpcTeamRoleMapAndVersionToTeamRoleMap(_map)
          set(s => {
            s.teamRoleMap = {
              latestKnownVersion: Math.max(map.latestKnownVersion, s.teamRoleMap.latestKnownVersion),
              loadedVersion: map.loadedVersion,
              roles: map.roles,
            }
          })
        } catch {
          logger.info(`Failed to refresh TeamRoleMap; service will retry`)
        }
      }
      ignorePromise(f())
    },
    removeMember: (teamID, username) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamRemoveMemberRpcPromise(
            {
              member: {
                assertion: {assertion: username, removeFromSubtree: false},
                type: T.RPCGen.TeamMemberToRemoveType.assertion,
              },
              teamID,
            },
            [S.waitingKeyTeamsTeam(teamID), S.waitingKeyTeamsRemoveMember(teamID, username)]
          )
        } catch (err) {
          logger.error('Failed to remove member', err)
          // TODO: create setEmailInviteError?`
        }
      }
      ignorePromise(f())
    },
    removePendingInvite: (teamID, inviteID) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsTeamRemoveMemberRpcPromise(
            {
              member: {inviteid: {inviteID}, type: T.RPCGen.TeamMemberToRemoveType.inviteid},
              teamID,
            },
            [S.waitingKeyTeamsTeam(teamID), S.waitingKeyTeamsRemoveMember(teamID, inviteID)]
          )
        } catch (err) {
          logger.error('Failed to remove pending invite', err)
        }
      }
      ignorePromise(f())
    },
    renameTeam: (oldName, _newName) => {
      const f = async () => {
        const prevName = {parts: oldName.split('.')}
        const newName = {parts: _newName.split('.')}
        try {
          await T.RPCGen.teamsTeamRenameRpcPromise({newName, prevName}, S.waitingKeyTeamsRename)
        } catch {
          // err displayed from waiting store in component
        }
      }
      ignorePromise(f())
    },
    resetState,
    saveChannelMembership: (teamID, oldChannelState, newChannelState) => {
      const f = async () => {
        const waitingKey = S.waitingKeyTeamsTeam(teamID)
        for (const convIDKeyStr in newChannelState) {
          const conversationIDKey = T.Chat.stringToConversationIDKey(convIDKeyStr)
          if (oldChannelState[conversationIDKey] === newChannelState[conversationIDKey]) {
            continue
          }
          if (newChannelState[conversationIDKey]) {
            try {
              const convID = T.Chat.keyToConversationID(conversationIDKey)
              await T.RPCChat.localJoinConversationByIDLocalRpcPromise({convID}, waitingKey)
            } catch (error) {
              useConfigState.getState().dispatch.setGlobalError(error)
            }
          } else {
            try {
              const convID = T.Chat.keyToConversationID(conversationIDKey)
              await T.RPCChat.localLeaveConversationLocalRpcPromise({convID}, waitingKey)
            } catch (error) {
              useConfigState.getState().dispatch.setGlobalError(error)
            }
          }
        }
      }
      ignorePromise(f())
    },
    setMemberPublicity: (teamID, showcase) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsSetTeamMemberShowcaseRpcPromise({isShowcased: showcase, teamID}, [
            S.waitingKeyTeamsTeam(teamID),
            S.waitingKeyTeamsSetMemberPublicity(teamID),
          ])
          get().dispatch.getTeams(true)
        } catch (error) {
          if (error instanceof RPCError) {
            logger.info(error.message)
          }
        }
      }
      ignorePromise(f())
    },
    setTeamRetentionPolicy: (teamID, policy) => {
      const f = async () => {
        try {
          const servicePolicy = Util.retentionPolicyToServiceRetentionPolicy(policy)
          await T.RPCChat.localSetTeamRetentionLocalRpcPromise({policy: servicePolicy, teamID}, [
            S.waitingKeyTeamsSetRetentionPolicy(teamID),
          ])
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(error.message)
          }
        }
      }
      ignorePromise(f())
    },
    setTeamRoleMapLatestKnownVersion: version => {
      set(s => {
        s.teamRoleMap.latestKnownVersion = version
      })
    },
    teamChangedByID: c => {
      const {changes, teamID} = c
      if (changes.membershipChanged && get().teamIDToMembers.has(teamID)) {
        ignorePromise(get().dispatch.getMembers(teamID, true))
      }
    },
    teamSeen: teamID => {
      const f = async () => {
        try {
          await T.RPCGen.gregorDismissCategoryRpcPromise({category: newRequestsGregorKey(teamID)})
        } catch (error) {
          if (error instanceof RPCError) {
            logger.error(error.message)
          }
        }
      }
      ignorePromise(f())
    },
    updateCachedBotMember: (teamID, username, role) => {
      if (!teamID || teamID === T.Teams.noTeamID || teamID === T.Teams.newTeamWizardTeamID) {
        return
      }
      set(s => {
        const infoFromUsers = useUsersState.getState().infoMap.get(username)
        const updateMembers = (members?: Map<string, T.Teams.MemberInfo>) => {
          if (!members) {
            return
          }
          if (!role) {
            members.delete(username)
            return
          }
          const existing = members.get(username)
          members.set(username, {
            fullName: existing?.fullName ?? infoFromUsers?.fullname ?? '',
            joinTime: existing?.joinTime,
            needsPUK: existing?.needsPUK ?? false,
            status: existing?.status ?? 'active',
            type: role,
            username,
          })
        }
        updateMembers(s.teamIDToMembers.get(teamID))
        updateMembers(s.teamDetails.get(teamID)?.members)
      })
    },
    updateChannelName: async (teamID, conversationIDKey, newChannelName) => {
      const param = {
        channelName: newChannelName,
        conversationID: T.Chat.keyToConversationID(conversationIDKey),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        tlfName: getTeamNameFromID(get(), teamID) ?? '',
        tlfPublic: false,
      }

      try {
        await T.RPCChat.localPostMetadataRpcPromise(param, S.waitingKeyTeamsUpdateChannelName(teamID))
      } catch {}
    },
    updateTopic: async (teamID, conversationIDKey, newTopic) => {
      const param = {
        conversationID: T.Chat.keyToConversationID(conversationIDKey),
        headline: newTopic,
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        tlfName: getTeamNameFromID(get(), teamID) ?? '',
        tlfPublic: false,
      }
      try {
        await T.RPCChat.localPostHeadlineRpcPromise(param, S.waitingKeyTeamsUpdateChannelName(teamID))
      } catch {}
    },
    uploadTeamAvatar: (teamname, filename, sendChatNotification, crop) => {
      const f = async () => {
        try {
          await T.RPCGen.teamsUploadTeamAvatarRpcPromise(
            {crop: fixCrop(crop), filename, sendChatNotification, teamname},
            S.waitingKeyProfileUploadAvatar
          )
          navigateUp()
        } catch (error) {
          if (error instanceof RPCError) {
            // error displayed in component
            logger.warn(`Error uploading team avatar: ${error.message}`)
          }
        }
      }
      ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
