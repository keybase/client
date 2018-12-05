// @flow
import logger from '../logger'
import {map, last} from 'lodash-es'
import * as I from 'immutable'
import * as SearchGen from './search-gen'
import * as TeamsGen from './teams-gen'
import * as ProfileGen from './profile-gen'
import * as Types from '../constants/types/teams'
import * as Constants from '../constants/teams'
import * as ChatConstants from '../constants/chat2'
import * as ChatTypes from '../constants/types/chat2'
import * as SearchConstants from '../constants/search'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as RouteTreeGen from './route-tree-gen'
import * as NotificationsGen from './notifications-gen'
import * as ConfigGen from './config-gen'
import * as Chat2Gen from './chat2-gen'
import * as GregorGen from './gregor-gen'
import * as WaitingGen from './waiting-gen'
import engine from '../engine'
import {isMobile} from '../constants/platform'
import {chatTab, teamsTab} from '../constants/tabs'
import openSMS from '../util/sms'
import {convertToError, logError} from '../util/errors'

import type {RetentionPolicy} from '../constants/types/retention-policy'
import type {TypedState} from '../constants/reducer'

const _createNewTeam = function*(action: TeamsGen.CreateNewTeamPayload) {
  const {destSubPath, joinSubteam, rootPath, sourceSubPath, teamname} = action.payload
  yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
  try {
    yield Saga.call(
      RPCTypes.teamsTeamCreateRpcPromise,
      {
        joinSubteam,
        name: teamname,
      },
      Constants.teamCreationWaitingKey
    )

    // Dismiss the create team dialog.
    yield Saga.put(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: rootPath.concat(sourceSubPath),
        otherAction: RouteTreeGen.createNavigateTo({parentPath: rootPath, path: destSubPath}),
        parentPath: rootPath,
      })
    )

    // No error if we get here.
    yield Saga.all([
      Saga.put(
        RouteTreeGen.createNavigateTo({
          parentPath: isMobile ? [] : [teamsTab],
          path: isMobile ? [chatTab] : [{props: {teamname}, selected: 'team'}],
        })
      ),
      // Show the avatar editor on desktop.
      ...(!isMobile
        ? [
            Saga.put(
              RouteTreeGen.createNavigateAppend({
                path: [{props: {createdTeam: true, teamname}, selected: 'editTeamAvatar'}],
              })
            ),
          ]
        : []),
    ])
  } catch (error) {
    yield Saga.put(TeamsGen.createSetTeamCreationError({error: error.desc}))
  }
}

const _joinTeam = function*(action: TeamsGen.JoinTeamPayload) {
  const {teamname} = action.payload
  yield Saga.all([
    Saga.put(TeamsGen.createSetTeamJoinError({error: ''})),
    Saga.put(TeamsGen.createSetTeamJoinSuccess({success: false, teamname: ''})),
  ])
  try {
    const result = yield Saga.call(RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise, {
      tokenOrName: teamname,
    })

    // Success
    yield Saga.put(
      TeamsGen.createSetTeamJoinSuccess({
        success: true,
        teamname: result && result.wasTeamName ? teamname : '',
      })
    )
  } catch (error) {
    const desc =
      error.code === RPCTypes.constantsStatusCode.scteaminvitebadtoken
        ? 'Sorry, that team name or token is not valid.'
        : error.desc
    yield Saga.put(TeamsGen.createSetTeamJoinError({error: desc}))
  }
}

const _getTeamProfileAddList = function(state: TypedState, action: TeamsGen.GetTeamProfileAddListPayload) {
  const {username} = action.payload
  return RPCTypes.teamsTeamProfileAddListRpcPromise({username}, Constants.teamProfileAddListWaitingKey).then(
    res => {
      const teamlist =
        res &&
        res.map(team => ({
          disabledReason: team.disabledReason,
          open: team.open,
          teamName: team.teamName.parts ? team.teamName.parts.join('.') : '',
        }))
      if (teamlist) {
        teamlist.sort((a, b) => a.teamName.localeCompare(b.teamName))
      }
      return TeamsGen.createSetTeamProfileAddList({teamlist: I.List(teamlist || [])})
    }
  )
}

const _leaveTeam = function(state: TypedState, action: TeamsGen.LeaveTeamPayload) {
  const {context, teamname} = action.payload
  logger.info(`leaveTeam: Leaving ${teamname} from context ${context}`)
  return RPCTypes.teamsTeamLeaveRpcPromise(
    {
      name: teamname,
      permanent: false,
    },
    Constants.leaveTeamWaitingKey(teamname)
  ).then(() => {
    logger.info(`leaveTeam: left ${teamname} successfully`)
    return TeamsGen.createLeftTeam({context, teamname})
  })
}

const _leftTeam = (state: TypedState, action: TeamsGen.LeftTeamPayload) => {
  const selectedTeamnames = Constants.getSelectedTeamNames(state)
  if (selectedTeamnames.includes(action.payload.teamname)) {
    // Back out of that team's page
    return Saga.put(RouteTreeGen.createNavigateTo({parentPath: [teamsTab], path: []}))
  }
}

const _addPeopleToTeam = function*(action: TeamsGen.AddPeopleToTeamPayload) {
  const {destSubPath, role, rootPath, sendChatNotification, sourceSubPath, teamname} = action.payload
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  const state: TypedState = yield Saga.select()
  const ids = SearchConstants.getUserInputItemIds(state, 'addToTeamSearch').toArray()
  logger.info(`Adding ${ids.length} people to ${teamname}`)
  logger.info(`Adding ${ids.join(',')}`)
  try {
    yield Saga.call(RPCTypes.teamsTeamAddMembersRpcPromise, {
      assertions: ids,
      name: teamname,
      role:
        RPCTypes.teamsTeamRole[role] === undefined
          ? RPCTypes.teamsTeamRole.none
          : RPCTypes.teamsTeamRole[role],
      sendChatNotification,
    })
    // Success, dismiss the create team dialog and clear out search results
    logger.info(`Successfully added ${ids.length} users to ${teamname}`)
    yield Saga.put(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: rootPath.concat(sourceSubPath),
        otherAction: RouteTreeGen.createNavigateTo({parentPath: rootPath, path: destSubPath}),
        parentPath: rootPath,
      })
    )
    yield Saga.put(SearchGen.createClearSearchResults({searchKey: 'addToTeamSearch'}))
    yield Saga.put(SearchGen.createSetUserInputItems({searchKey: 'addToTeamSearch', searchResults: []}))
    yield Saga.put(TeamsGen.createSetTeamInviteError({error: ''}))
  } catch (error) {
    logger.error(`Error adding to ${teamname}: ${error.desc}`)
    // Some errors, leave the search results so user can figure out what happened
    logger.info(`Displaying addPeopleToTeam errors...`)
    yield Saga.put(TeamsGen.createSetTeamInviteError({error: error.desc}))
  }
  yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
}

