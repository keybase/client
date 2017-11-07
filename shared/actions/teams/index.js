// @flow
import * as I from 'immutable'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat'
import * as SearchConstants from '../../constants/search'
import * as ChatTypes from '../../constants/types/flow-types-chat'
import * as RPCTypes from '../../constants/types/flow-types'
import * as Saga from '../../util/saga'
import * as Creators from './creators'
import * as RouteTreeConstants from '../../constants/route-tree'
import * as ChatGen from '../chat-gen'
import engine from '../../engine'
import map from 'lodash/map'
import {replaceEntity} from '../entities'
import {usernameSelector} from '../../constants/selectors'
import {isMobile} from '../../constants/platform'
import {navigateTo} from '../route-tree'
import {chatTab, teamsTab} from '../../constants/tabs'
import openSMS from '../../util/sms'

import type {TypedState} from '../../constants/reducer'

const _createNewTeam = function*(action: Constants.CreateNewTeam) {
  const {payload: {name}} = action
  yield Saga.put(Creators.setTeamCreationError(''))
  yield Saga.put(Creators.setTeamCreationPending(true))
  try {
    yield Saga.call(RPCTypes.teamsTeamCreateRpcPromise, {
      param: {name, sendChatNotification: true},
    })

    // No error if we get here.
    yield Saga.put(navigateTo([isMobile ? chatTab : teamsTab]))
  } catch (error) {
    yield Saga.put(Creators.setTeamCreationError(error.desc))
  } finally {
    yield Saga.put(Creators.setTeamCreationPending(false))
  }
}

const _joinTeam = function*(action: Constants.JoinTeam) {
  const {payload: {teamname}} = action
  yield Saga.all([Saga.put(Creators.setTeamJoinError('')), Saga.put(Creators.setTeamJoinSuccess(false))])
  try {
    yield Saga.call(RPCTypes.teamsTeamAcceptInviteOrRequestAccessRpcPromise, {
      param: {tokenOrName: teamname},
    })

    // Success
    yield Saga.put(Creators.setTeamJoinSuccess(true))
  } catch (error) {
    yield Saga.put(Creators.setTeamJoinError(error.desc))
  }
}

const _leaveTeam = function(action: Constants.LeaveTeam) {
  const {payload: {teamname}} = action
  return Saga.call(RPCTypes.teamsTeamLeaveRpcPromise, {
    param: {name: teamname, permanent: false},
  })
}

const _addPeopleToTeam = function*(action: Constants.AddPeopleToTeam) {
  const {payload: {role, teamname}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  const ids = yield Saga.select(SearchConstants.getUserInputItemIds, {searchKey: 'addToTeamSearch'})
  for (const id of ids) {
    yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
      param: {
        name: teamname,
        email: '',
        username: id,
        role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
        sendChatNotification: true,
      },
    })
  }
  yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(teamname))) // getDetails will unset loading
}

