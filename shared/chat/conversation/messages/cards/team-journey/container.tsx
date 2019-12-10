import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as MessageTypes from '../../../../../constants/types/chat2/message'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as TeamConstants from '../../../../../constants/teams'
import * as TeamTypes from '../../../../../constants/types/teams'
import * as TeamsGen from '../../../../../actions/teams-gen'
import {teamsTab} from '../../../../../constants/tabs'
import {appendNewTeamBuilder} from '../../../../../actions/typed-routes'
import TeamJourney from '.'

type OwnProps = {
  message: MessageTypes.MessageJourneycard
}

type Props = {
  channelname: string
  message: MessageTypes.MessageJourneycard
  otherChannels: Array<string>
  onAddPeopleToTeam: () => void
  onBrowseChannels: () => void
  onCreateChatChannels: () => void
  onGoToChannel: (channelname: string) => void
  onLoadTeam: () => void
  onPublishTeam: () => void
  onScrollBack: () => void
  onShowTeam: () => void
  teamname: string
}

type Action = {
  label: string
  onClick: () => void
}

const TeamJourneyContainer = (props: Props) => {
  let textComponent: React.ReactNode
  let image: Kb.IconType | null = null
  let actions: Array<Action> = []
  let loadTeam: (() => void) | undefined

  switch (props.message.cardType) {
    case RPCChatTypes.JourneycardType.welcome:
      actions = [
        {label: 'Publish team on your own profile', onClick: props.onPublishTeam},
        {label: 'Browse channels', onClick: props.onBrowseChannels},
      ]
      image = 'icon-illustration-welcome-96'
      textComponent = (
        <Kb.Text type="BodySmall">Welcome to the team! Say hi to everyone and introduce yourself.</Kb.Text>
      )
      break
    case RPCChatTypes.JourneycardType.popularChannels:
      actions = props.otherChannels.map(chan => ({
        label: `#${chan}`,
        onClick: () => props.onGoToChannel(chan),
      }))
      loadTeam = props.onLoadTeam
      textComponent = (
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodySmall">
            You are in <Kb.Text type="BodySmallBold">#{props.channelname}</Kb.Text>.
          </Kb.Text>
          <Kb.Text type="BodySmall">
            {props.otherChannels.length
              ? `Some other channels in this team:`
              : `And you're in all the other channels, nice.`}
          </Kb.Text>
        </Kb.Box2>
      )
      break
    case RPCChatTypes.JourneycardType.addPeople:
      actions = [{label: 'Add people to the team', onClick: props.onAddPeopleToTeam}]
      image = 'icon-illustration-friends-96'
      textComponent = (
        <Kb.Text type="BodySmall">
          Do you know people interested in joining?{' '}
          <Kb.Text onClick={props.onShowTeam} type="BodySmallBold">
            {props.teamname}
          </Kb.Text>{' '}
          is open to anyone.
        </Kb.Text>
      )
      break
    case RPCChatTypes.JourneycardType.createChannels:
      actions = [{label: 'Create chat channels', onClick: props.onCreateChatChannels}]
      image = 'icon-illustration-happy-chat-96'
      textComponent = (
        <Kb.Text type="BodySmall">
          Go ahead and create <Kb.Text type="BodySmallBold">#channels</Kb.Text> around topics you think are
          missing.
        </Kb.Text>
      )
      break
    case RPCChatTypes.JourneycardType.msgAttention:
      // XXX: implement
      image = 'icon-illustration-attention-64'
      textComponent = <Kb.Text type="BodySmall">One of your messages is getting a lot of attention!</Kb.Text>
      break
    case RPCChatTypes.JourneycardType.channelInactive:
      image = 'icon-illustration-sleepy-96'
      textComponent = (
        <Kb.Text type="BodySmall">Zzz… This channel hasn’t been very active…. Revive it?</Kb.Text>
      )
      break
    case RPCChatTypes.JourneycardType.msgNoAnswer:
      actions = props.otherChannels.map(chan => ({
        label: `#${chan}`,
        onClick: () => props.onGoToChannel(chan),
      }))
      loadTeam = props.onLoadTeam
      textComponent = (
        <Kb.Text type="BodySmall">
          People haven’t been talkative in a while. Perhaps post in another channel?
        </Kb.Text>
      )
      break
    default:
      console.warn(`Unexpected journey card type: ${props.message.cardType}`)
      return <Kb.Box2 direction="horizontal" />
  }

  return props.teamname ? (
    <TeamJourney
      actions={actions}
      image={image}
      loadTeam={loadTeam}
      teamname={props.teamname}
      textComponent={textComponent}
    />
  ) : null
}

const mapStateToProps = (state: Container.TypedState, ownProps: OwnProps) => {
  const conv = Constants.getMeta(state, ownProps.message.conversationIDKey)
  const {channelname, teamname, teamID} = conv
  return {
    _channelInfos: TeamConstants.getTeamChannelInfos(state, teamname),
    _teamID: teamID,
    channelname,
    teamname,
  }
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onAddPeopleToTeam: (teamID: TeamTypes.TeamID) => dispatch(appendNewTeamBuilder(teamID)),
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
  _onShowTeam: (teamID: TeamTypes.TeamID) =>
    dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamID}, selected: 'team'}]})),
})

const TeamJourneyConnected = Container.connect(
  mapStateToProps,
  mapDispatchToProps,
  (stateProps, dispatchProps, ownProps) => {
    const {channelname, teamname} = stateProps
    // Take the top three channels with most recent activity.
    const joinableStatuses = new Set([
      // keep in sync with journey_card_manager.go
      RPCChatTypes.ConversationMemberStatus.removed,
      RPCChatTypes.ConversationMemberStatus.left,
      RPCChatTypes.ConversationMemberStatus.reset,
      RPCChatTypes.ConversationMemberStatus.neverJoined,
    ])
    const otherChannels = [...stateProps._channelInfos.values()]
      .filter(info => joinableStatuses.has(info.memberStatus))
      .sort((x, y) => y.mtime - x.mtime)
      .slice(0, Container.isMobile ? 2 : 3)
      .map(info => info.channelname)

    return {
      channelname,
      message: ownProps.message,
      onAddPeopleToTeam: () => dispatchProps._onAddPeopleToTeam(stateProps._teamID),
      onBrowseChannels: () => dispatchProps._onBrowseChannels(stateProps.teamname),
      onCreateChatChannels: () => dispatchProps._onCreateChatChannels(stateProps.teamname),
      onGoToChannel: (channelName: string) => dispatchProps._onGoToChannel(channelName, stateProps.teamname),
      onLoadTeam: () => dispatchProps._onLoadTeam(stateProps.teamname),
      onPublishTeam: () => dispatchProps._onPublishTeam(),
      onScrollBack: () => console.log('onScrollBack'),
      onShowTeam: () => dispatchProps._onShowTeam(stateProps._teamID),
      otherChannels,
      teamname,
    }
  }
)(TeamJourneyContainer)

export default TeamJourneyConnected