const _getTeamRetentionPolicy = function*(action: TeamsGen.GetTeamRetentionPolicyPayload) {
  const {teamname} = action.payload
  const state: TypedState = yield Saga.select()
  const teamID = Constants.getTeamID(state, teamname)
  if (!teamID) {
    const errMsg = `getTeamRetentionPolicy: Unable to find teamID for teamname ${teamname}`
    logger.error(errMsg)
    return
  }
  const policy: RPCChatTypes.RetentionPolicy = yield Saga.call(
    RPCChatTypes.localGetTeamRetentionLocalRpcPromise,
    {teamID},
    Constants.teamWaitingKey(teamname)
  )
  let retentionPolicy: RetentionPolicy = Constants.makeRetentionPolicy()
  try {
    retentionPolicy = Constants.serviceRetentionPolicyToRetentionPolicy(policy)
    if (retentionPolicy.type === 'inherit') {
      throw new Error(`RPC returned retention policy of type 'inherit' for team policy`)
    }
  } catch (err) {
    logger.error(err.message)
    throw err
  } finally {
    yield Saga.put(TeamsGen.createSetTeamRetentionPolicy({retentionPolicy, teamname}))
  }
}

const _saveTeamRetentionPolicy = function(
  action: TeamsGen.SaveTeamRetentionPolicyPayload,
  state: TypedState
) {
  const {teamname, policy} = action.payload

  // get teamID
  const teamID = Constants.getTeamID(state, teamname)
  if (!teamID) {
    const errMsg = `saveTeamRetentionPolicy: Unable to find teamID for teamname ${teamname}`
    logger.error(errMsg)
    throw new Error(errMsg)
  }

  let servicePolicy: RPCChatTypes.RetentionPolicy
  try {
    servicePolicy = Constants.retentionPolicyToServiceRetentionPolicy(policy)
  } catch (err) {
    logger.error(err.message)
    throw err
  }
  return Saga.sequentially([
    Saga.put(
      WaitingGen.createIncrementWaiting({
        key: [Constants.teamWaitingKey(teamname), Constants.retentionWaitingKey(teamname)],
      })
    ),
    Saga.call(RPCChatTypes.localSetTeamRetentionLocalRpcPromise, {policy: servicePolicy, teamID}),
    Saga.put(
      WaitingGen.createDecrementWaiting({
        key: [Constants.teamWaitingKey(teamname), Constants.retentionWaitingKey(teamname)],
      })
    ),
  ])
}

const _updateTeamRetentionPolicy = function(
  action: Chat2Gen.UpdateTeamRetentionPolicyPayload,
  state: TypedState
) {
  const {convs} = action.payload
  if (convs.length === 0) {
    logger.warn('Got updateTeamRetentionPolicy with no convs; aborting. Local copy may be out of date')
    return
  }
  const {teamRetention, name} = convs[0]
  try {
    const newPolicy = Constants.serviceRetentionPolicyToRetentionPolicy(teamRetention)
    return Saga.put(TeamsGen.createSetTeamRetentionPolicy({retentionPolicy: newPolicy, teamname: name}))
  } catch (err) {
    logger.error(err.message)
    throw err
  }
}

const _inviteByEmail = function*(action: TeamsGen.InviteToTeamByEmailPayload) {
  const {destSubPath, invitees, role, rootPath, sourceSubPath, teamname} = action.payload
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.addToTeamByEmailWaitingKey(teamname)}))
  yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: true, teamname}))
  try {
    const res: RPCTypes.BulkRes = yield Saga.call(RPCTypes.teamsTeamAddEmailsBulkRpcPromise, {
      emails: invitees,
      name: teamname,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
    })
    if (res.malformed && res.malformed.length > 0) {
      const malformed = res.malformed
      logger.warn(`teamInviteByEmail: Unable to parse ${malformed.length} email addresses`)
      yield Saga.put(
        TeamsGen.createSetEmailInviteError({
          malformed,
          // mobile can only invite one at a time, show bad email in error message
          message: isMobile
            ? `Error parsing email: ${malformed[0]}`
            : `There was an error parsing ${malformed.length} address${malformed.length > 1 ? 'es' : ''}.`,
        })
      )
    } else {
      // no malformed emails, assume everything went swimmingly
      yield Saga.put(
        TeamsGen.createSetEmailInviteError({
          malformed: [],
          message: '',
        })
      )
      if (!isMobile) {
        yield Saga.put(
          RouteTreeGen.createPutActionIfOnPath({
            expectedPath: rootPath.concat(sourceSubPath),
            otherAction: RouteTreeGen.createNavigateTo({parentPath: rootPath, path: destSubPath}),
            parentPath: rootPath,
          })
        )
      }
    }
  } catch (err) {
    // other error. display messages and leave all emails in input box
    yield Saga.put(TeamsGen.createSetEmailInviteError({malformed: [], message: err.desc}))
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.addToTeamByEmailWaitingKey(teamname)}))
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: false, teamname}))
  }
}

const _addToTeam = function*(action: TeamsGen.AddToTeamPayload) {
  const {teamname, username, role, sendChatNotification} = action.payload
  const waitingKeys = [Constants.teamWaitingKey(teamname), Constants.addMemberWaitingKey(teamname, username)]
  yield Saga.put(WaitingGen.createIncrementWaiting({key: waitingKeys}))
  try {
    yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
      email: '',
      name: teamname,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      sendChatNotification,
      username,
    })
  } catch (e) {
    // identify error
    if (e.code === RPCTypes.constantsStatusCode.scidentifysummaryerror) {
      if (isMobile) {
        // show profile card on mobile
        yield Saga.put(ProfileGen.createShowUserProfile({username}))
      }
    }
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: waitingKeys}))
  }
}

const _editDescription = function*(action: TeamsGen.EditTeamDescriptionPayload) {
  const {teamname, description} = action.payload
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    yield Saga.call(RPCTypes.teamsSetTeamShowcaseRpcPromise, {
      description,
      name: teamname,
    })
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
    // TODO We don't get a team changed notification for this. Delete this call when CORE-7125 is finished.
    yield Saga.put(TeamsGen.createGetDetails({teamname}))
  }
}

function _uploadAvatar(action: TeamsGen.UploadTeamAvatarPayload) {
  const {crop, filename, sendChatNotification, teamname} = action.payload
  return Saga.sequentially([
    Saga.call(RPCTypes.teamsUploadTeamAvatarRpcPromise, {
      crop,
      filename,
      sendChatNotification,
      teamname,
    }),
    Saga.put(RouteTreeGen.createNavigateUp()),
  ])
}

const _editMembership = function*(action: TeamsGen.EditMembershipPayload) {
  const {teamname, username, role} = action.payload
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    yield Saga.call(RPCTypes.teamsTeamEditMemberRpcPromise, {
      name: teamname,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      username,
    })
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  }
}