const _inviteByEmail = function*(action: Constants.InviteToTeamByEmail) {
  const {payload: {invitees, role, teamname}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  yield Saga.put(
    replaceEntity(['teams', 'teamNameToLoadingInvites'], I.Map([[teamname, I.Map([[invitees, true]])]]))
  )
  try {
    yield Saga.call(RPCTypes.teamsTeamAddEmailsBulkRpcPromise, {
      param: {
        name: teamname,
        emails: invitees,
        role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      },
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(teamname))) // getDetails will unset loading
    yield Saga.put(replaceEntity(['teams', 'teamNameToLoadingInvites', teamname], I.Map([[invitees, false]])))
  }
}

const _addToTeam = function*(action: Constants.AddToTeam) {
  const {payload: {name, email, username, role, sendChatNotification}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
      param: {
        name,
        email,
        username,
        role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
        sendChatNotification,
      },
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

const _editMembership = function*(action: Constants.EditMembership) {
  const {payload: {name, username, role}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamEditMemberRpcPromise, {
      param: {
        name,
        username,
        role: role ? RPCTypes.teamsTeamRole[role] : RPCTypes.teamsTeamRole.none,
      },
    })
  } finally {
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

const _removeMemberOrPendingInvite = function*(action: Constants.RemoveMemberOrPendingInvite) {
  const {payload: {name, username, email}} = action

  yield Saga.put(
    replaceEntity(['teams', 'teamNameToLoadingInvites'], I.Map([[name, I.Map([[username || email, true]])]]))
  )

  // disallow call with both username & email
  if (!!username && !!email) {
    const errMsg = 'Supplied both email and username to removeMemberOrPendingInvite'
    console.error(errMsg)
    throw new Error(errMsg)
  }

  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamRemoveMemberRpcPromise, {param: {email, name, username, inviteID: ''}})
  } finally {
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
    yield Saga.put(
      replaceEntity(
        ['teams', 'teamNameToLoadingInvites'],
        I.Map([[name, I.Map([[username || email, false]])]])
      )
    )
  }
}

const _inviteToTeamByPhone = function*(action: Constants.InviteToTeamByPhone) {
  const {payload: {teamname, phoneNumber}} = action
  yield Saga.put(
    replaceEntity(['teams', 'teamNameToLoadingInvites'], I.Map([[teamname, I.Map([[phoneNumber, true]])]]))
  )
  openSMS(phoneNumber, 'delicious seitan') // TODO replace with token from seitan call
  yield Saga.put(
    replaceEntity(['teams', 'teamNameToLoadingInvites'], I.Map([[teamname, I.Map([[phoneNumber, false]])]]))
  )
}

const _ignoreRequest = function*(action: Constants.IgnoreRequest) {
  const {payload: {name, username}} = action
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[name, true]])))
  try {
    yield Saga.call(RPCTypes.teamsTeamIgnoreRequestRpcPromise, {
      param: {
        name,
        username,
      },
    })
  } finally {
    // TODO handle error, but for now make sure loading is unset
    yield Saga.put((dispatch: Dispatch) => dispatch(Creators.getDetails(name))) // getDetails will unset loading
  }
}

function getPendingConvParticipants(state: TypedState, conversationIDKey: ChatConstants.ConversationIDKey) {
  if (!ChatConstants.isPendingConversationIDKey(conversationIDKey)) return null

  return state.chat.pendingConversations.get(conversationIDKey)
}

const _createNewTeamFromConversation = function*(
  action: Constants.CreateNewTeamFromConversation
): Saga.SagaGenerator<any, any> {
  const {payload: {conversationIDKey, name}} = action
  const me = yield Saga.select(usernameSelector)
  const inbox = yield Saga.select(ChatConstants.getInbox, conversationIDKey)
  let participants

  if (inbox) {
    participants = inbox.get('participants')
  } else {
    participants = yield Saga.select(getPendingConvParticipants, conversationIDKey)
  }

  if (participants) {
    yield Saga.put(Creators.setTeamCreationError(''))
    yield Saga.put(Creators.setTeamCreationPending(true))
    try {
      const createRes = yield Saga.call(RPCTypes.teamsTeamCreateRpcPromise, {
        param: {name, sendChatNotification: true},
      })
      for (const username of participants.toArray()) {
        if (!createRes.creatorAdded || username !== me) {
          yield Saga.call(RPCTypes.teamsTeamAddMemberRpcPromise, {
            param: {
              email: '',
              name,
              role: username === me ? RPCTypes.teamsTeamRole.admin : RPCTypes.teamsTeamRole.writer,
              sendChatNotification: true,
              username,
            },
          })
        }
      }
      yield Saga.put(ChatGen.createSelectConversation({conversationIDKey: null}))
    } catch (error) {
      yield Saga.put(Creators.setTeamCreationError(error.desc))
    } finally {
      yield Saga.put(Creators.setTeamCreationPending(false))
    }
  }
}

