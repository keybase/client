// @flow
// TODO the relationships here are often inverted. we want to clear actions when a bunch of actions happen
// not have every handler clear it themselves. this reduces the nubmer of actionChains
import logger from '../logger'
import {map} from 'lodash-es'
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
import engine from '../engine'
import {isMobile} from '../constants/platform'
import {chatTab, teamsTab} from '../constants/tabs'
import openSMS from '../util/sms'
import {convertToError, logError} from '../util/errors'
import {getPath} from '../route-tree'

function* createNewTeam(_, action) {
  const {destSubPath, joinSubteam, rootPath, sourceSubPath, teamname} = action.payload
  yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
  try {
    yield* Saga.callPromise(
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

function* joinTeam(_, action) {
  const {teamname} = action.payload
  yield Saga.all([
    Saga.put(TeamsGen.createSetTeamJoinError({error: ''})),
    Saga.put(TeamsGen.createSetTeamJoinSuccess({success: false, teamname: ''})),
  ])
  try {
    const result = yield* Saga.callPromise(
      RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise,
      {tokenOrName: teamname},
      Constants.teamWaitingKey(teamname)
    )

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

const getTeamProfileAddList = (state, action) =>
  RPCTypes.teamsTeamProfileAddListRpcPromise(
    {username: action.payload.username},
    Constants.teamProfileAddListWaitingKey
  ).then(res => {
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
  })

const leaveTeam = (state, action) => {
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

const leftTeam = (state, action) => {
  const selectedTeamnames = Constants.getSelectedTeamNames(state)
  if (selectedTeamnames.includes(action.payload.teamname)) {
    // Back out of that team's page
    return RouteTreeGen.createNavigateTo({parentPath: [teamsTab], path: []})
  }
}

const addPeopleToTeam = (state, action) => {
  const {destSubPath, role, rootPath, sendChatNotification, sourceSubPath, teamname} = action.payload
  const ids = SearchConstants.getUserInputItemIds(state, 'addToTeamSearch').toArray()
  logger.info(`Adding ${ids.length} people to ${teamname}`)
  logger.info(`Adding ${ids.join(',')}`)
  return RPCTypes.teamsTeamAddMembersRpcPromise(
    {
      assertions: ids,
      name: teamname,
      role:
        RPCTypes.teamsTeamRole[role] === undefined
          ? RPCTypes.teamsTeamRole.none
          : RPCTypes.teamsTeamRole[role],
      sendChatNotification,
    },
    Constants.teamWaitingKey(teamname)
  )
    .then(() => {
      // Success, dismiss the create team dialog and clear out search results
      logger.info(`Successfully added ${ids.length} users to ${teamname}`)
      return [
        RouteTreeGen.createPutActionIfOnPath({
          expectedPath: rootPath.concat(sourceSubPath),
          otherAction: RouteTreeGen.createNavigateTo({parentPath: rootPath, path: destSubPath}),
          parentPath: rootPath,
        }),
        SearchGen.createClearSearchResults({searchKey: 'addToTeamSearch'}),
        SearchGen.createSetUserInputItems({searchKey: 'addToTeamSearch', searchResults: []}),
        TeamsGen.createSetTeamInviteError({error: ''}),
      ]
    })
    .catch(error => {
      logger.error(`Error adding to ${teamname}: ${error.desc}`)
      // Some errors, leave the search results so user can figure out what happened
      logger.info(`Displaying addPeopleToTeam errors...`)
      return TeamsGen.createSetTeamInviteError({error: error.desc})
    })
}

const getTeamRetentionPolicy = (state, action) => {
  const {teamname} = action.payload
  const teamID = Constants.getTeamID(state, teamname)
  if (!teamID) {
    const errMsg = `getTeamRetentionPolicy: Unable to find teamID for teamname ${teamname}`
    logger.error(errMsg)
    return
  }

  let retentionPolicy = Constants.makeRetentionPolicy()
  return RPCChatTypes.localGetTeamRetentionLocalRpcPromise({teamID}, Constants.teamWaitingKey(teamname))
    .then(policy => {
      try {
        retentionPolicy = Constants.serviceRetentionPolicyToRetentionPolicy(policy)
        if (retentionPolicy.type === 'inherit') {
          throw new Error(`RPC returned retention policy of type 'inherit' for team policy`)
        }
      } catch (err) {
        logger.error(err.message)
        throw err
      }
      return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy, teamname})
    })
    .catch(() => TeamsGen.createSetTeamRetentionPolicy({retentionPolicy, teamname}))
}

const saveTeamRetentionPolicy = (state, action) => {
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
  return RPCChatTypes.localSetTeamRetentionLocalRpcPromise({policy: servicePolicy, teamID}, [
    Constants.teamWaitingKey(teamname),
    Constants.retentionWaitingKey(teamname),
  ])
}

const updateTeamRetentionPolicy = (state, action) => {
  const {convs} = action.payload
  if (convs.length === 0) {
    logger.warn('Got updateTeamRetentionPolicy with no convs; aborting. Local copy may be out of date')
    return
  }
  const {teamRetention, name} = convs[0]
  try {
    const newPolicy = Constants.serviceRetentionPolicyToRetentionPolicy(teamRetention)
    return TeamsGen.createSetTeamRetentionPolicy({retentionPolicy: newPolicy, teamname: name})
  } catch (err) {
    logger.error(err.message)
    throw err
  }
}

function* inviteByEmail(_, action) {
  const {destSubPath, invitees, role, rootPath, sourceSubPath, teamname} = action.payload
  yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: true, teamname}))
  try {
    const res: RPCTypes.BulkRes = yield* Saga.callPromise(
      RPCTypes.teamsTeamAddEmailsBulkRpcPromise,
      {
        emails: invitees,
        name: teamname,
        role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      },
      [Constants.teamWaitingKey(teamname), Constants.addToTeamByEmailWaitingKey(teamname)]
    )
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
    yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: false, teamname}))
  }
}

