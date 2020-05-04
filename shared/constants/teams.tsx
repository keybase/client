import * as Types from './types/teams'
import * as RPCTypes from './types/rpc-gen'
import * as RPCChatTypes from './types/rpc-chat-gen'
import * as ChatTypes from './types/chat2'
import {getFullRoute} from './router2'
import invert from 'lodash/invert'
import {teamsTab} from './tabs'
import {memoize} from '../util/memoize'
import * as TeamBuildingConstants from './team-building'
import {RetentionPolicy} from './types/retention-policy'
import {TypedState} from './reducer'

export const teamRoleTypes = ['reader', 'writer', 'admin', 'owner'] as const

export const rpcMemberStatusToStatus = invert(RPCTypes.TeamMemberStatus) as {
  [K in RPCTypes.TeamMemberStatus]: keyof typeof RPCTypes.TeamMemberStatus
}

// Waiting keys
// Add granularity as necessary
export const teamsLoadedWaitingKey = 'teams:loaded'
export const teamsAccessRequestWaitingKey = 'teams:accessRequests'
export const joinTeamWaitingKey = 'teams:joinTeam'
export const teamWaitingKey = (teamID: Types.TeamID) => `team:${teamID}`

export const setMemberPublicityWaitingKey = (teamID: Types.TeamID) => `teamMemberPub:${teamID}`
export const teamGetWaitingKey = (teamID: Types.TeamID) => `teamGet:${teamID}`
export const teamTarsWaitingKey = (teamID: Types.TeamID) => `teamTars:${teamID}`
export const teamCreationWaitingKey = 'teamCreate'

export const addUserToTeamsWaitingKey = (username: string) => `addUserToTeams:${username}`
export const addPeopleToTeamWaitingKey = (teamname: Types.Teamname) => `teamAddPeople:${teamname}`
export const addToTeamByEmailWaitingKey = (teamname: Types.Teamname) => `teamAddByEmail:${teamname}`
export const getChannelsWaitingKey = (teamID: Types.TeamID) => `getChannels:${teamID}`
export const createChannelWaitingKey = (teamID: Types.TeamID) => `createChannel:${teamID}`
export const settingsWaitingKey = (teamID: Types.TeamID) => `teamSettings:${teamID}`
export const retentionWaitingKey = (teamID: Types.TeamID) => `teamRetention:${teamID}`
export const addMemberWaitingKey = (teamID: Types.TeamID, ...usernames: Array<string>) =>
  `teamAdd:${teamID};${usernames.join(',')}`
export const addInviteWaitingKey = (teamname: Types.Teamname, value: string) =>
  `teamAddInvite:${teamname};${value}`
// also for pending invites, hence id rather than username
export const removeMemberWaitingKey = (teamID: Types.TeamID, id: string) => `teamRemove:${teamID};${id}`
export const addToTeamSearchKey = 'addToTeamSearch'
export const teamProfileAddListWaitingKey = 'teamProfileAddList'
export const deleteChannelWaitingKey = (teamID: Types.TeamID) => `channelDelete:${teamID}`
export const deleteTeamWaitingKey = (teamID: Types.TeamID) => `teamDelete:${teamID}`
export const leaveTeamWaitingKey = (teamname: Types.Teamname) => `teamLeave:${teamname}`
export const teamRenameWaitingKey = 'teams:rename'
export const loadWelcomeMessageWaitingKey = (teamID: Types.TeamID) => `loadWelcomeMessage:${teamID}`
export const setWelcomeMessageWaitingKey = (teamID: Types.TeamID) => `setWelcomeMessage:${teamID}`
export const loadTeamTreeActivityWaitingKey = (teamID: Types.TeamID, username: string) =>
  `loadTeamTreeActivity:${teamID};${username}`
export const editMembershipWaitingKey = (teamID: Types.TeamID, ...usernames: Array<string>) =>
  `editMembership:${teamID};${usernames.join(',')}`
export const updateChannelNameWaitingKey = (teamID: Types.TeamID) => `updateChannelName:${teamID}`

export const initialMemberInfo = Object.freeze<Types.MemberInfo>({
  fullName: '',
  needsPUK: false,
  status: 'active',
  type: 'reader',
  username: '',
})