const _getDetails = function*(action: Constants.GetDetails): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname
  yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  try {
    const results: RPCTypes.TeamDetails = yield Saga.call(RPCTypes.teamsTeamGetRpcPromise, {
      param: {
        name: teamname,
        forceRepoll: false,
      },
    })

    // Get requests to join
    const requests: RPCTypes.TeamJoinRequest[] = yield Saga.call(RPCTypes.teamsTeamListRequestsRpcPromise)
    requests.sort((a, b) => a.username.localeCompare(b.username))

    const requestMap = requests.reduce((reqMap, req) => {
      if (!reqMap[req.name]) {
        reqMap[req.name] = I.List()
      }
      reqMap[req.name] = reqMap[req.name].push({username: req.username})
      return reqMap
    }, {})

    const infos = []
    let memberNames = I.Set()
    const types = ['admins', 'owners', 'readers', 'writers']
    const typeMap = {
      admins: 'admin',
      owners: 'owner',
      readers: 'reader',
      writers: 'writer',
    }
    types.forEach(type => {
      const details = results.members[type] || []
      details.forEach(({username}) => {
        infos.push(
          Constants.makeMemberInfo({
            type: typeMap[type],
            username,
          })
        )
        memberNames = memberNames.add(username)
      })
    })

    const invitesMap = map(results.annotatedActiveInvites, invite =>
      Constants.makeInviteInfo({
        email: invite.type.c === RPCTypes.teamsTeamInviteCategory.email ? invite.name : '',
        role: Constants.teamRoleByEnum[invite.role],
        username: invite.type.c === RPCTypes.teamsTeamInviteCategory.sbs
          ? `${invite.name}@${invite.type.sbs}`
          : '',
      })
    )

    // if we have no requests for this team, make sure we don't hold on to any old ones
    if (!requestMap[teamname]) {
      yield Saga.put(replaceEntity(['teams', 'teamNameToRequests'], I.Map([[teamname, I.Set()]])))
    }

    // Get publicity settings for this team.
    const publicity: RpcTypes.TeamAndMemberShowcase = yield Saga.call(
      RpcTypes.teamsGetTeamAndMemberShowcaseRpcPromise,
      {
        param: {
          name: teamname,
        },
      }
    )

    const publicityMap = {
      member: publicity.isMemberShowcased,
      team: publicity.teamShowcase.isShowcased,
    }

    yield Saga.all([
      Saga.put(replaceEntity(['teams', 'teamNameToMembers'], I.Map([[teamname, I.Set(infos)]]))),
      Saga.put(replaceEntity(['teams', 'teamNameToMemberUsernames'], I.Map([[teamname, memberNames]]))),
      Saga.put(replaceEntity(['teams', 'teamNameToRequests'], I.Map(requestMap))),
      Saga.put(replaceEntity(['teams', 'teamNameToTeamSettings'], I.Map({[teamname]: results.settings}))),
      Saga.put(replaceEntity(['teams', 'teamNameToInvites'], I.Map([[teamname, I.Set(invitesMap)]]))),
      Saga.put(replaceEntity(['teams', 'teamNameToPublicitySettings'], I.Map({[teamname]: publicityMap}))),
    ])
  } finally {
    yield Saga.put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, false]])))
  }
}

const _changeOpenTeamSetting = function*({
  payload: {teamname, convertToOpen, defaultRole},
}: Constants.MakeTeamOpen) {
  const param: RPCTypes.TeamsTeamSetSettingsRpcParam = {
    name: teamname,
    settings: {
      joinAs: RPCTypes.teamsTeamRole[defaultRole],
      open: convertToOpen,
    },
  }

  yield Saga.call(RPCTypes.teamsTeamSetSettingsRpcPromise, {param})
  yield Saga.put(Creators.getDetails(teamname))
}

const _getChannels = function*(action: Constants.GetChannels): Saga.SagaGenerator<any, any> {
  const teamname = action.payload.teamname
  const results: ChatTypes.GetTLFConversationsLocalRes = yield Saga.call(
    ChatTypes.localGetTLFConversationsLocalRpcPromise,
    {
      param: {
        membersType: ChatTypes.commonConversationMembersType.team,
        tlfName: teamname,
        topicType: ChatTypes.commonTopicType.chat,
      },
    }
  )

  const convIDs = []
  const convIDToChannelInfo = {}

  const convs = results.convs || []
  convs.forEach(conv => {
    const convID = ChatConstants.conversationIDToKey(conv.convID)
    convIDs.push(convID)
    convIDToChannelInfo[convID] = Constants.makeChannelInfo({
      channelname: conv.channel,
      description: conv.headline,
      participants: I.Set(conv.participants || []),
    })
  })

  yield Saga.all([
    Saga.put(replaceEntity(['teams', 'teamNameToConvIDs'], I.Map([[teamname, I.Set(convIDs)]]))),
    Saga.put(replaceEntity(['teams', 'convIDToChannelInfo'], I.Map(convIDToChannelInfo))),
  ])
}