const _removeMemberOrPendingInvite = function*(action: TeamsGen.RemoveMemberOrPendingInvitePayload) {
  const {teamname, username, email, inviteID} = action.payload

  const invitees = username || email || inviteID
  yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: true, teamname}))

  // disallow call with any pair of username, email, and ID to avoid black-bar errors
  if ((!!username && !!email) || (!!username && !!inviteID) || (!!email && !!inviteID)) {
    const errMsg = 'Supplied more than one form of identification to removeMemberOrPendingInvite'
    logger.error(errMsg)
    throw new Error(errMsg)
  }

  // only one of (username, email, inviteID) is truth-y
  const waitingKeys = [
    Constants.teamWaitingKey(teamname),
    Constants.removeMemberWaitingKey(teamname, username || email || inviteID),
  ]
  yield Saga.put(WaitingGen.createIncrementWaiting({key: waitingKeys}))
  try {
    yield Saga.call(RPCTypes.teamsTeamRemoveMemberRpcPromise, {email, inviteID, name: teamname, username})
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: waitingKeys}))
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: false, teamname}))
  }
}

const generateSMSBody = (teamname: string, seitan: string): string => {
  // seitan is 18chars
  // message sans teamname is 118chars. Teamname can be 33 chars before we truncate to 25 and pre-ellipsize
  let team
  const teamOrSubteam = teamname.includes('.') ? 'subteam' : 'team'
  if (teamname.length <= 33) {
    team = `${teamname} ${teamOrSubteam}`
  } else {
    team = `..${teamname.substring(teamname.length - 30)} subteam`
  }
  return `Join the ${team} on Keybase. Copy this message into the "Teams" tab.\n\ntoken: ${seitan.toLowerCase()}\n\ninstall: keybase.io/_/go`
}

const _inviteToTeamByPhone = function*(action: TeamsGen.InviteToTeamByPhonePayload) {
  const {teamname, role, phoneNumber, fullName = ''} = action.payload
  const seitan = yield Saga.call(RPCTypes.teamsTeamCreateSeitanTokenV2RpcPromise, {
    label: {sms: ({f: fullName || '', n: phoneNumber}: RPCTypes.SeitanKeyLabelSms), t: 1},
    name: teamname,
    role: (!!role && RPCTypes.teamsTeamRole[role]) || 0,
  })

  /* Open SMS */
  const bodyText = generateSMSBody(teamname, seitan)
  openSMS([phoneNumber], bodyText).catch(err => logger.info('Error sending SMS', err))

  yield Saga.put(TeamsGen.createGetDetails({teamname}))
}

const _ignoreRequest = function*(action: TeamsGen.IgnoreRequestPayload) {
  const {teamname, username} = action.payload
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    yield Saga.call(RPCTypes.teamsTeamIgnoreRequestRpcPromise, {
      name: teamname,
      username,
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
    // TODO get rid of this once core sends us a notification for this (CORE-7125)
    yield Saga.put(TeamsGen.createGetDetails({teamname})) // getDetails will unset loading
  }
}

const _createNewTeamFromConversation = function*(
  action: TeamsGen.CreateNewTeamFromConversationPayload
): Saga.SagaGenerator<any, any> {
  const {conversationIDKey, teamname} = action.payload
  const state: TypedState = yield Saga.select()
  const me = state.config.username
  let participants: Array<string> = []

  const meta = ChatConstants.getMeta(state, conversationIDKey)
  participants = meta.participants.toArray()

  if (participants) {
    yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
    try {
      const createRes = yield Saga.call(
        RPCTypes.teamsTeamCreateRpcPromise,
        {
          joinSubteam: false,
          name: teamname,
        },
        Constants.teamCreationWaitingKey
      )
      for (const username of participants) {
        if (!createRes.creatorAdded || username !== me) {
          yield Saga.call(
            RPCTypes.teamsTeamAddMemberRpcPromise,
            {
              email: '',
              name: teamname,
              role: username === me ? RPCTypes.teamsTeamRole.admin : RPCTypes.teamsTeamRole.writer,
              sendChatNotification: true,
              username,
            },
            Constants.teamCreationWaitingKey
          )
        }
      }
      yield Saga.put(Chat2Gen.createPreviewConversation({reason: 'convertAdHoc', teamname}))
    } catch (error) {
      yield Saga.put(TeamsGen.createSetTeamCreationError({error: error.desc}))
    }
  }
}

const _getDetails = function*(action: TeamsGen.GetDetailsPayload): Saga.SagaGenerator<any, any> {
  const {teamname} = action.payload
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  yield Saga.put(TeamsGen.createGetTeamOperations({teamname}))
  yield Saga.put(TeamsGen.createGetTeamPublicity({teamname}))
  try {
    const unsafeDetails: RPCTypes.TeamDetails = yield Saga.call(RPCTypes.teamsTeamGetRpcPromise, {
      name: teamname,
    })

    // Don't allow the none default
    const details: RPCTypes.TeamDetails = {
      ...unsafeDetails,
      settings: {
        ...unsafeDetails.settings,
        joinAs:
          unsafeDetails.settings.joinAs === RPCTypes.teamsTeamRole.none
            ? RPCTypes.teamsTeamRole.reader
            : unsafeDetails.settings.joinAs,
      },
    }

    // Get requests to join
    let requests: RPCTypes.TeamJoinRequest[] = []
    const state = yield Saga.select()
    if (Constants.getCanPerform(state, teamname).manageMembers) {
      // TODO (DESKTOP-6478) move this somewhere else
      requests = yield Saga.call(RPCTypes.teamsTeamListRequestsRpcPromise, {
        teamName: teamname,
      })
    }
    requests.sort((a, b) => a.username.localeCompare(b.username))

    const requestMap = requests.reduce((reqMap, req) => {
      if (!reqMap[req.name]) {
        reqMap[req.name] = I.Set()
      }
      reqMap[req.name] = reqMap[req.name].add(Constants.makeRequestInfo({username: req.username}))
      return reqMap
    }, {})

    const infos = []
    const types: Types.TeamRoleType[] = ['reader', 'writer', 'admin', 'owner']
    const typeToKey: Types.TypeMap = {
      admin: 'admins',
      owner: 'owners',
      reader: 'readers',
      writer: 'writers',
    }
    types.forEach(type => {
      const key = typeToKey[type]
      const members: Array<RPCTypes.TeamMemberDetails> = details.members[key] || []
      members.forEach(({fullName, status, username}) => {
        infos.push([
          username,
          Constants.makeMemberInfo({
            fullName,
            status: Constants.rpcMemberStatusToStatus[status],
            type,
            username,
          }),
        ])
      })
    })

    const invites = map(details.annotatedActiveInvites, (invite: RPCTypes.AnnotatedTeamInvite) => {
      const role = Constants.teamRoleByEnum[invite.role]
      if (role === 'none') {
        return null
      }
      const username = (() => {
        const t = invite.type
        if (t.c !== RPCTypes.teamsTeamInviteCategory.sbs) {
          return ''
        }
        const sbs: RPCTypes.TeamInviteSocialNetwork = t.sbs || ''
        return `${invite.name}@${sbs}`
      })()
      return Constants.makeInviteInfo({
        email: invite.type.c === RPCTypes.teamsTeamInviteCategory.email ? invite.name : '',
        id: invite.id,
        name: invite.type.c === RPCTypes.teamsTeamInviteCategory.seitan ? invite.name : '',
        role,
        username,
      })
    }).filter(Boolean)

    // if we have no requests for this team, make sure we don't hold on to any old ones
    if (!requestMap[teamname]) {
      yield Saga.put(TeamsGen.createClearTeamRequests({teamname}))
    }

    // Get the subteam map for this team.
    const teamTree = yield Saga.call(RPCTypes.teamsTeamTreeRpcPromise, {
      name: {parts: teamname.split('.')},
    })
    const subteams = teamTree.entries
      .map(team => team.name.parts.join('.'))
      .filter(team => team !== teamname && team.startsWith(teamname))

    yield Saga.put(
      TeamsGen.createSetTeamDetails({
        invites: I.Set(invites),
        members: I.Map(infos),
        requests: I.Map(requestMap),
        settings: Constants.makeTeamSettings(details.settings),
        subteams: I.Set(subteams),
        teamname,
      })
    )
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  }
}

function _getDetailsForAllTeams(action: TeamsGen.GetDetailsForAllTeamsPayload, state: TypedState) {
  const actions = state.teams.teamnames
    .toArray()
    .map(teamname => Saga.put(TeamsGen.createGetDetails({teamname})))
  return Saga.sequentially(actions)
}

function* _addUserToTeams(action: TeamsGen.AddUserToTeamsPayload, state: TypedState) {
  const {role, teams, user} = action.payload
  const teamsAddedTo = []
  const errorAddingTo = []
  for (const team of teams) {
    try {
      yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
        email: '',
        name: team,
        role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
        sendChatNotification: true,
        username: user,
      })
      teamsAddedTo.push(team)
    } catch (error) {
      errorAddingTo.push(team)
    }
  }

  // TODO: We should split these results into two messages, showing one in green and
  // the other in red instead of lumping them together.

  let result = ''

  if (teamsAddedTo.length) {
    result += `${user} was added to `
    if (teamsAddedTo.length > 3) {
      result += `${teamsAddedTo[0]}, ${teamsAddedTo[1]}, and ${teamsAddedTo.length - 2} teams.`
    } else if (teamsAddedTo.length === 3) {
      result += `${teamsAddedTo[0]}, ${teamsAddedTo[1]}, and ${teamsAddedTo[2]}.`
    } else if (teamsAddedTo.length === 2) {
      result += `${teamsAddedTo[0]} and ${teamsAddedTo[1]}.`
    } else {
      result += `${teamsAddedTo[0]}.`
    }
  }

  if (errorAddingTo.length) {
    if (result.length > 0) {
      result += ' But we '
    } else {
      result += 'We '
    }
    result += `were unable to add ${user} to ${errorAddingTo.join(', ')}.`
  }

  yield Saga.put(TeamsGen.createSetAddUserToTeamsResults({results: result}))
}