const addToTeam = (_, action) => {
  const {teamname, username, role, sendChatNotification} = action.payload
  return RPCTypes.teamsTeamAddMemberRpcPromise(
    {
      email: '',
      name: teamname,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      sendChatNotification,
      username,
    },
    [Constants.teamWaitingKey(teamname), Constants.addMemberWaitingKey(teamname, username)]
  )
    .then(() => {})
    .catch(e => {
      // identify error
      if (e.code === RPCTypes.constantsStatusCode.scidentifysummaryerror) {
        if (isMobile) {
          // show profile card on mobile
          return ProfileGen.createShowUserProfile({username})
        }
      }
    })
}

const editDescription = (_, action) => {
  const {teamname, description} = action.payload
  return RPCTypes.teamsSetTeamShowcaseRpcPromise(
    {
      description,
      name: teamname,
    },
    Constants.teamWaitingKey(teamname)
  )
    .then(() => TeamsGen.createGetDetails({teamname}))
    .catch(() =>
      // TODO We don't get a team changed notification for this. Delete this call when CORE-7125 is finished.
      TeamsGen.createGetDetails({teamname})
    )
}

const uploadAvatar = (_, action) => {
  const {crop, filename, sendChatNotification, teamname} = action.payload
  return RPCTypes.teamsUploadTeamAvatarRpcPromise(
    {
      crop,
      filename,
      sendChatNotification,
      teamname,
    },
    Constants.teamWaitingKey(teamname)
  ).then(() => RouteTreeGen.createNavigateUp())
}

const editMembership = (_, action) => {
  const {teamname, username, role} = action.payload
  return RPCTypes.teamsTeamEditMemberRpcPromise(
    {
      name: teamname,
      role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      username,
    },
    Constants.teamWaitingKey(teamname)
  )
}