const _getTeams = function*(action: Constants.GetTeams): Saga.SagaGenerator<any, any> {
  const username = yield Saga.select(usernameSelector)
  yield Saga.put(replaceEntity(['teams'], I.Map([['loaded', false]])))
  try {
    const results: RPCTypes.AnnotatedTeamList = yield Saga.call(RPCTypes.teamsTeamListRpcPromise, {
      param: {
        all: false,
        includeImplicitTeams: false,
        userAssertion: username,
      },
    })

    const teams = results.teams || []
    const teamnames = []
    const teammembercounts = {}
    teams.forEach(team => {
      teamnames.push(team.fqName)
      teammembercounts[team.fqName] = team.memberCount
    })

    yield Saga.put(
      replaceEntity(
        ['teams'],
        I.Map({teamnames: I.Set(teamnames), teammembercounts: I.Map(teammembercounts)})
      )
    )
  } finally {
    yield Saga.put(replaceEntity(['teams'], I.Map([['loaded', true]])))
  }
}

const _toggleChannelMembership = function*(
  action: Constants.ToggleChannelMembership
): Saga.SagaGenerator<any, any> {
  const {teamname, channelname} = action.payload
  const {conversationIDKey, participants, you} = yield Saga.select((state: TypedState) => {
    const conversationIDKey = Constants.getConversationIDKeyFromChannelName(state, channelname)
    return {
      conversationIDKey,
      participants: conversationIDKey ? Constants.getParticipants(state, conversationIDKey) : I.Set(),
      you: usernameSelector(state),
    }
  })

  if (participants.get(you)) {
    yield Saga.call(ChatTypes.localLeaveConversationLocalRpcPromise, {
      param: {
        convID: ChatConstants.keyToConversationID(conversationIDKey),
      },
    })
  } else {
    yield Saga.call(ChatTypes.localJoinConversationLocalRpcPromise, {
      param: {
        tlfName: teamname,
        topicName: channelname,
        topicType: ChatTypes.commonTopicType.chat,
        visibility: RPCTypes.commonTLFVisibility.private,
      },
    })
  }

  // reload
  yield Saga.put(Creators.getChannels(teamname))
}

function* _createChannel(action: Constants.CreateChannel) {
  const {payload: {channelname, description, teamname}} = action
  const result = yield Saga.call(ChatTypes.localNewConversationLocalRpcPromise, {
    param: {
      identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      membersType: ChatTypes.commonConversationMembersType.team,
      tlfName: teamname,
      tlfVisibility: RPCTypes.commonTLFVisibility.private,
      topicType: ChatTypes.commonTopicType.chat,
      topicName: channelname,
    },
  })

  const newConversationIDKey = result ? ChatConstants.conversationIDToKey(result.conv.info.id) : null
  if (!newConversationIDKey) {
    console.warn('No convoid from newConvoRPC')
    return null
  }

  // Select the new channel
  yield Saga.put(ChatGen.createSelectConversation({conversationIDKey: newConversationIDKey}))

  // If we were given a description, set it
  if (description) {
    yield Saga.call(ChatTypes.localPostHeadlineNonblockRpcPromise, {
      param: {
        conversationID: result.conv.info.id,
        tlfName: teamname,
        tlfPublic: false,
        headline: description,
        clientPrev: 0,
        identifyBehavior: RPCTypes.tlfKeysTLFIdentifyBehavior.chatGui,
      },
    })
  }
}

function* _setupTeamHandlers(): Saga.SagaGenerator<any, any> {
  yield Saga.put((dispatch: Dispatch) => {
    engine().setIncomingHandler('keybase.1.NotifyTeam.teamChanged', () => {
      dispatch(Creators.getTeams())
    })
    engine().setIncomingHandler('keybase.1.NotifyTeam.teamDeleted', () => {
      dispatch(Creators.getTeams())
    })
    engine().setIncomingHandler('keybase.1.NotifyTeam.teamExit', () => {
      dispatch(Creators.getTeams())
    })
  })
}

<<<<<<< HEAD
function* _setPublicityMember(action: Constants.SetPublicityMember) {
  const {payload: {enabled, teamname}} = action
  yield call(RpcTypes.teamsSetTeamMemberShowcaseRpcPromise, {
    param: {
      isShowcased: enabled,
      name: teamname,
    },
  })
  yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  // getDetails will unset loading and update the store with the new value
  yield put((dispatch: Dispatch) => dispatch(Creators.getDetails(teamname)))
}