const _getTeamOperations = function*(
  action: TeamsGen.GetTeamOperationsPayload
): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname

  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    const teamOperation = yield Saga.call(RPCTypes.teamsCanUserPerformRpcPromise, {
      name: teamname,
    })
    yield Saga.put(TeamsGen.createSetTeamCanPerform({teamOperation, teamname}))
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  }
}

const _getTeamPublicity = function*(action: TeamsGen.GetTeamPublicityPayload): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  // Get publicity settings for this team.
  const publicity: RPCTypes.TeamAndMemberShowcase = yield Saga.call(
    RPCTypes.teamsGetTeamAndMemberShowcaseRpcPromise,
    {
      name: teamname,
    }
  )

  let tarsDisabled = false
  // can throw if you're not an admin
  try {
    tarsDisabled = yield Saga.call(RPCTypes.teamsGetTarsDisabledRpcPromise, {
      name: teamname,
    })
  } catch (_) {}

  const publicityMap = {
    anyMemberShowcase: publicity.teamShowcase.anyMemberShowcase,
    description: publicity.teamShowcase.description || '',
    ignoreAccessRequests: tarsDisabled,
    member: publicity.isMemberShowcased,
    team: publicity.teamShowcase.isShowcased,
  }

  yield Saga.put(TeamsGen.createSetTeamPublicitySettings({publicity: publicityMap, teamname}))
  yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
}

function _getChannelInfo(action: TeamsGen.GetChannelInfoPayload) {
  const {teamname, conversationIDKey} = action.payload
  // TODO promise
  return Saga.all([
    Saga.call(RPCChatTypes.localGetInboxAndUnboxUILocalRpcPromise, {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      query: ChatConstants.makeInboxQuery([conversationIDKey]),
    }),
    Saga.call(() => teamname),
    Saga.call(() => conversationIDKey),
  ])
}

function _afterGetChannelInfo(fromGetChannelInfo: any[]) {
  const results: RPCChatTypes.GetInboxAndUnboxUILocalRes = fromGetChannelInfo[0]
  const teamname: string = fromGetChannelInfo[1]
  const conversationIDKey: ChatTypes.ConversationIDKey = fromGetChannelInfo[2]
  const convs = results.conversations || []
  if (convs.length !== 1) {
    logger.warn(`Could not get channel info`)
    return
  }

  const meta = ChatConstants.inboxUIItemToConversationMeta(convs[0])
  if (!meta) {
    logger.warn('Could not convert channel info to meta')
    return
  }

  const channelInfo = Constants.makeChannelInfo({
    channelname: meta.channelname,
    description: meta.description,
    participants: meta.participants.toSet(),
  })
  return Saga.put(TeamsGen.createSetTeamChannelInfo({channelInfo, conversationIDKey, teamname}))
}

function _getChannels(action: TeamsGen.GetChannelsPayload) {
  const teamname = action.payload.teamname
  const waitingKey = {key: Constants.getChannelsWaitingKey(teamname)}
  return Saga.all([
    Saga.call(RPCChatTypes.localGetTLFConversationsLocalRpcPromise, {
      membersType: RPCChatTypes.commonConversationMembersType.team,
      tlfName: teamname,
      topicType: RPCChatTypes.commonTopicType.chat,
    }),
    // TODO promise
    Saga.call(() => teamname),
    Saga.call(() => waitingKey),
    Saga.put(WaitingGen.createIncrementWaiting(waitingKey)),
  ])
}