function* removeMemberOrPendingInvite(_, action) {
  const {teamname, username, email, inviteID} = action.payload

  const invitees = username || email || inviteID
  yield Saga.put(TeamsGen.createSetTeamLoadingInvites({invitees, loadingInvites: true, teamname}))

  // disallow call with any pair of username, email, and ID to avoid black-bar errors
  if ((!!username && !!email) || (!!username && !!inviteID) || (!!email && !!inviteID)) {
    const errMsg = 'Supplied more than one form of identification to removeMemberOrPendingInvite'
    logger.error(errMsg)
    throw new Error(errMsg)
  }

  try {
    yield* Saga.callPromise(
      RPCTypes.teamsTeamRemoveMemberRpcPromise,
      {
        email,
        inviteID,
        name: teamname,
        username,
      },
      [
        Constants.teamWaitingKey(teamname),
        // only one of (username, email, inviteID) is truth-y
        Constants.removeMemberWaitingKey(teamname, username || email || inviteID),
      ]
    )
  } finally {
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

const inviteToTeamByPhone = (_, action) => {
  const {teamname, role, phoneNumber, fullName = ''} = action.payload
  return RPCTypes.teamsTeamCreateSeitanTokenV2RpcPromise(
    {
      label: {sms: ({f: fullName || '', n: phoneNumber}: RPCTypes.SeitanKeyLabelSms), t: 1},
      name: teamname,
      role: (!!role && RPCTypes.teamsTeamRole[role]) || 0,
    },
    Constants.teamWaitingKey(teamname)
  ).then(seitan => {
    /* Open SMS */
    const bodyText = generateSMSBody(teamname, seitan)
    return openSMS([phoneNumber], bodyText)
      .then(() => TeamsGen.createGetDetails({teamname}))
      .catch(err => logger.info('Error sending SMS', err))
  })
}

const ignoreRequest = (_, action) => {
  const {teamname, username} = action.payload
  return RPCTypes.teamsTeamIgnoreRequestRpcPromise(
    {
      name: teamname,
      username,
    },
    Constants.teamWaitingKey(teamname)
  )
    .then(() => TeamsGen.createGetDetails({teamname}))
    .catch(
      () =>
        // TODO handle error, but for now make sure loading is unset
        // TODO get rid of this once core sends us a notification for this (CORE-7125)
        TeamsGen.createGetDetails({teamname}) // getDetails will unset loading
    )
}

function* createNewTeamFromConversation(state, action) {
  const {conversationIDKey, teamname} = action.payload
  const me = state.config.username
  let participants: Array<string> = []

  const meta = ChatConstants.getMeta(state, conversationIDKey)
  participants = meta.participants.toArray()

  if (participants) {
    yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
    try {
      const createRes = yield* Saga.callPromise(
        RPCTypes.teamsTeamCreateRpcPromise,
        {
          joinSubteam: false,
          name: teamname,
        },
        Constants.teamCreationWaitingKey
      )
      for (const username of participants) {
        if (!createRes.creatorAdded || username !== me) {
          yield* Saga.callPromise(
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

function* getDetails(_, action) {
  const {teamname} = action.payload
  yield Saga.put(TeamsGen.createGetTeamOperations({teamname}))
  yield Saga.put(TeamsGen.createGetTeamPublicity({teamname}))

  try {
    const unsafeDetails: RPCTypes.TeamDetails = yield* Saga.callPromise(
      RPCTypes.teamsTeamGetRpcPromise,
      {
        name: teamname,
      },
      Constants.teamWaitingKey(teamname)
    )

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
    let requests
    const state = yield* Saga.selectState()
    if (Constants.getCanPerform(state, teamname).manageMembers) {
      // TODO (DESKTOP-6478) move this somewhere else
      requests = yield* Saga.callPromise(
        RPCTypes.teamsTeamListRequestsRpcPromise,
        {
          teamName: teamname,
        },
        Constants.teamWaitingKey(teamname)
      )
    }

    if (!requests) {
      requests = []
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
    const {entries} = yield* Saga.callPromise(
      RPCTypes.teamsTeamGetSubteamsRpcPromise,
      {name: {parts: teamname.split('.')}},
      Constants.teamWaitingKey(teamname)
    )
    const subteams = (entries || []).reduce((arr, {name}) => {
      name.parts && arr.push(name.parts.join('.'))
      return arr
    }, [])
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
  } catch (e) {
    logger.error(e)
  }
}

const getDetailsForAllTeams = (state, action) =>
  state.teams.teamnames.toArray().map(teamname => TeamsGen.createGetDetails({teamname}))

function* addUserToTeams(state, action) {
  const {role, teams, user} = action.payload
  const teamsAddedTo = []
  const errorAddingTo = []
  for (const team of teams) {
    try {
      yield* Saga.callPromise(
        RPCTypes.teamsTeamAddMemberRpcPromise,
        {
          email: '',
          name: team,
          role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
          sendChatNotification: true,
          username: user,
        },
        Constants.teamWaitingKey(team)
      )
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

const getTeamOperations = (_, action) =>
  RPCTypes.teamsCanUserPerformRpcPromise(
    {name: action.payload.teamname},
    Constants.teamWaitingKey(action.payload.teamname)
  ).then(teamOperation =>
    TeamsGen.createSetTeamCanPerform({teamOperation, teamname: action.payload.teamname})
  )

function* getTeamPublicity(_, action) {
  try {
    const teamname = action.payload.teamname
    // Get publicity settings for this team.
    const publicity: RPCTypes.TeamAndMemberShowcase = yield* Saga.callPromise(
      RPCTypes.teamsGetTeamAndMemberShowcaseRpcPromise,
      {name: teamname},
      Constants.teamWaitingKey(teamname)
    )

    let tarsDisabled = false
    // can throw if you're not an admin
    try {
      tarsDisabled = yield* Saga.callPromise(
        RPCTypes.teamsGetTarsDisabledRpcPromise,
        {name: teamname},
        Constants.teamTarsWaitingKey(teamname)
      )
    } catch (_) {}

    const publicityMap = {
      anyMemberShowcase: publicity.teamShowcase.anyMemberShowcase,
      description: publicity.teamShowcase.description || '',
      ignoreAccessRequests: tarsDisabled,
      member: publicity.isMemberShowcased,
      team: publicity.teamShowcase.isShowcased,
    }

    yield Saga.put(TeamsGen.createSetTeamPublicitySettings({publicity: publicityMap, teamname}))
  } catch (e) {
    logger.error(e)
  }
}

const getChannelInfo = (_, action) => {
  const {teamname, conversationIDKey} = action.payload
  return RPCChatTypes.localGetInboxAndUnboxUILocalRpcPromise(
    {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      query: ChatConstants.makeInboxQuery([conversationIDKey]),
    },
    Constants.teamWaitingKey(teamname)
  ).then(results => {
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

    return TeamsGen.createSetTeamChannelInfo({channelInfo, conversationIDKey, teamname})
  })
}

const getChannels = (_, action) => {
  const teamname = action.payload.teamname
  return RPCChatTypes.localGetTLFConversationsLocalRpcPromise(
    {
      membersType: RPCChatTypes.commonConversationMembersType.team,
      tlfName: teamname,
      topicType: RPCChatTypes.commonTopicType.chat,
    },
    Constants.getChannelsWaitingKey(teamname)
  ).then(results => {
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

    return TeamsGen.createSetTeamChannels({channelInfos: I.Map(channelInfos), teamname})
  })
}

function* getTeams(state) {
  const username = state.config.username
  if (!username) {
    logger.warn('getTeams while logged out')
    return
  }
  try {
    const results: RPCTypes.AnnotatedTeamList = yield* Saga.callPromise(
      RPCTypes.teamsTeamListUnverifiedRpcPromise,
      {
        includeImplicitTeams: false,
        userAssertion: username,
      },
      Constants.teamsLoadedWaitingKey
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
    const teamResetUsers = state.teams.teamNameToResetUsers || I.Map()
    const teamNameSet = I.Set(teamnames)
    const dismissIDs = teamResetUsers.reduce((ids, value: I.Set<Types.ResetUser>, key: string) => {
      if (!teamNameSet.has(key)) {
        ids.push(...value.toArray().map(ru => ru.badgeIDKey))
      }
      return ids
    }, [])
    yield Saga.all(
      dismissIDs.map(id =>
        Saga.callUntyped(
          RPCTypes.gregorDismissItemRpcPromise,
          {id: Constants.keyToResetUserBadgeID(id)},
          Constants.teamsLoadedWaitingKey
        )
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
      logger.error(err)
    }
  }
}

const checkRequestedAccess = (_, action) =>
  RPCTypes.teamsTeamListMyAccessRequestsRpcPromise({}, Constants.teamsAccessRequestWaitingKey).then(
    result => {
      const teams = (result || []).map(row => (row && row.parts ? row.parts.join('.') : ''))
      return TeamsGen.createSetTeamAccessRequestsPending({accessRequestsPending: I.Set(teams)})
    }
  )

const _joinConversation = function*(
  teamname: Types.Teamname,
  conversationIDKey: ChatTypes.ConversationIDKey,
  participant: string
) {
  try {
    const convID = ChatTypes.keyToConversationID(conversationIDKey)
    yield* Saga.callPromise(
      RPCChatTypes.localJoinConversationByIDLocalRpcPromise,
      {
        convID,
      },
      Constants.teamWaitingKey(teamname)
    )
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
    yield* Saga.callPromise(
      RPCChatTypes.localLeaveConversationLocalRpcPromise,
      {
        convID,
      },
      Constants.teamWaitingKey(teamname)
    )
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

function* saveChannelMembership(state, action) {
  const {teamname, oldChannelState, newChannelState} = action.payload

  const calls = []
  for (const convIDKeyStr in newChannelState) {
    const convIDKey = ChatTypes.stringToConversationIDKey(convIDKeyStr)
    if (oldChannelState[convIDKey] === newChannelState[convIDKey]) {
      continue
    }

    if (newChannelState[convIDKey]) {
      calls.push(Saga.callUntyped(_joinConversation, teamname, convIDKey, action.payload.you))
    } else {
      calls.push(Saga.callUntyped(_leaveConversation, teamname, convIDKey, action.payload.you))
    }
  }

  yield Saga.all(calls)
  if (calls.length) {
    yield Saga.put(TeamsGen.createGetChannels({teamname}))
  }
}

function* createChannel(_, action) {
  const {channelname, description, teamname, rootPath, sourceSubPath, destSubPath} = action.payload
  yield Saga.put(TeamsGen.createSetTeamCreationError({error: ''}))
  try {
    const result = yield* Saga.callPromise(
      RPCChatTypes.localNewConversationLocalRpcPromise,
      {
        identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
        membersType: RPCChatTypes.commonConversationMembersType.team,
        tlfName: teamname,
        tlfVisibility: RPCTypes.commonTLFVisibility.private,
        topicName: channelname,
        topicType: RPCChatTypes.commonTopicType.chat,
      },
      Constants.createChannelWaitingKey(teamname)
    )

    // No error if we get here.
    const newConversationIDKey = result ? ChatTypes.conversationIDToKey(result.conv.info.id) : null
    if (!newConversationIDKey) {
      logger.warn('No convoid from newConvoRPC')
      return
    }

    // If we were given a description, set it
    if (description) {
      yield* Saga.callPromise(
        RPCChatTypes.localPostHeadlineNonblockRpcPromise,
        {
          clientPrev: 0,
          conversationID: result.conv.info.id,
          headline: description,
          identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
          tlfName: teamname,
          tlfPublic: false,
        },
        Constants.createChannelWaitingKey(teamname)
      )
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
  }
}

const setMemberPublicity = (state, action) => {
  const {teamname, showcase} = action.payload
  return RPCTypes.teamsSetTeamMemberShowcaseRpcPromise(
    {
      isShowcased: showcase,
      name: teamname,
    },
    Constants.teamWaitingKey(teamname)
  )
    .then(() => [
      TeamsGen.createGetDetails({teamname}),
      // The profile showcasing page gets this data from teamList rather than teamGet, so trigger one of those too.
      TeamsGen.createGetTeams(),
    ])
    .catch(e =>
      // TODO handle error, but for now make sure loading is unset
      [
        TeamsGen.createGetDetails({teamname}),
        // The profile showcasing page gets this data from teamList rather than teamGet, so trigger one of those too.
        TeamsGen.createGetTeams(),
      ]
    )
}

function* setPublicity(state, action) {
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
      Saga.callUntyped(function*() {
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
      Saga.callUntyped(function*() {
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
      Saga.callUntyped(function*() {
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
      Saga.callUntyped(function*() {
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
      Saga.callUntyped(function*() {
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
  yield Saga.put(TeamsGen.createGetDetails({teamname}))

  // Display any errors from the rpcs
  const errs = results
    .filter(r => r.type === 'error')
    .map(({payload}) => Saga.put(ConfigGen.createGlobalError({globalError: convertToError(payload)})))
  yield Saga.all(errs)
}

// This is to simplify the changes that setIncomingCallMap created. Could clean this up and remove this
const arrayOfActionsToSequentially = actions =>
  Saga.callUntyped(Saga.sequentially, (actions || []).map(a => Saga.put(a)))

const setupEngineListeners = () => {
  engine().setIncomingCallMap({
    'keybase.1.NotifyTeam.avatarUpdated': ({name, formats, typ}) =>
      Saga.callUntyped(function*() {
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
      Saga.callUntyped(function*() {
        logger.info(`Got teamChanged for ${param.teamName} from service`)
        const state = yield* Saga.selectState()
        const selectedTeamNames = Constants.getSelectedTeamNames(state)
        if (
          selectedTeamNames.includes(param.teamName) &&
          getPath(state.routeTree.routeState).first() === teamsTab
        ) {
          // only reload if that team is selected
          yield arrayOfActionsToSequentially([
            TeamsGen.createGetTeams(),
            TeamsGen.createGetDetails({teamname: param.teamName}),
          ])
        }
        yield arrayOfActionsToSequentially(getLoadCalls())
      }),
    'keybase.1.NotifyTeam.teamDeleted': param =>
      Saga.callUntyped(function*() {
        const state = yield* Saga.selectState()
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
      Saga.callUntyped(function*() {
        const state = yield* Saga.selectState()
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

const updateTopic = (state, action) => {
  const {teamname, conversationIDKey, newTopic} = action.payload
  const param = {
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    headline: newTopic,
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    tlfName: teamname,
    tlfPublic: false,
  }

  return RPCChatTypes.localPostHeadlineRpcPromise(param, Constants.teamWaitingKey(teamname)).then(() =>
    TeamsGen.createSetUpdatedTopic({conversationIDKey, newTopic, teamname})
  )
}

function* addTeamWithChosenChannels(state, action) {
  const existingTeams = state.teams.teamsWithChosenChannels
  const {teamname} = action.payload
  if (state.teams.teamsWithChosenChannels.has(teamname)) {
    // we've already dismissed for this team and we already know about it, bail
    return
  }
  const logPrefix = `[addTeamWithChosenChannels]:${teamname}`
  let pushState
  try {
    pushState = yield* Saga.callPromise(
      RPCTypes.gregorGetStateRpcPromise,
      undefined,
      Constants.teamWaitingKey(teamname)
    )
  } catch (err) {
    // failure getting the push state, don't bother the user with an error
    // and don't try to move forward updating the state
    logger.error(`${logPrefix} error fetching gregor state: ${err}`)
    return
  }
  const item =
    pushState.items && pushState.items.find(i => i.item?.category === Constants.chosenChannelsGregorKey)
  let teams = []
  let msgID
  if (item && item.item && item.item.body) {
    const body = item.item.body
    msgID = item.md?.msgID
    teams = JSON.parse(body.toString())
  } else {
    logger.info(
      `${logPrefix} No item in gregor state found, making new item. Total # of items: ${pushState.items
        ?.length || 0}`
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
  yield* Saga.callPromise(
    RPCTypes.gregorUpdateCategoryRpcPromise,
    {
      body: JSON.stringify(teams),
      category: Constants.chosenChannelsGregorKey,
      dtime,
    },
    teams.map(t => Constants.teamWaitingKey(t))
  )
}

const updateChannelname = (state, action) => {
  const {teamname, conversationIDKey, newChannelName} = action.payload
  const param = {
    channelName: newChannelName,
    conversationID: ChatTypes.keyToConversationID(conversationIDKey),
    identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
    tlfName: teamname,
    tlfPublic: false,
  }

  return RPCChatTypes.localPostMetadataRpcPromise(param, Constants.teamWaitingKey(teamname)).then(() =>
    TeamsGen.createSetUpdatedChannelName({conversationIDKey, newChannelName, teamname})
  )
}

const deleteChannelConfirmed = (state, action) => {
  const {teamname, conversationIDKey} = action.payload
  // channelName is only needed for confirmation, so since we handle
  // confirmation ourselves we don't need to plumb it through.
  return RPCChatTypes.localDeleteConversationLocalRpcPromise(
    {
      channelName: '',
      confirmed: true,
      convID: ChatTypes.keyToConversationID(conversationIDKey),
    },
    Constants.teamWaitingKey(teamname)
  ).then(() => TeamsGen.createDeleteChannelInfo({conversationIDKey, teamname}))
}

const badgeAppForTeams = (state, action) => {
  const loggedIn = state.config.loggedIn
  if (!loggedIn) {
    // Don't make any calls we don't have permission to.
    return
  }

  let actions = []
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
      actions.push(TeamsGen.createGetTeams())
    }

    // getDetails for teams that have new access requests
    // Covers case where we have a badge appear on the requests
    // tab with no rows showing up
    const newTeamRequestsSet = I.Set(newTeamRequests)
    const existingNewTeamRequestsSet = I.Set(existingNewTeamRequests)
    const toLoad = newTeamRequestsSet.subtract(existingNewTeamRequestsSet)
    const loadingCalls = toLoad.map(teamname => TeamsGen.createGetDetails({teamname})).toArray()
    actions = actions.concat(loadingCalls)
  }

  // if the user wasn't on the teams tab, loads will be triggered by navigation around the app
  actions.push(
    TeamsGen.createSetNewTeamInfo({
      newTeamRequests,
      newTeams,
      teamNameToResetUsers: I.Map(teamsWithResetUsersMap),
    })
  )
  return actions
}

let _wasOnTeamsTab = false
const onTabChange = (_, action) => {
  const list = I.List(action.payload.path)
  const root = list.first()

  if (root === teamsTab) {
    _wasOnTeamsTab = true
  } else if (_wasOnTeamsTab) {
    _wasOnTeamsTab = false
    // clear badges
    return RPCTypes.gregorDismissCategoryRpcPromise({
      category: 'team.newly_added_to_team',
    })
      .then(() =>
        RPCTypes.gregorDismissCategoryRpcPromise({
          category: 'team.request_access',
        })
      )
      .catch(err => logError(err))
  }
}

const receivedBadgeState = (state, action) =>
  TeamsGen.createBadgeAppForTeams({
    newTeamAccessRequests: action.payload.badgeState.newTeamAccessRequests || [],
    newTeamNames: action.payload.badgeState.newTeamNames || [],
    teamsWithResetUsers: action.payload.badgeState.teamsWithResetUsers || [],
  })

const gregorPushState = (_, action) => {
  const actions = []
  const items = action.payload.state
  const sawChatBanner = items.find(i => i.item && i.item.category === 'sawChatBanner')
  if (sawChatBanner) {
    actions.push(TeamsGen.createSetTeamSawChatBanner())
  }

  const sawSubteamsBanner = items.find(i => i.item && i.item.category === 'sawSubteamsBanner')
  if (sawSubteamsBanner) {
    actions.push(TeamsGen.createSetTeamSawSubteamsBanner())
  }

  const chosenChannels = items.find(i => i.item && i.item.category === Constants.chosenChannelsGregorKey)
  const teamsWithChosenChannelsStr =
    chosenChannels && chosenChannels.item && chosenChannels.item.body && chosenChannels.item.body.toString()
  const teamsWithChosenChannels = teamsWithChosenChannelsStr
    ? I.Set(JSON.parse(teamsWithChosenChannelsStr))
    : I.Set()
  actions.push(TeamsGen.createSetTeamsWithChosenChannels({teamsWithChosenChannels}))

  return actions
}

const teamsSaga = function*(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<TeamsGen.LeaveTeamPayload>(TeamsGen.leaveTeam, leaveTeam)
  yield* Saga.chainAction<TeamsGen.GetTeamProfileAddListPayload>(
    TeamsGen.getTeamProfileAddList,
    getTeamProfileAddList
  )
  yield* Saga.chainAction<TeamsGen.LeftTeamPayload>(TeamsGen.leftTeam, leftTeam)
  yield* Saga.chainGenerator<TeamsGen.CreateNewTeamPayload>(TeamsGen.createNewTeam, createNewTeam)
  yield* Saga.chainGenerator<TeamsGen.JoinTeamPayload>(TeamsGen.joinTeam, joinTeam)
  yield* Saga.chainGenerator<TeamsGen.GetDetailsPayload>(TeamsGen.getDetails, getDetails)
  yield* Saga.chainAction<TeamsGen.GetDetailsForAllTeamsPayload>(
    TeamsGen.getDetailsForAllTeams,
    getDetailsForAllTeams
  )
  yield* Saga.chainGenerator<TeamsGen.GetTeamPublicityPayload>(TeamsGen.getTeamPublicity, getTeamPublicity)
  yield* Saga.chainAction<TeamsGen.GetTeamOperationsPayload>(TeamsGen.getTeamOperations, getTeamOperations)
  yield* Saga.chainGenerator<TeamsGen.CreateNewTeamFromConversationPayload>(
    TeamsGen.createNewTeamFromConversation,
    createNewTeamFromConversation
  )
  yield* Saga.chainAction<TeamsGen.GetChannelInfoPayload>(TeamsGen.getChannelInfo, getChannelInfo)
  yield* Saga.chainAction<TeamsGen.GetChannelsPayload>(TeamsGen.getChannels, getChannels)
  yield* Saga.chainGenerator<ConfigGen.LoggedInPayload, TeamsGen.GetTeamsPayload, TeamsGen.LeftTeamPayload>(
    [ConfigGen.loggedIn, TeamsGen.getTeams, TeamsGen.leftTeam],
    getTeams
  )
  yield* Saga.chainGenerator<TeamsGen.SaveChannelMembershipPayload>(
    TeamsGen.saveChannelMembership,
    saveChannelMembership
  )
  yield* Saga.chainGenerator<TeamsGen.CreateChannelPayload>(TeamsGen.createChannel, createChannel)
  yield* Saga.chainAction<TeamsGen.AddToTeamPayload>(TeamsGen.addToTeam, addToTeam)
  yield* Saga.chainAction<TeamsGen.AddPeopleToTeamPayload>(TeamsGen.addPeopleToTeam, addPeopleToTeam)
  yield* Saga.chainGenerator<TeamsGen.AddUserToTeamsPayload>(TeamsGen.addUserToTeams, addUserToTeams)
  yield* Saga.chainGenerator<TeamsGen.InviteToTeamByEmailPayload>(TeamsGen.inviteToTeamByEmail, inviteByEmail)
  yield* Saga.chainAction<TeamsGen.IgnoreRequestPayload>(TeamsGen.ignoreRequest, ignoreRequest)
  yield* Saga.chainAction<TeamsGen.EditTeamDescriptionPayload>(TeamsGen.editTeamDescription, editDescription)
  yield* Saga.chainAction<TeamsGen.UploadTeamAvatarPayload>(TeamsGen.uploadTeamAvatar, uploadAvatar)
  yield* Saga.chainAction<TeamsGen.EditMembershipPayload>(TeamsGen.editMembership, editMembership)
  yield* Saga.chainGenerator<TeamsGen.RemoveMemberOrPendingInvitePayload>(
    TeamsGen.removeMemberOrPendingInvite,
    removeMemberOrPendingInvite
  )
  yield* Saga.chainAction<TeamsGen.SetMemberPublicityPayload>(TeamsGen.setMemberPublicity, setMemberPublicity)
  yield* Saga.chainAction<TeamsGen.UpdateTopicPayload>(TeamsGen.updateTopic, updateTopic)
  yield* Saga.chainAction<TeamsGen.UpdateChannelNamePayload>(TeamsGen.updateChannelName, updateChannelname)
  yield* Saga.chainAction<TeamsGen.DeleteChannelConfirmedPayload>(
    TeamsGen.deleteChannelConfirmed,
    deleteChannelConfirmed
  )
  yield* Saga.chainAction<TeamsGen.BadgeAppForTeamsPayload>(TeamsGen.badgeAppForTeams, badgeAppForTeams)
  yield* Saga.chainAction<RouteTreeGen.SwitchToPayload>(RouteTreeGen.switchTo, onTabChange)
  yield* Saga.chainAction<TeamsGen.InviteToTeamByPhonePayload>(
    TeamsGen.inviteToTeamByPhone,
    inviteToTeamByPhone
  )
  yield* Saga.chainGenerator<TeamsGen.SetPublicityPayload>(TeamsGen.setPublicity, setPublicity)
  yield* Saga.chainAction<TeamsGen.CheckRequestedAccessPayload>(
    TeamsGen.checkRequestedAccess,
    checkRequestedAccess
  )
  yield* Saga.chainAction<TeamsGen.GetTeamRetentionPolicyPayload>(
    TeamsGen.getTeamRetentionPolicy,
    getTeamRetentionPolicy
  )
  yield* Saga.chainAction<TeamsGen.SaveTeamRetentionPolicyPayload>(
    TeamsGen.saveTeamRetentionPolicy,
    saveTeamRetentionPolicy
  )
  yield* Saga.chainAction<Chat2Gen.UpdateTeamRetentionPolicyPayload>(
    Chat2Gen.updateTeamRetentionPolicy,
    updateTeamRetentionPolicy
  )
  yield* Saga.chainGenerator<TeamsGen.AddTeamWithChosenChannelsPayload>(
    TeamsGen.addTeamWithChosenChannels,
    addTeamWithChosenChannels
  )
  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
  yield* Saga.chainAction<NotificationsGen.ReceivedBadgeStatePayload>(
    NotificationsGen.receivedBadgeState,
    receivedBadgeState
  )
  yield* Saga.chainAction<GregorGen.PushStatePayload>(GregorGen.pushState, gregorPushState)
}

export default teamsSaga