export const rpcDetailsToMemberInfos = (
  members: Array<RPCTypes.TeamMemberDetails>
): Map<string, Types.MemberInfo> => {
  const infos: Array<[string, Types.MemberInfo]> = []
  members.forEach(({fullName, joinTime, needsPUK, status, username, role}) => {
    const maybeRole = teamRoleByEnum[role]
    if (!maybeRole || maybeRole === 'none') {
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

export const emptyInviteInfo = Object.freeze<Types.InviteInfo>({
  email: '',
  id: '',
  name: '',
  phone: '',
  role: 'writer',
  username: '',
})

export const emptyEmailInviteError = Object.freeze<Types.EmailInviteError>({
  malformed: new Set<string>(),
  message: '',
})

const emptyTeamChannelInfo: Types.TeamChannelInfo = {
  channelname: '',
  conversationIDKey: '', // would be noConversationIDKey but causes import cycle
  description: '',
}

export const getTeamChannelInfo = (
  state: TypedState,
  teamID: Types.TeamID,
  conversationIDKey: ChatTypes.ConversationIDKey
) => state.teams.channelInfo.get(teamID)?.get(conversationIDKey) ?? emptyTeamChannelInfo

export const teamRoleByEnum = ((m: {[K in Types.MaybeTeamRoleType]: RPCTypes.TeamRole}) => {
  const mInv: {[K in RPCTypes.TeamRole]?: Types.MaybeTeamRoleType} = {}
  for (const roleStr in m) {
    // roleStr is typed as string; see
    // https://github.com/facebook/flow/issues/1736 .
    // @ts-ignore
    const role: Types.TeamRoleType = roleStr
    const e = m[role]
    mInv[e] = role
  }
  return mInv
})(RPCTypes.TeamRole)

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
export const compareTeamRoles = (a: Types.MaybeTeamRoleType, b: Types.MaybeTeamRoleType) => {
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
  a: Types.ActivityLevel | undefined,
  b: Types.ActivityLevel | undefined
) => {
  return activityLevelToCompare[b || 'none'] - activityLevelToCompare[a || 'none']
}

export const rpcTeamRoleMapAndVersionToTeamRoleMap = (
  m: RPCTypes.TeamRoleMapAndVersion
): Types.TeamRoleMap => {
  const ret: Types.TeamRoleMap = {
    latestKnownVersion: m.version,
    loadedVersion: m.version,
    roles: new Map<Types.TeamID, Types.TeamRoleAndDetails>(),
  }
  for (const key in m.teams) {
    const value = m.teams[key]
    ret.roles.set(key, {
      implicitAdmin:
        value.implicitRole === RPCTypes.TeamRole.admin || value.implicitRole == RPCTypes.TeamRole.owner,
      role: teamRoleByEnum[value.role] || 'none',
    })
  }
  return ret
}

export const typeToLabel: Types.TypeMap = {
  admin: 'Admin',
  bot: 'Bot',
  owner: 'Owner',
  reader: 'Reader',
  restrictedbot: 'Restricted bot',
  writer: 'Writer',
}

export const initialTeamSettings = Object.freeze({
  joinAs: RPCTypes.TeamRole.reader,
  open: false,
})

export const makeRetentionPolicy = (r?: Partial<RetentionPolicy>): RetentionPolicy => ({
  seconds: 0,
  title: '',
  type: 'retain',
  ...(r || {}),
})

export const addMembersWizardEmptyState: Types.State['addMembersWizard'] = {
  addToChannels: undefined,
  addingMembers: [],
  justFinished: false,
  role: 'writer',
  teamID: Types.noTeamID,
}
export const newTeamWizardEmptyState: Types.State['newTeamWizard'] = {
  addYourself: true,
  description: '',
  isBig: false,
  name: '',
  open: false,
  openTeamJoinRole: 'writer',
  showcase: false,
  teamType: 'other',
}

export const emptyErrorInEditMember = {error: '', teamID: Types.noTeamID, username: ''}

const emptyState: Types.State = {
  activityLevels: {channels: new Map(), loaded: false, teams: new Map()},
  addMembersWizard: addMembersWizardEmptyState,
  addUserToTeamsResults: '',
  addUserToTeamsState: 'notStarted',
  channelInfo: new Map(),
  channelSelectedMembers: new Map(),
  creatingChannels: false,
  deletedTeams: [],
  errorInAddToTeam: '',
  errorInChannelCreation: '',
  errorInEditDescription: '',
  errorInEditMember: emptyErrorInEditMember,
  errorInEditWelcomeMessage: '',
  errorInEmailInvite: emptyEmailInviteError,
  errorInSettings: '',
  errorInTeamCreation: '',
  errorInTeamInvite: '',
  errorInTeamJoin: '',
  invitesCollapsed: new Set(),
  newTeamRequests: new Map(),
  newTeamWizard: newTeamWizardEmptyState,
  newTeams: new Set(),
  sawChatBanner: false,
  sawSubteamsBanner: false,
  subteamFilter: '',
  subteamsFiltered: undefined,
  teamAccessRequestsPending: new Set(),
  teamBuilding: TeamBuildingConstants.makeSubState(),
  teamDetails: new Map(),
  teamDetailsSubscriptionCount: new Map(),
  teamIDToMembers: new Map(),
  teamIDToResetUsers: new Map(),
  teamIDToRetentionPolicy: new Map(),
  teamIDToWelcomeMessage: new Map(),
  teamInviteDetails: {inviteID: '', inviteKey: ''},
  teamJoinSuccess: false,
  teamJoinSuccessOpen: false,
  teamJoinSuccessTeamName: '',
  teamListFilter: '',
  teamListSort: 'role',
  teamMemberToLastActivity: new Map(),
  teamMemberToTreeMemberships: new Map(),
  teamMeta: new Map(),
  teamMetaStale: true, // start out true, we have not loaded
  teamMetaSubscribeCount: 0,
  teamNameToID: new Map(),
  teamNameToLoadingInvites: new Map(),
  teamProfileAddList: [],
  teamRoleMap: {latestKnownVersion: -1, loadedVersion: -1, roles: new Map()},
  teamSelectedChannels: new Map(),
  teamSelectedMembers: new Map(),
  teamVersion: new Map(),
  teamnames: new Set(),
  teamsWithChosenChannels: new Set(),
  treeLoaderTeamIDToSparseMemberInfos: new Map(),
}

export const makeState = (s?: Partial<Types.State>): Types.State =>
  s ? Object.assign({...emptyState}, s) : emptyState

export const initialCanUserPerform = Object.freeze<Types.TeamOperations>({
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

const baseRetentionPoliciesTitleMap = baseRetentionPolicies.reduce<{[key: number]: string}>((map, p) => {
  map[p.seconds] = p.title
  return map
}, {})

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

export const userIsRoleInTeamWithInfo = (
  memberInfo: Map<string, Types.MemberInfo>,
  username: string,
  role: Types.TeamRoleType
): boolean => {
  const member = memberInfo.get(username)
  if (!member) {
    return false
  }
  return member.type === role
}

export const userIsRoleInTeam = (
  state: TypedState,
  teamID: Types.TeamID,
  username: string,
  role: Types.TeamRoleType
): boolean => {
  return userIsRoleInTeamWithInfo(
    state.teams.teamIDToMembers.get(teamID) || new Map<string, Types.MemberInfo>(),
    username,
    role
  )
}
export const isBot = (type: Types.TeamRoleType) => type === 'bot' || type === 'restrictedbot'
export const userInTeamNotBotWithInfo = (
  memberInfo: Map<string, Types.MemberInfo>,
  username: string
): boolean => {
  const memb = memberInfo.get(username)
  if (!memb) {
    return false
  }
  return !isBot(memb.type)
}

export const getEmailInviteError = (state: TypedState) => state.teams.errorInEmailInvite

export const isTeamWithChosenChannels = (state: TypedState, teamname: string): boolean =>
  state.teams.teamsWithChosenChannels.has(teamname)

export const getRole = (state: TypedState, teamID: Types.TeamID): Types.MaybeTeamRoleType =>
  state.teams.teamRoleMap.roles.get(teamID)?.role || 'none'

export const getRoleByName = (state: TypedState, teamname: string): Types.MaybeTeamRoleType =>
  getRole(state, getTeamID(state, teamname))

export const isLastOwner = (state: TypedState, teamID: Types.TeamID): boolean =>
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
  state: TypedState,
  teamID: Types.TeamID,
  membersToModify: string | string[] | null
): Types.DisabledReasonsForRolePicker => {
  const canManageMembers = getCanPerformByID(state, teamID).manageMembers
  const teamMeta = getTeamMeta(state, teamID)
  const teamDetails: Types.TeamDetails = getTeamDetails(state, teamID)
  const members: Map<string, Types.MemberInfo> =
    teamDetails.members || state.teams.teamIDToMembers.get(teamID) || new Map()
  const teamname = teamMeta.teamname
  let theyAreOwner = false
  if (typeof membersToModify === 'string') {
    const member = members.get(membersToModify)
    theyAreOwner = member?.type === 'owner'
  } else if (Array.isArray(membersToModify)) {
    theyAreOwner = membersToModify.some(username => members.get(username)?.type === 'owner')
  }
  const you = members.get(state.config.username)
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
      membersToModify === state.config.username ||
      (Array.isArray(membersToModify) && membersToModify?.includes(state.config.username))
    let noOtherOwners = true
    members.forEach(({type}, name) => {
      if (name !== state.config.username && type === 'owner') {
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

const isMultiOwnerTeam = (state: TypedState, teamID: Types.TeamID): boolean => {
  let countOfOwners = 0
  const allTeamMembers = state.teams.teamDetails.get(teamID)?.members || new Map<string, Types.MemberInfo>()
  const moreThanOneOwner = [...allTeamMembers.values()].some(tm => {
    if (isOwner(tm.type)) {
      countOfOwners++
    }
    return countOfOwners > 1
  })
  return moreThanOneOwner
}

export const getTeamID = (state: TypedState, teamname: Types.Teamname): string =>
  state.teams.teamNameToID.get(teamname) || Types.noTeamID

export const getTeamNameFromID = (state: TypedState, teamID: Types.TeamID): Types.Teamname | null =>
  state.teams.teamMeta.get(teamID)?.teamname ?? null

export const getTeamRetentionPolicyByID = (state: TypedState, teamID: Types.TeamID): RetentionPolicy | null =>
  state.teams.teamIDToRetentionPolicy.get(teamID) ?? null

export const getTeamWelcomeMessageByID = (
  state: TypedState,
  teamID: Types.TeamID
): RPCChatTypes.WelcomeMessageDisplay | null => state.teams.teamIDToWelcomeMessage.get(teamID) ?? null

export const getSelectedTeams = (): Types.TeamID[] => {
  const path = getFullRoute()
  return path.reduce<Array<string>>((names, curr) => {
    if (curr.routeName === 'team') {
      curr.params && curr.params.teamID && names.push(curr.params.teamID)
    }
    return names
  }, [])
}

/**
 *  Gets the number of channels you're subscribed to on a team
 */
export const getNumberOfSubscribedChannels = (state: TypedState, teamname: Types.Teamname): number =>
  [...state.chat2.metaMap.values()].reduce((count, c) => (count += c.teamname === teamname ? 1 : 0), 0)

/**
 * Returns true if the team is big and you're a member
 */
export const isBigTeam = (state: TypedState, teamID: Types.TeamID): boolean => {
  const bigTeams = state.chat2.inboxLayout?.bigTeams
  return (bigTeams || []).some(
    v => v.state === RPCChatTypes.UIInboxBigTeamRowTyp.label && v.label.id === teamID
  )
}

export const initialPublicitySettings = Object.freeze<Types._PublicitySettings>({
  anyMemberShowcase: false,
  description: '',
  ignoreAccessRequests: false,
  member: false,
  team: false,
})

// Note that for isInTeam and isInSomeTeam, we don't use 'teamnames',
// since that may contain subteams you're not a member of.

export const isInTeam = (state: TypedState, teamname: Types.Teamname): boolean =>
  getRoleByName(state, teamname) !== 'none'

export const isInSomeTeam = (state: TypedState): boolean =>
  [...state.teams.teamRoleMap.roles.values()].some(rd => rd.role !== 'none')

export const isAccessRequestPending = (state: TypedState, teamname: Types.Teamname): boolean =>
  state.teams.teamAccessRequestsPending.has(teamname)

export const getTeamResetUsers = (state: TypedState, teamID: Types.TeamID): Set<string> =>
  state.teams.teamIDToResetUsers.get(teamID) || new Set()

export const getTeamLoadingInvites = (state: TypedState, teamname: Types.Teamname): Map<string, boolean> =>
  state.teams.teamNameToLoadingInvites.get(teamname) || new Map()

// Sorts teamnames canonically.
function sortTeamnames(a: string, b: string) {
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

const _memoizedSorted = memoize((names: Set<Types.Teamname>) => [...names].sort(sortTeamnames))
export const getSortedTeamnames = (state: TypedState): Types.Teamname[] =>
  _memoizedSorted(state.teams.teamnames)

export const sortTeamsByName = memoize((teamMeta: Map<Types.TeamID, Types.TeamMeta>) =>
  [...teamMeta.values()].sort((a, b) => sortTeamnames(a.teamname, b.teamname))
)

// sorted by name
export const getSortedTeams = (state: TypedState) => sortTeamsByName(state.teams.teamMeta)

export const isAdmin = (type: Types.MaybeTeamRoleType) => type === 'admin'
export const isOwner = (type: Types.MaybeTeamRoleType) => type === 'owner'

// TODO make this check for only valid subteam names
export const isSubteam = (maybeTeamname: string) => {
  const subteams = maybeTeamname.split('.')
  if (subteams.length <= 1) {
    return false
  }
  return true
}
export const serviceRetentionPolicyToRetentionPolicy = (
  policy?: RPCChatTypes.RetentionPolicy | null
): RetentionPolicy => {
  // !policy implies a default policy of retainment
  let retentionPolicy: RetentionPolicy = makeRetentionPolicy({type: 'retain'})
  if (policy) {
    // replace retentionPolicy with whatever is explicitly set
    switch (policy.typ) {
      case RPCChatTypes.RetentionPolicyType.retain:
        retentionPolicy = makeRetentionPolicy({title: 'Never auto-delete', type: 'retain'})
        break
      case RPCChatTypes.RetentionPolicyType.expire: {
        if (!policy.expire) {
          throw new Error(`RPC returned retention policy of type 'expire' with no expire data`)
        }
        const {expire} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: expire.age,
          title: baseRetentionPoliciesTitleMap[expire.age] || `${expire.age} seconds`,
          type: 'expire',
        })
        break
      }
      case RPCChatTypes.RetentionPolicyType.ephemeral: {
        if (!policy.ephemeral) {
          throw new Error(`RPC returned retention policy of type 'ephemeral' with no ephemeral data`)
        }
        const {ephemeral} = policy
        retentionPolicy = makeRetentionPolicy({
          seconds: ephemeral.age,
          title: baseRetentionPoliciesTitleMap[ephemeral.age] || `${ephemeral.age} seconds`,
          type: 'explode',
        })
        break
      }
      case RPCChatTypes.RetentionPolicyType.inherit:
        retentionPolicy = makeRetentionPolicy({type: 'inherit'})
    }
  }
  return retentionPolicy
}

export const retentionPolicyToServiceRetentionPolicy = (
  policy: RetentionPolicy
): RPCChatTypes.RetentionPolicy => {
  let res: RPCChatTypes.RetentionPolicy | null = null
  switch (policy.type) {
    case 'retain':
      res = {retain: {}, typ: RPCChatTypes.RetentionPolicyType.retain}
      break
    case 'expire':
      res = {expire: {age: policy.seconds}, typ: RPCChatTypes.RetentionPolicyType.expire}
      break
    case 'explode':
      res = {ephemeral: {age: policy.seconds}, typ: RPCChatTypes.RetentionPolicyType.ephemeral}
      break
    case 'inherit':
      res = {inherit: {}, typ: RPCChatTypes.RetentionPolicyType.inherit}
      break
  }
  if (!res) {
    throw new Error(`Unable to convert retention policy of unknown type: ${policy.type}`)
  }
  return res
}

// How many public admins should we display on a showcased team card at once?
export const publicAdminsLimit = 6

export const chosenChannelsGregorKey = 'chosenChannelsForTeam'
export const newRequestsGregorPrefix = 'team.request_access:'
export const newRequestsGregorKey = (teamID: Types.TeamID) => `${newRequestsGregorPrefix}${teamID}`

export const isOnTeamsTab = () => {
  const path = getFullRoute()
  return Array.isArray(path) ? path.some(p => p.routeName === teamsTab) : false
}

// Merge new teamMeta objs into old ones, removing any old teams that are not in the new map
export const mergeTeamMeta = (oldMap: Types.State['teamMeta'], newMap: Types.State['teamMeta']) => {
  const ret = new Map(newMap)
  for (const [teamID, teamMeta] of newMap.entries()) {
    ret.set(teamID, {...oldMap.get(teamID), ...teamMeta})
  }
  return ret
}

export const emptyTeamMeta = Object.freeze<Types.TeamMeta>({
  allowPromote: false,
  id: Types.noTeamID,
  isMember: false,
  isOpen: false,
  memberCount: -1,
  role: 'none',
  showcasing: false,
  teamname: '',
})

export const makeTeamMeta = (td: Partial<Types.TeamMeta>): Types.TeamMeta =>
  td ? Object.assign({...emptyTeamMeta}, td) : emptyTeamMeta

export const getTeamMeta = (state: TypedState, teamID: Types.TeamID) =>
  teamID === Types.newTeamWizardTeamID
    ? makeTeamMeta({
        id: teamID,
        isMember: true,
        isOpen: state.teams.newTeamWizard.open,
        memberCount: 0,
        showcasing: state.teams.newTeamWizard.showcase,
        teamname: state.teams.newTeamWizard.name == '' ? 'New team' : state.teams.newTeamWizard.name,
      })
    : state.teams.teamMeta.get(teamID) ?? emptyTeamMeta

export const getTeamMemberLastActivity = (
  state: TypedState,
  teamID: Types.TeamID,
  username: string
): number | null => state.teams.teamMemberToLastActivity.get(teamID)?.get(username) ?? null

export const teamListToMeta = (
  list: Array<RPCTypes.AnnotatedMemberInfo>
): Map<Types.TeamID, Types.TeamMeta> => {
  return new Map(
    list.map(t => [
      t.teamID,
      {
        allowPromote: t.allowProfilePromote,
        id: t.teamID,
        isMember: t.role !== RPCTypes.TeamRole.none,
        isOpen: t.isOpenTeam,
        memberCount: t.memberCount,
        role: teamRoleByEnum[t.role] || 'none',
        showcasing: t.isMemberShowcased,
        teamname: t.fqName,
      },
    ])
  )
}

type InviteDetails = {inviteLinks: Array<Types.InviteLink>; invites: Set<Types.InviteInfo>}
const annotatedInvitesToInviteDetails = (
  annotatedInvites: Array<RPCTypes.AnnotatedTeamInvite> = []
): InviteDetails =>
  annotatedInvites.reduce<InviteDetails>(
    (invitesAndLinks, annotatedInvite) => {
      const inviteMD = annotatedInvite.inviteMetadata
      const teamInvite = inviteMD.invite

      const {invites, inviteLinks} = invitesAndLinks
      const role = teamRoleByEnum[teamInvite.role]
      if (!role || role === 'none') {
        return invitesAndLinks
      }

      if (annotatedInvite.inviteExt.c === RPCTypes.TeamInviteCategory.invitelink) {
        const ext = annotatedInvite.inviteExt.invitelink
        const annotatedUsedInvites = ext.annotatedUsedInvites ?? []
        const lastJoinedUsername = annotatedUsedInvites
          ? annotatedUsedInvites[annotatedUsedInvites.length - 1]?.username
          : undefined
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
        if (teamInvite.type.c === RPCTypes.TeamInviteCategory.sbs) {
          username = annotatedInvite.displayName
        }
        invites.add({
          email: teamInvite.type.c === RPCTypes.TeamInviteCategory.email ? annotatedInvite.displayName : '',
          id: teamInvite.id,
          name: [RPCTypes.TeamInviteCategory.seitan].includes(teamInvite.type.c)
            ? annotatedInvite.displayName
            : '',
          phone: teamInvite.type.c === RPCTypes.TeamInviteCategory.phone ? annotatedInvite.displayName : '',
          role,
          username,
        })
      }
      return invitesAndLinks
    },
    {inviteLinks: [], invites: new Set()}
  )

export const emptyTeamDetails: Types.TeamDetails = {
  description: '',
  inviteLinks: [],
  invites: new Set(),
  members: new Map(),
  requests: new Set(),
  settings: {open: false, openJoinAs: 'reader', tarsDisabled: false, teamShowcased: false},
  subteams: new Set(),
}

export const emptyTeamSettings = Object.freeze(emptyTeamDetails.settings)

export const getTeamDetails = (state: TypedState, teamID: Types.TeamID) =>
  state.teams.teamDetails.get(teamID) ?? emptyTeamDetails

export const annotatedTeamToDetails = (t: RPCTypes.AnnotatedTeam): Types.TeamDetails => {
  const maybeOpenJoinAs = teamRoleByEnum[t.settings.joinAs] ?? 'reader'
  const members = new Map<string, Types.MemberInfo>()
  t.members?.forEach(member => {
    const {fullName, needsPUK, status, username} = member
    const maybeRole = teamRoleByEnum[member.role]
    members.set(username, {
      fullName,
      joinTime: member.joinTime || undefined,
      needsPUK,
      status: rpcMemberStatusToStatus[status],
      type: !maybeRole || maybeRole === 'none' ? 'reader' : maybeRole,
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
    subteams: new Set(t.transitiveSubteamsUnverified?.entries?.map(e => e.teamID) ?? []),
  }
}

export const canShowcase = (state: TypedState, teamID: Types.TeamID) => {
  const role = getRole(state, teamID)
  return getTeamMeta(state, teamID).allowPromote || role === 'admin' || role === 'owner'
}

const _canUserPerformCache: {[key: string]: Types.TeamOperations} = {}
const _canUserPerformCacheKey = (t: Types.TeamRoleAndDetails) => t.role + t.implicitAdmin
export const deriveCanPerform = (roleAndDetails?: Types.TeamRoleAndDetails): Types.TeamOperations => {
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

export const getCanPerform = (state: TypedState, teamname: Types.Teamname): Types.TeamOperations =>
  getCanPerformByID(state, getTeamID(state, teamname))

export const getCanPerformByID = (state: TypedState, teamID: Types.TeamID): Types.TeamOperations =>
  deriveCanPerform(state.teams.teamRoleMap.roles.get(teamID))

// Don't allow version to roll back
export const ratchetTeamVersion = (newVersion: Types.TeamVersion, oldVersion?: Types.TeamVersion) =>
  oldVersion
    ? {
        latestHiddenSeqno: Math.max(newVersion.latestHiddenSeqno, oldVersion.latestHiddenSeqno),
        latestOffchainSeqno: Math.max(newVersion.latestOffchainSeqno, oldVersion.latestOffchainSeqno),
        latestSeqno: Math.max(newVersion.latestSeqno, oldVersion.latestSeqno),
      }
    : newVersion

export const dedupAddingMembeers = (
  _existing: Array<Types.AddingMember>,
  toAdds: Array<Types.AddingMember>
) => {
  const existing = [..._existing]
  for (const toAdd of toAdds) {
    if (!existing.find(m => m.assertion === toAdd.assertion)) {
      existing.unshift(toAdd)
    }
  }
  return existing
}

export const coerceAssertionRole = (mem: Types.AddingMember): Types.AddingMember => {
  if (mem.assertion.includes('@') && ['admin, owner'].includes(mem.role)) {
    return {...mem, role: 'writer'}
  }
  return mem
}

export const lastActiveStatusToActivityLevel: {
  [key in RPCChatTypes.LastActiveStatus]: Types.ActivityLevel
} = {
  [RPCChatTypes.LastActiveStatus.active]: 'active',
  [RPCChatTypes.LastActiveStatus.none]: 'none',
  [RPCChatTypes.LastActiveStatus.recentlyActive]: 'recently',
}

export const stringifyPeople = (people: string[]): string => {
  switch (people.length) {
    case 0:
      return 'nobody'
    case 1:
      return people[0]
    case 2:
      return `${people[0]} and ${people[1]}`
    case 3:
      return `${people[0]}, ${people[1]} and ${people[2]}`
    default:
      return `${people[0]}, ${people[1]}, and ${people.length - 2} others`
  }
}

export const consumeTeamTreeMembershipValue = (
  value: RPCTypes.TeamTreeMembershipValue
): Types.TreeloaderSparseMemberInfo => {
  return {
    joinTime: value.joinTime ?? undefined,
    type: teamRoleByEnum[value.role] || 'none',
  }
}

// maybeGetSparseMemberInfo first looks in the details, which should be kept up-to-date, then looks
// in the treeloader-powered map (which can go stale) as a backup. If it returns null, it means we
// don't know the answer (yet). If it returns type='none', that means the user is not in the team.
export const maybeGetSparseMemberInfo = (state: TypedState, teamID, username) => {
  const details = state.teams.teamDetails.get(teamID)
  if (details) {
    return details.members.get(username) ?? {type: 'none'}
  }
  return state.teams.treeLoaderTeamIDToSparseMemberInfos.get(teamID)?.get(username)
}

export const countValidInviteLinks = (inviteLinks: Array<Types.InviteLink>): Number => {
  return inviteLinks.reduce((t, inviteLink) => {
    if (inviteLink.isValid) {
      return t + 1
    }
    return t
  }, 0)
}

export const maybeGetMostRecentValidInviteLink = (inviteLinks: Array<Types.InviteLink>) =>
  inviteLinks.find(inviteLink => inviteLink.isValid)
