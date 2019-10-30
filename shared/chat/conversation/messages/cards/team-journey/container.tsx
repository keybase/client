import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as MessageTypes from '../../../../../constants/types/chat2/message'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as TeamConstants from '../../../../../constants/teams'
import * as TeamsGen from '../../../../../actions/teams-gen'
import {appendNewTeamBuilder} from '../../../../../actions/typed-routes'

import * as I from 'immutable'
import TeamJourney from './index'

type OwnProps = {
  message: I.RecordOf<MessageTypes._MessageJourneycard>
}

type Props = {
  channelname: string
  message: I.RecordOf<MessageTypes._MessageJourneycard>
  otherChannels: Array<string>
  onAddPeopleToTeam: () => void
  onBrowseChannels: () => void
  onCreateChatChannels: () => void
  onGoToChannel: (channelname: string) => void
  onLoadTeam: () => void
  onPublishTeam: () => void
  teamname: string
}

type Action = {
  label: string
  onClick: () => void
}

const TeamJourneyContainer = (props: Props) => {
  let text = ''
  const image = ''
  let actions: Array<Action> = []
  let loadTeam: (() => void) | null = null

  switch (props.message.cardType) {
    case RPCChatTypes.JourneycardType.welcome:
      text = 'Welcome to the team! Say hi to everyone and introduce yourself.'
      actions = [
        {label: 'Publish team on your own profile', onClick: props.onPublishTeam},
        {label: 'Browse channels', onClick: props.onBrowseChannels},
      ]
      break
    case RPCChatTypes.JourneycardType.popularChannels:
      text = `You are in ${props.channelname}. Some popular channels in this team:`
      loadTeam = props.onLoadTeam
      actions = props.otherChannels.map(chan => ({label: chan, onClick: () => props.onGoToChannel(chan)}))
      break
    case RPCChatTypes.JourneycardType.addPeople:
      text = `Do you know people interested in joining? ${props.teamname} is open to anyone.`
      actions = [{label: 'Add people to the team', onClick: props.onAddPeopleToTeam}]
      break
    case RPCChatTypes.JourneycardType.createChannels:
      text = 'Go ahead and create #channels around topics you think are missing.'
      actions = [{label: 'Create chat channels', onClick: props.onCreateChatChannels}]
      break
    case RPCChatTypes.JourneycardType.msgAttention:
      // XXX: implement
      text = 'One of your messages is getting a lot of attention!'
      break
    case RPCChatTypes.JourneycardType.userAwayForLong:
      // XXX: implement
      text = 'Long time no see! Look at all the things you missed.'
      break
    case RPCChatTypes.JourneycardType.channelInactive:
      text = 'Zzz… This channel hasn’t been very active…. Revive it?'
      break
    case RPCChatTypes.JourneycardType.msgNoAnswer:
      text = 'People haven’t been talkative in a while. Perhaps post in another channel?'
      loadTeam = props.onLoadTeam
      actions = props.otherChannels.map(chan => ({label: chan, onClick: () => props.onGoToChannel(chan)}))
      break
    default:
      console.warn(`Unexpected journey card type: ${props.message.cardType}`)
      return <Kb.Box2 direction="horizontal" />
  }

  return props.teamname ? (
    <TeamJourney actions={actions} image={image} loadTeam={loadTeam} teamname={props.teamname} text={text} />
  ) : (
    <Kb.Box2 direction="horizontal" />
  )
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const conv = Constants.getMeta(state, ownProps.message.conversationIDKey)
  const {channelname, teamname} = conv
  return {
    _channelInfos: TeamConstants.getTeamChannelInfos(state, teamname),
    channelname,
    teamname,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onAddPeopleToTeam: (teamname: string) => dispatch(appendNewTeamBuilder(teamname)),
  _onBrowseChannels: (teamname: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
    ),
  _onCreateChatChannels: (teamname: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
    ),
  _onGoToChannel: (channelname: string, teamname: string) =>
    dispatch(Chat2Gen.createPreviewConversation({channelname, reason: 'journeyCardPopular', teamname})),
  _onLoadTeam: (teamname: string) => dispatch(TeamsGen.createGetChannels({teamname})),
  _onPublishTeam: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileShowcaseTeamOffer']})),
})

const TeamJourneyConnected = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => {
    const {channelname, teamname} = stateProps
    // Take the top three channels with most recent activity.
    const otherChannels = stateProps._channelInfos
      .valueSeq()
      .toArray()
      .sort((x, y) => y.mtime - x.mtime)
      .map(info => info.channelname)
      .slice(0, 3)

    return {
      channelname,
      message: ownProps.message,
      onAddPeopleToTeam: () => dispatchProps._onAddPeopleToTeam(stateProps.teamname),
      onBrowseChannels: () => dispatchProps._onBrowseChannels(stateProps.teamname),
      onCreateChatChannels: () => dispatchProps._onCreateChatChannels(stateProps.teamname),
      onGoToChannel: (channelName: string) => dispatchProps._onGoToChannel(channelName, stateProps.teamname),
      onLoadTeam: () => dispatchProps._onLoadTeam(stateProps.teamname),
      onPublishTeam: () => dispatchProps._onPublishTeam(),
      otherChannels,
      teamname,
    }
  }
)(TeamJourneyContainer)

export default TeamJourneyConnected