function _afterGetChannels(fromGetChannels: any[]) {
  const results: RPCChatTypes.GetTLFConversationsLocalRes = fromGetChannels[0]
  const teamname: string = fromGetChannels[1]
  const waitingKey: {|key: string|} = fromGetChannels[2]

  const convs = results.convs || []
  const channelInfos: {[ChatTypes.ConversationIDKey]: Types.ChannelInfo} = {}
  convs.forEach(conv => {
    const convID = ChatTypes.stringToConversationIDKey(conv.convID)
    channelInfos[convID] = Constants.makeChannelInfo({
      channelname: conv.channel,
      description: conv.headline,
      participants: I.Set(conv.participants || []),
    })
  })

  return Saga.all([
    Saga.put(TeamsGen.createSetTeamChannels({channelInfos: I.Map(channelInfos), teamname})),
    Saga.put(WaitingGen.createDecrementWaiting(waitingKey)),
  ])
}

const getTeams = (state: TypedState) =>
  Saga.call(function*() {
    const username = state.config.username
    if (!username) {
      logger.warn('getTeams while logged out')
      return
    }
    yield Saga.put(TeamsGen.createSetLoaded({loaded: false}))
    try {
      const results: RPCTypes.AnnotatedTeamList = yield Saga.call(
        RPCTypes.teamsTeamListUnverifiedRpcPromise,
        {
          includeImplicitTeams: false,
          userAssertion: username,
        }
      )

      const teams = results.teams || []
      const teamnames = []
      const teammembercounts = {}
      const teamNameToRole: {[Types.Teamname]: Types.MaybeTeamRoleType} = {}
      const teamNameToIsOpen = {}
      const teamNameToAllowPromote = {}
      const teamNameToIsShowcasing = {}
      const teamNameToID = {}
      teams.forEach(team => {
        teamnames.push(team.fqName)
        teammembercounts[team.fqName] = team.memberCount
        teamNameToRole[team.fqName] = Constants.teamRoleByEnum[team.role]
        teamNameToIsOpen[team.fqName] = team.isOpenTeam
        teamNameToAllowPromote[team.fqName] = team.allowProfilePromote
        teamNameToIsShowcasing[team.fqName] = team.isMemberShowcased
        teamNameToID[team.fqName] = team.teamID
      })

      // Dismiss any stale badges for teams we're no longer in
      const teamResetUsers = state.teams.getIn(['teamNameToResetUsers'], I.Map())
      const teamNameSet = I.Set(teamnames)
      const dismissIDs = teamResetUsers.reduce((ids, value: I.Set<Types.ResetUser>, key: string) => {
        if (!teamNameSet.has(key)) {
          ids.push(...value.toArray().map(ru => ru.badgeIDKey))
        }
        return ids
      }, [])
      yield Saga.all(
        dismissIDs.map(id =>
          Saga.call(RPCTypes.gregorDismissItemRpcPromise, {id: Constants.keyToResetUserBadgeID(id)})
        )
      )

      yield Saga.put(
        TeamsGen.createSetTeamInfo({
          teamNameToAllowPromote: I.Map(teamNameToAllowPromote),
          teamNameToID: I.Map(teamNameToID),
          teamNameToIsOpen: I.Map(teamNameToIsOpen),
          teamNameToIsShowcasing: I.Map(teamNameToIsShowcasing),
          teamNameToRole: I.Map(teamNameToRole),
          teammembercounts: I.Map(teammembercounts),
          teamnames: teamNameSet,
        })
      )
    } catch (err) {
      if (err.code === RPCTypes.constantsStatusCode.scapinetworkerror) {
        // Ignore API errors due to offline
      } else {
        throw err
      }
    } finally {
      yield Saga.put(TeamsGen.createSetLoaded({loaded: true}))
    }
  })

const _checkRequestedAccess = (action: TeamsGen.CheckRequestedAccessPayload) =>
  Saga.call(RPCTypes.teamsTeamListMyAccessRequestsRpcPromise, {})

function _checkRequestedAccessSuccess(result) {
  const teams = (result || []).map(row => row.parts.join('.'))
  return Saga.put(TeamsGen.createSetTeamAccessRequestsPending({accessRequestsPending: I.Set(teams)}))
}

const _joinConversation = function*(
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
  participant: string
) {
  try {
    const convID = ChatTypes.keyToConversationID(conversationIDKey)
    yield Saga.call(RPCChatTypes.localJoinConversationByIDLocalRpcPromise, {
      convID,
    })
    yield Saga.put(
      TeamsGen.createAddParticipant({
        conversationIDKey,
        participant,
        teamname,
      })
    )
  } catch (error) {
    yield Saga.put(ConfigGen.createGlobalError({globalError: convertToError(error)}))
  }
}

const _leaveConversation = function*(
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
  participant: string
) {
  try {
    const convID = ChatTypes.keyToConversationID(conversationIDKey)
    yield Saga.call(RPCChatTypes.localLeaveConversationLocalRpcPromise, {
      convID,
    })
    yield Saga.put(
      TeamsGen.createRemoveParticipant({
        conversationIDKey,
        participant,
        teamname,
      })
    )
  } catch (error) {
    yield Saga.put(ConfigGen.createGlobalError({globalError: convertToError(error)}))
  }
}

const _saveChannelMembership = function(action: TeamsGen.SaveChannelMembershipPayload, state: TypedState) {
  const {teamname, oldChannelState, newChannelState} = action.payload

  const calls = []
  for (const convIDKeyStr in newChannelState) {
    const convIDKey = ChatTypes.stringToConversationIDKey(convIDKeyStr)
    if (oldChannelState[convIDKey] === newChannelState[convIDKey]) {
      continue
    }

    if (newChannelState[convIDKey]) {
      calls.push(Saga.call(_joinConversation, teamname, convIDKey, action.payload.you))
    } else {
      calls.push(Saga.call(_leaveConversation, teamname, convIDKey, action.payload.you))
    }
  }

  return Saga.all(calls)
}

function* _createChannel(action: TeamsGen.CreateChannelPayload) {
  const {channelname, description, teamname, rootPath, sourceSubPath, destSubPath} = action.payload
  yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.createChannelWaitingKey(teamname)}))
  try {
    const result = yield Saga.call(RPCChatTypes.localNewConversationLocalRpcPromise, {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      membersType: RPCChatTypes.commonConversationMembersType.team,
      tlfName: teamname,
      tlfVisibility: RPCTypes.commonTLFVisibility.private,
      topicName: channelname,
      topicType: RPCChatTypes.commonTopicType.chat,
    })

    // No error if we get here.
    const newConversationIDKey = result ? ChatTypes.conversationIDToKey(result.conv.info.id) : null
    if (!newConversationIDKey) {
      logger.warn('No convoid from newConvoRPC')
      return null
    }

    // If we were given a description, set it
    if (description) {
      yield Saga.call(RPCChatTypes.localPostHeadlineNonblockRpcPromise, {
        clientPrev: 0,
        conversationID: result.conv.info.id,
        headline: description,
        identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
        tlfName: teamname,
        tlfPublic: false,
      })
    }

    // Dismiss the create channel dialog.
    yield Saga.put(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: rootPath.concat(sourceSubPath),
        otherAction: RouteTreeGen.createNavigateTo({parentPath: rootPath, path: destSubPath}),
        parentPath: rootPath,
      })
    )

    // Select the new channel, and switch to the chat tab.
    yield Saga.put(
      Chat2Gen.createPreviewConversation({
        channelname,
        conversationIDKey: newConversationIDKey,
        reason: 'newChannel',
        teamname,
      })
    )
  } catch (error) {
    yield Saga.put(TeamsGen.createSetChannelCreationError({error: error.desc}))
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.createChannelWaitingKey(teamname)}))
  }
}

