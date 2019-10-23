import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as MessageTypes from '../../../../../constants/types/chat2/message'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as TeamConstants from '../../../../../constants/teams'
import * as I from 'immutable'
import TeamJourney from './index'

type OwnProps = {
  message: I.RecordOf<MessageTypes._MessageJourneycard>
}

type Props = {
  message: I.RecordOf<MessageTypes._MessageJourneycard>
  otherChannels: Array<string>
  onBrowseChannels: () => void
  onGoToChannel: (channelname: string) => void
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

  switch (props.message.cardType) {
    case RPCChatTypes.JourneycardType.welcome:
      text = 'Welcome to the team! Say hi to everyone and introduce yourself.'
      actions = [
        {label: 'Publish team on your own profile', onClick: props.onPublishTeam},
        {label: 'Browse channels', onClick: props.onBrowseChannels},
      ]
      break
    case RPCChatTypes.JourneycardType.popularChannels:
      text = 'You are in #somechan. Other popular channels in this team:'
      actions = props.otherChannels.map(chan => ({label: chan, onClick: () => props.onGoToChannel(chan)}))
      break
    case RPCChatTypes.JourneycardType.addPeople:
      text = `Do you know people interested in joining? ${props.teamname} is open to anyone.`
      break
    case RPCChatTypes.JourneycardType.createChannels:
      text = 'Go ahead and create #channels around topics you think are missing.'
      break
    case RPCChatTypes.JourneycardType.msgAttention:
      text = 'One of your messages is getting a lot of attention!'
      break
    case RPCChatTypes.JourneycardType.userAwayForLong:
      text = 'Long time no see! Look at all the things you missed.'
      break
    case RPCChatTypes.JourneycardType.channelInactive:
      text = 'Zzz… This channel hasn’t been very active…. Revive it?'
      break
    case RPCChatTypes.JourneycardType.msgNoAnswer:
      text = 'People haven’t been talkative in a while. Perhaps post in another channel?'
      break
    default:
      console.warn(`Unexpected journey card type: ${props.message.cardType}`)
      return <Kb.Box2 direction="horizontal" />
  }

  return props.teamname ? (
    <TeamJourney actions={actions} image={image} teamname={props.teamname} text={text} />
  ) : (
    <Kb.Box2 direction="horizontal" />
  )
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const teamname = Constants.getMeta(state, ownProps.message.conversationIDKey).teamname
  return {
    _channelInfos: TeamConstants.getTeamChannelInfos(state, teamname),
    teamname,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onBrowseChannels: (teamname: string) =>
    dispatch(
      RouteTreeGen.createNavigateAppend({path: [{props: {teamname}, selected: 'chatManageChannels'}]})
    ),
  _onGoToChannel: (channelname: string, teamname: string) =>
    dispatch(Chat2Gen.createPreviewConversation({channelname, reason: 'journeyCardPopular', teamname})),
  _onPublishTeam: () => dispatch(RouteTreeGen.createNavigateAppend({path: ['profileShowcaseTeamOffer']})),
})

const TeamJourneyConnected = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => {
    const otherChannels = stateProps._channelInfos
      .map(info => info.channelname)
      .valueSeq()
      .toArray()
    return {
      ...stateProps,
      ...dispatchProps,
      ...ownProps,
      onBrowseChannels: () => dispatchProps._onBrowseChannels(stateProps.teamname),
      onGoToChannel: (channelName: string) => dispatchProps._onGoToChannel(channelName, stateProps.teamname),
      onPublishTeam: () => dispatchProps._onPublishTeam(),
      otherChannels,
    }
  }
)(TeamJourneyContainer)

export default TeamJourneyConnected