function* _setPublicityTeam(action: Constants.SetPublicityTeam) {
  const {payload: {enabled, teamname}} = action
  yield call(RpcTypes.teamsSetTeamShowcaseRpcPromise, {
    param: {
      isShowcased: enabled,
      name: teamname,
    },
  })
  yield put(replaceEntity(['teams', 'teamNameToLoading'], I.Map([[teamname, true]])))
  // getDetails will unset loading and update the store with the new value
  yield put((dispatch: Dispatch) => dispatch(Creators.getDetails(teamname)))
}

const teamsSaga = function*(): SagaGenerator<any, any> {
=======
function* _badgeAppForTeams(action: Constants.BadgeAppForTeams) {
  const newTeams = I.Set(action.payload.newTeamNames || [])
  // Call getTeams if new teams come in.
  // Covers the case when we're staring at the teams page so
  // we don't miss a notification we clear when we tab away
  const existingNewTeams = yield Saga.select((state: TypedState) =>
    state.entities.getIn(['teams', 'newTeams'], I.Set())
  )
  if (!newTeams.equals(existingNewTeams)) {
    yield Saga.put(Creators.getTeams())
  }
  yield Saga.put(replaceEntity(['teams'], I.Map([['newTeams', newTeams]])))
}

let _wasOnTeamsTab = false
const _onTabChange = (action: RouteTreeConstants.SwitchTo) => {
  const list = I.List(action.payload.path)
  const root = list.first()

  if (root === teamsTab) {
    _wasOnTeamsTab = true
  } else if (_wasOnTeamsTab) {
    _wasOnTeamsTab = false
    // clear badges
    return Saga.call(RPCTypes.gregorDismissCategoryRpcPromise, {
      param: {
        category: 'team.newly_added_to_team',
      },
    })
  }
}

const teamsSaga = function*(): Saga.SagaGenerator<any, any> {
>>>>>>> d1966c9790f621a7ab06794ea84ae5d5d0c0c262
  yield Saga.safeTakeEveryPure('teams:leaveTeam', _leaveTeam)
  yield Saga.safeTakeEveryPure('teams:createNewTeam', _createNewTeam)
  yield Saga.safeTakeEvery('teams:makeTeamOpen', _changeOpenTeamSetting)
  yield Saga.safeTakeEvery('teams:joinTeam', _joinTeam)
  yield Saga.safeTakeEvery('teams:getDetails', _getDetails)
  yield Saga.safeTakeEvery('teams:createNewTeamFromConversation', _createNewTeamFromConversation)
  yield Saga.safeTakeEvery('teams:getChannels', _getChannels)
  yield Saga.safeTakeEvery('teams:getTeams', _getTeams)
  yield Saga.safeTakeEvery('teams:toggleChannelMembership', _toggleChannelMembership)
  yield Saga.safeTakeEvery('teams:createChannel', _createChannel)
  yield Saga.safeTakeEvery('teams:setupTeamHandlers', _setupTeamHandlers)
  yield Saga.safeTakeEvery('teams:addToTeam', _addToTeam)
  yield Saga.safeTakeEvery('teams:addPeopleToTeam', _addPeopleToTeam)
  yield Saga.safeTakeEvery('teams:inviteToTeamByEmail', _inviteByEmail)
  yield Saga.safeTakeEvery('teams:ignoreRequest', _ignoreRequest)
  yield Saga.safeTakeEvery('teams:editMembership', _editMembership)
  yield Saga.safeTakeEvery('teams:removeMemberOrPendingInvite', _removeMemberOrPendingInvite)
  yield Saga.safeTakeEvery('teams:badgeAppForTeams', _badgeAppForTeams)
  yield Saga.safeTakeEveryPure(RouteTreeConstants.switchTo, _onTabChange)
  yield Saga.safeTakeEvery('teams:inviteToTeamByPhone', _inviteToTeamByPhone)
  yield Saga.safeTakeEvery('teams:setPublicityMember', _setPublicityMember)
  yield Saga.safeTakeEvery('teams:setPublicityTeam', _setPublicityTeam)
}

export default teamsSaga