const _setMemberPublicity = function*(action: TeamsGen.SetMemberPublicityPayload, state: TypedState) {
  const {teamname, showcase} = action.payload
  yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.teamWaitingKey(teamname)}))
  try {
    yield Saga.call(RPCTypes.teamsSetTeamMemberShowcaseRpcPromise, {
      isShowcased: showcase,
      name: teamname,
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.teamWaitingKey(teamname)}))
    yield Saga.put(TeamsGen.createGetDetails({teamname}))

    // The profile showcasing page gets this data from teamList rather than teamGet, so trigger one of those too.
    yield Saga.put(TeamsGen.createGetTeams())
  }
}

const _setPublicity = function(state: TypedState, action: TeamsGen.SetPublicityPayload) {
  return Saga.call(function*() {
    const {teamname, settings} = action.payload
    const waitingKey = Constants.settingsWaitingKey(teamname)

    const teamSettings = state.teams.getIn(
      ['teamNameToSettings', teamname],
      Constants.makeTeamSettings({
        joinAs: RPCTypes.teamsTeamRole['reader'],
        open: false,
      })
    )

    const teamPublicitySettings = Constants.getTeamPublicitySettings(state, teamname)

    const ignoreAccessRequests = teamPublicitySettings.ignoreAccessRequests
    const openTeam = teamSettings.open
    const openTeamRole = Constants.teamRoleByEnum[teamSettings.joinAs]
    const publicityAnyMember = teamPublicitySettings.anyMemberShowcase
    const publicityMember = teamPublicitySettings.member
    const publicityTeam = teamPublicitySettings.team

    const calls = []
    if (openTeam !== settings.openTeam || (settings.openTeam && openTeamRole !== settings.openTeamRole)) {
      calls.push(
        Saga.call(function*() {
          return RPCTypes.teamsTeamSetSettingsRpcPromise(
            {
              name: teamname,
              settings: {
                joinAs: RPCTypes.teamsTeamRole[settings.openTeamRole],
                open: settings.openTeam,
              },
            },
            waitingKey
          )
            .then(payload => ({payload, type: 'ok'}))
            .catch(payload => ({payload, type: 'error'}))
        })
      )
    }
    if (ignoreAccessRequests !== settings.ignoreAccessRequests) {
      calls.push(
        Saga.call(function*() {
          return RPCTypes.teamsSetTarsDisabledRpcPromise(
            {
              disabled: settings.ignoreAccessRequests,
              name: teamname,
            },
            waitingKey
          )
            .then(payload => ({payload, type: 'ok'}))
            .catch(payload => ({payload, type: 'error'}))
        })
      )
    }
    if (publicityAnyMember !== settings.publicityAnyMember) {
      calls.push(
        Saga.call(function*() {
          return RPCTypes.teamsSetTeamShowcaseRpcPromise(
            {
              anyMemberShowcase: settings.publicityAnyMember,
              name: teamname,
            },
            waitingKey
          )
            .then(payload => ({payload, type: 'ok'}))
            .catch(payload => ({payload, type: 'error'}))
        })
      )
    }
    if (publicityMember !== settings.publicityMember) {
      calls.push(
        Saga.call(function*() {
          return RPCTypes.teamsSetTeamMemberShowcaseRpcPromise(
            {
              isShowcased: settings.publicityMember,
              name: teamname,
            },
            waitingKey
          )
            .then(payload => ({payload, type: 'ok'}))
            .catch(payload => ({payload, type: 'error'}))
        })
      )
    }
    if (publicityTeam !== settings.publicityTeam) {
      calls.push(
        Saga.call(function*() {
          return RPCTypes.teamsSetTeamShowcaseRpcPromise(
            {
              isShowcased: settings.publicityTeam,
              name: teamname,
            },
            waitingKey
          )
            .then(payload => ({payload, type: 'ok'}))
            .catch(payload => ({payload, type: 'error'}))
        })
      )
    }

    const results = yield Saga.all(calls)
    // TODO delete this getDetails call when CORE-7125 is finished
    Saga.put(TeamsGen.createGetDetails({teamname}))

    // Display any errors from the rpcs
    const errs = results
      .filter(r => r.type === 'error')
      .map(({payload}) => Saga.put(ConfigGen.createGlobalError({globalError: convertToError(payload)})))
    yield Saga.all(errs)
  })
}

// This is to simplify the changes that setIncomingCallMap created. Could clean this up and remove this
const arrayOfActionsToSequentially = actions =>
  Saga.call(Saga.sequentially, (actions || []).map(a => Saga.put(a)))

const setupEngineListeners = () => {
  engine().setIncomingCallMap({
    'keybase.1.NotifyTeam.avatarUpdated': ({name, formats, typ}) =>
      Saga.call(function*() {
        switch (typ) {
          case RPCTypes.notifyTeamAvatarUpdateType.none:
            // don't know what it is, so try both
            yield Saga.put(ConfigGen.createLoadTeamAvatars({teamnames: [name]}))
            yield Saga.put(ConfigGen.createLoadAvatars({usernames: [name]}))
            break
          case RPCTypes.notifyTeamAvatarUpdateType.user:
            yield Saga.put(ConfigGen.createLoadAvatars({usernames: [name]}))
            break
          case RPCTypes.notifyTeamAvatarUpdateType.team:
            yield Saga.put(ConfigGen.createLoadTeamAvatars({teamnames: [name]}))
            break
        }
      }),
    'keybase.1.NotifyTeam.teamChangedByName': param =>
      Saga.call(function*() {
        logger.info(`Got teamChanged for ${param.teamName} from service`)
        const state = yield Saga.select()
        const selectedTeamNames = Constants.getSelectedTeamNames(state)
        if (selectedTeamNames.includes(param.teamName)) {
          // only reload if that team is selected
          yield arrayOfActionsToSequentially(getLoadCalls(param.teamName))
        }
        yield arrayOfActionsToSequentially(getLoadCalls())
      }),
    'keybase.1.NotifyTeam.teamDeleted': param =>
      Saga.call(function*() {
        const state = yield Saga.select()
        const {teamID} = param
        const selectedTeamNames = Constants.getSelectedTeamNames(state)
        if (selectedTeamNames.includes(Constants.getTeamNameFromID(state, teamID))) {
          yield arrayOfActionsToSequentially([
            RouteTreeGen.createNavigateTo({parentPath: [teamsTab], path: []}),
            ...getLoadCalls(),
          ])
        }
        yield arrayOfActionsToSequentially(getLoadCalls())
      }),
    'keybase.1.NotifyTeam.teamExit': param =>
      Saga.call(function*() {
        const state = yield Saga.select()
        const {teamID} = param
        const selectedTeamNames = Constants.getSelectedTeamNames(state)
        if (selectedTeamNames.includes(Constants.getTeamNameFromID(state, teamID))) {
          yield arrayOfActionsToSequentially([
            RouteTreeGen.createNavigateTo({parentPath: [teamsTab], path: []}),
            ...getLoadCalls(),
          ])
        }
        yield arrayOfActionsToSequentially(getLoadCalls())
      }),
  })
}

function getLoadCalls(teamname?: string) {
  const actions = []
  if (_wasOnTeamsTab) {
    actions.push(TeamsGen.createGetTeams())
    if (teamname) {
      actions.push(TeamsGen.createGetDetails({teamname}))
    }
  }
  return actions
}

function _updateTopic(action: TeamsGen.UpdateTopicPayload, state: TypedState) {
  const {teamname, conversationIDKey, newTopic} = action.payload
  const param = {
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    headline: newTopic,
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    tlfName: teamname,
    tlfPublic: false,
  }

  return Saga.all([
    Saga.call(RPCChatTypes.localPostHeadlineRpcPromise, param),
    Saga.put(TeamsGen.createSetUpdatedTopic({conversationIDKey, newTopic, teamname})),
  ])
}

function* _addTeamWithChosenChannels(action: TeamsGen.AddTeamWithChosenChannelsPayload) {
  const state = yield Saga.select()
  const existingTeams = state.teams.teamsWithChosenChannels
  const {teamname} = action.payload
  if (state.teams.teamsWithChosenChannels.has(teamname)) {
    // we've already dismissed for this team and we already know about it, bail
    return
  }
  const logPrefix = `[addTeamWithChosenChannels]:${teamname}`
  let pushState
  try {
    pushState = yield Saga.call(RPCTypes.gregorGetStateRpcPromise)
  } catch (err) {
    // failure getting the push state, don't bother the user with an error
    // and don't try to move forward updating the state
    logger.error(`${logPrefix} error fetching gregor state: ${err}`)
    return
  }
  const item = pushState.items.find(i => i.item.category === Constants.chosenChannelsGregorKey)
  let teams = []
  let msgID
  if (item && item.item && item.item.body) {
    const body = item.item.body
    msgID = item.md.msgID
    teams = JSON.parse(body.toString())
  } else {
    logger.info(
      `${logPrefix} No item in gregor state found, making new item. Total # of items: ${
        pushState.items.length
      }`
    )
  }
  if (existingTeams.size > teams.length) {
    // Bad - we don't have an accurate view of things. Log and bail
    logger.warn(
      `${logPrefix} Existing list longer than list in gregor state, got list with length ${
        teams.length
      } when we have ${existingTeams.size} already. Bailing on update.`
    )
    return
  }
  teams.push(teamname)
  // make sure there're no dupes
  teams = I.Set(teams).toArray()

  const dtime = {
    offset: 0,
    time: 0,
  }
  // update if exists, else create
  if (msgID) {
    logger.info(`${logPrefix} Updating teamsWithChosenChannels`)
  } else {
    logger.info(`${logPrefix} Creating teamsWithChosenChannels`)
  }
  yield Saga.call(RPCTypes.gregorUpdateCategoryRpcPromise, {
    body: JSON.stringify(teams),
    category: Constants.chosenChannelsGregorKey,
    dtime,
  })
}

function _updateChannelname(action: TeamsGen.UpdateChannelNamePayload, state: TypedState) {
  const {teamname, conversationIDKey, newChannelName} = action.payload
  const param = {
    channelName: newChannelName,
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    tlfName: teamname,
    tlfPublic: false,
  }

  return Saga.sequentially([
    Saga.call(RPCChatTypes.localPostMetadataRpcPromise, param),
    Saga.put(TeamsGen.createSetUpdatedChannelName({conversationIDKey, newChannelName, teamname})),
  ])
}

function _deleteChannelConfirmed(action: TeamsGen.DeleteChannelConfirmedPayload, state: TypedState) {
  const {teamname, conversationIDKey} = action.payload
  return Saga.sequentially([
    // channelName is only needed for confirmation, so since we handle
    // confirmation ourselves we don't need to plumb it through.
    Saga.call(RPCChatTypes.localDeleteConversationLocalRpcPromise, {
      channelName: '',
      confirmed: true,
      convID: ChatTypes.keyToConversationID(conversationIDKey),
    }),
    Saga.put(TeamsGen.createDeleteChannelInfo({conversationIDKey, teamname})),
  ])
}

function _badgeAppForTeams(action: TeamsGen.BadgeAppForTeamsPayload, state: TypedState) {
  const loggedIn = state.config.loggedIn
  if (!loggedIn) {
    // Don't make any calls we don't have permission to.
    return
  }

  const actions = []
  const newTeams = I.Set(action.payload.newTeamNames || [])
  const newTeamRequests = I.List(action.payload.newTeamAccessRequests || [])

  const teamsWithResetUsers = I.List(action.payload.teamsWithResetUsers || [])
  const teamsWithResetUsersMap = teamsWithResetUsers.reduce((res, entry) => {
    if (!res[entry.teamname]) {
      res[entry.teamname] = I.Set()
    }
    res[entry.teamname] = res[entry.teamname].add(
      Constants.makeResetUser({
        badgeIDKey: Constants.resetUserBadgeIDToKey(entry.id),
        username: entry.username,
      })
    )
    return res
  }, {})

  if (_wasOnTeamsTab && (newTeams.size > 0 || newTeamRequests.size > 0)) {
    // Call getTeams if new teams come in.
    // Covers the case when we're staring at the teams page so
    // we don't miss a notification we clear when we tab away
    const existingNewTeams = state.teams.getIn(['newTeams'], I.Set())
    const existingNewTeamRequests = state.teams.getIn(['newTeamRequests'], I.List())
    if (!newTeams.equals(existingNewTeams) && newTeams.size > 0) {
      // We have been added to a new team & we need to refresh the list
      actions.push(Saga.put(TeamsGen.createGetTeams()))
    }

    // getDetails for teams that have new access requests
    // Covers case where we have a badge appear on the requests
    // tab with no rows showing up
    const newTeamRequestsSet = I.Set(newTeamRequests)
    const existingNewTeamRequestsSet = I.Set(existingNewTeamRequests)
    const toLoad = newTeamRequestsSet.subtract(existingNewTeamRequestsSet)
    const loadingCalls = toLoad.map(teamname => Saga.put(TeamsGen.createGetDetails({teamname})))
    actions.push(Saga.all(loadingCalls.toArray()))
  }

  // if the user wasn't on the teams tab, loads will be triggered by navigation around the app
  actions.push(
    Saga.put(
      TeamsGen.createSetNewTeamInfo({
        newTeamRequests,
        newTeams,
        teamNameToResetUsers: I.Map(teamsWithResetUsersMap),
      })
    )
  )
  return Saga.sequentially(actions)
}

let _wasOnTeamsTab = false
const _onTabChange = (action: RouteTreeGen.SwitchToPayload) => {
  const list = I.List(action.payload.path)
  const root = list.first()

  if (root === teamsTab) {
    _wasOnTeamsTab = true
  } else if (_wasOnTeamsTab) {
    _wasOnTeamsTab = false
    // clear badges
    return Saga.all([
      Saga.call(RPCTypes.gregorDismissCategoryRpcPromise, {
        category: 'team.newly_added_to_team',
      }),
      Saga.call(RPCTypes.gregorDismissCategoryRpcPromise, {
        category: 'team.request_access',
      }),
    ])
  }
}

const receivedBadgeState = (state: TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) =>
  Saga.put(
    TeamsGen.createBadgeAppForTeams({
      newTeamAccessRequests: action.payload.badgeState.newTeamAccessRequests || [],
      newTeamNames: action.payload.badgeState.newTeamNames || [],
      teamsWithResetUsers: action.payload.badgeState.teamsWithResetUsers || [],
    })
  )

const gregorPushState = (_: any, action: GregorGen.PushStatePayload) => {
  const actions = []
  const items = action.payload.state
  const sawChatBanner = items.find(i => i.item && i.item.category === 'sawChatBanner')
  if (sawChatBanner) {
    actions.push(Saga.put(TeamsGen.createSetTeamSawChatBanner()))
  }

  const sawSubteamsBanner = items.find(i => i.item && i.item.category === 'sawSubteamsBanner')
  if (sawSubteamsBanner) {
    actions.push(Saga.put(TeamsGen.createSetTeamSawSubteamsBanner()))
  }

  const chosenChannels = items.find(i => i.item && i.item.category === Constants.chosenChannelsGregorKey)
  const teamsWithChosenChannelsStr =
    chosenChannels && chosenChannels.item && chosenChannels.item.body && chosenChannels.item.body.toString()
  const teamsWithChosenChannels = teamsWithChosenChannelsStr
    ? I.Set(JSON.parse(teamsWithChosenChannelsStr))
    : I.Set()
  actions.push(Saga.put(TeamsGen.createSetTeamsWithChosenChannels({teamsWithChosenChannels})))

  return Saga.sequentially(actions)
}

const teamsSaga = function*(): Saga.SagaGenerator<any, any> {
  yield Saga.actionToPromise(TeamsGen.leaveTeam, _leaveTeam)
  yield Saga.actionToPromise(TeamsGen.getTeamProfileAddList, _getTeamProfileAddList)
  yield Saga.actionToAction(TeamsGen.leftTeam, _leftTeam)
  yield Saga.safeTakeEveryPure(TeamsGen.createNewTeam, _createNewTeam)
  yield Saga.safeTakeEvery(TeamsGen.joinTeam, _joinTeam)
  yield Saga.safeTakeEvery(TeamsGen.getDetails, _getDetails)
  yield Saga.safeTakeEveryPure(TeamsGen.getDetailsForAllTeams, _getDetailsForAllTeams)
  yield Saga.safeTakeEvery(TeamsGen.getTeamPublicity, _getTeamPublicity)
  yield Saga.safeTakeEvery(TeamsGen.getTeamOperations, _getTeamOperations)
  yield Saga.safeTakeEvery(TeamsGen.createNewTeamFromConversation, _createNewTeamFromConversation)
  yield Saga.safeTakeEveryPure(TeamsGen.getChannelInfo, _getChannelInfo, _afterGetChannelInfo)
  yield Saga.safeTakeEveryPure(TeamsGen.getChannels, _getChannels, _afterGetChannels)
  yield Saga.actionToAction([ConfigGen.loggedIn, TeamsGen.getTeams, TeamsGen.leftTeam], getTeams)
  yield Saga.safeTakeEveryPure(TeamsGen.saveChannelMembership, _saveChannelMembership)
  yield Saga.safeTakeEvery(TeamsGen.createChannel, _createChannel)
  yield Saga.safeTakeEvery(TeamsGen.addToTeam, _addToTeam)
  yield Saga.safeTakeEvery(TeamsGen.addPeopleToTeam, _addPeopleToTeam)
  yield Saga.safeTakeEvery(TeamsGen.addUserToTeams, _addUserToTeams)
  yield Saga.safeTakeEvery(TeamsGen.inviteToTeamByEmail, _inviteByEmail)
  yield Saga.safeTakeEvery(TeamsGen.ignoreRequest, _ignoreRequest)
  yield Saga.safeTakeEvery(TeamsGen.editTeamDescription, _editDescription)
  yield Saga.safeTakeEvery(TeamsGen.uploadTeamAvatar, _uploadAvatar)
  yield Saga.safeTakeEvery(TeamsGen.editMembership, _editMembership)
  yield Saga.safeTakeEvery(TeamsGen.removeMemberOrPendingInvite, _removeMemberOrPendingInvite)
  yield Saga.safeTakeEvery(TeamsGen.setMemberPublicity, _setMemberPublicity)
  yield Saga.safeTakeEveryPure(TeamsGen.updateTopic, _updateTopic, last)
  yield Saga.safeTakeEveryPure(TeamsGen.updateChannelName, _updateChannelname, last)
  yield Saga.safeTakeEveryPure(TeamsGen.deleteChannelConfirmed, _deleteChannelConfirmed)
  yield Saga.safeTakeEveryPure(TeamsGen.badgeAppForTeams, _badgeAppForTeams)
  yield Saga.safeTakeEveryPure(RouteTreeGen.switchTo, _onTabChange, null, logError)
  yield Saga.safeTakeEvery(TeamsGen.inviteToTeamByPhone, _inviteToTeamByPhone)
  yield Saga.actionToAction(TeamsGen.setPublicity, _setPublicity)
  yield Saga.safeTakeEveryPure(
    TeamsGen.checkRequestedAccess,
    _checkRequestedAccess,
    _checkRequestedAccessSuccess
  )
  yield Saga.safeTakeEvery(TeamsGen.getTeamRetentionPolicy, _getTeamRetentionPolicy)
  yield Saga.safeTakeEveryPure(TeamsGen.saveTeamRetentionPolicy, _saveTeamRetentionPolicy)
  yield Saga.safeTakeEveryPure(Chat2Gen.updateTeamRetentionPolicy, _updateTeamRetentionPolicy)
  yield Saga.safeTakeEvery(TeamsGen.addTeamWithChosenChannels, _addTeamWithChosenChannels)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)
  yield Saga.actionToAction(NotificationsGen.receivedBadgeState, receivedBadgeState)
  yield Saga.actionToAction(GregorGen.pushState, gregorPushState)
}

export default teamsSaga
