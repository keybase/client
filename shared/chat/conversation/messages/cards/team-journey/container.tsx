import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as TeamsGen from '../../../../../actions/teams-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as MessageTypes from '../../../../../constants/types/chat2/message'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as TeamConstants from '../../../../../constants/teams'
import * as TeamTypes from '../../../../../constants/types/teams'
import {teamsTab} from '../../../../../constants/tabs'
import * as ChatTypes from '../../../../../constants/types/chat2'
import {TeamJourney, Action} from '.'
import {renderWelcomeMessage} from './util'
import {useAllChannelMetas} from '../../../../../teams/common/channel-hooks'

type OwnProps = {
  message: MessageTypes.MessageJourneycard
}

type Props = {
  canShowcase: boolean
  cannotWrite: boolean
  channelname: string
  conversationIDKey: ChatTypes.ConversationIDKey
  message: MessageTypes.MessageJourneycard
  onAddPeopleToTeam: () => void
  onBrowseChannels: () => void
  onCreateChatChannels: () => void
  onDismiss: () => void
  onGoToChannel: (channelname: string) => void
  onPublishTeam: () => void
  onScrollBack: () => void
  onShowTeam: () => void
  onAuthorClick: () => void
  teamID: TeamTypes.TeamID
  teamname: string
  isBigTeam: boolean
  welcomeMessage: RPCChatTypes.WelcomeMessageDisplay | null
}

const TeamJourneyContainer = (props: Props) => {
  let textComponent: React.ReactNode
  let image: Kb.IconType | null = null
  let actions: Array<Action> = []

  const dontCallRPC =
    props.message.cardType !== RPCChatTypes.JourneycardType.popularChannels &&
    props.message.cardType !== RPCChatTypes.JourneycardType.msgNoAnswer
  const {channelMetas} = useAllChannelMetas(props.teamID, dontCallRPC)
  // Take the top three channels with most recent activity.
  const joinableStatuses = new Set<ChatTypes.ConversationMeta['membershipType']>([
    // keep in sync with journey_card_manager.go
    'notMember' as const,
    'youAreReset' as const,
  ])
  const otherChannelsBase = [...channelMetas.values()]
    .filter(info => info.channelname !== props.channelname)
    .sort((x, y) => y.timestamp - x.timestamp)

  switch (props.message.cardType) {
    case RPCChatTypes.JourneycardType.welcome:
      image = 'icon-illustration-welcome-96'
      if (!props.cannotWrite) {
        actions.push('wave')
      }
      if (props.isBigTeam) {
        actions.push({label: 'Browse channels', onClick: props.onBrowseChannels})
      }
      if (props.canShowcase) {
        actions.push({label: 'Publish team on your profile', onClick: props.onPublishTeam})
      }
      if (props.welcomeMessage) {
        textComponent = renderWelcomeMessage(props.welcomeMessage, props.cannotWrite)
      } else {
        textComponent = <Kb.ProgressIndicator />
      }
      break
    case RPCChatTypes.JourneycardType.popularChannels:
      {
        const otherChannelsForPopular = otherChannelsBase
          .filter(({membershipType}) => joinableStatuses.has(membershipType))
          .slice(0, Container.isMobile ? 2 : 3)
          .map(info => info.channelname)
        actions = otherChannelsForPopular.map(chan => ({
          label: `#${chan}`,
          onClick: () => props.onGoToChannel(chan),
        }))
        textComponent = (
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodySmall">
              You are in <Kb.Text type="BodySmallBold">#{props.channelname}</Kb.Text>.
            </Kb.Text>
            <Kb.Text type="BodySmall">
              {otherChannelsForPopular.length
                ? `Other channels in this team are:`
                : `And you're in all the other channels, nice.`}
            </Kb.Text>
          </Kb.Box2>
        )
      }
      break
    case RPCChatTypes.JourneycardType.addPeople:
      actions = [{label: 'Add people to the team', onClick: props.onAddPeopleToTeam}]
      image = 'icon-illustration-friends-96'
      textComponent = props.message.openTeam ? (
        <Kb.Text type="BodySmall">
          Do you know people interested in joining?{' '}
          <Kb.Text onClick={props.onShowTeam} type="BodySmallBold">
            {props.teamname}
          </Kb.Text>{' '}
          is open to anyone.
        </Kb.Text>
      ) : (
        <Kb.Text type="BodySmall">
          Do you know people interested in joining{' '}
          <Kb.Text onClick={props.onShowTeam} type="BodySmallBold">
            {props.teamname}
          </Kb.Text>
          ?
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
      {
        const otherChannelsForNoAnswer = otherChannelsBase
          .slice(0, Container.isMobile ? 2 : 3)
          .map(info => info.channelname)
        actions = otherChannelsForNoAnswer.map(chan => ({
          label: `#${chan}`,
          onClick: () => props.onGoToChannel(chan),
        }))
        textComponent = (
          <Kb.Text type="BodySmall">
            People haven’t been talkative in a while. Perhaps post in another channel?
          </Kb.Text>
        )
      }
      break
    default:
      console.warn(`Unexpected journey card type: ${props.message.cardType}`)
      return <Kb.Box2 direction="horizontal" />
  }

  return props.teamname ? (
    <TeamJourney
      actions={actions}
      image={image}
      onAuthorClick={props.onAuthorClick}
      teamname={props.teamname}
      conversationIDKey={props.conversationIDKey}
      textComponent={textComponent}
      onDismiss={props.onDismiss}
      mode="chat"
    />
  ) : null
}

const TeamJourneyConnected = Container.connect(
  (state, ownProps: OwnProps) => {
    const conv = Constants.getMeta(state, ownProps.message.conversationIDKey)
    const {cannotWrite, channelname, conversationIDKey, teamname, teamID} = conv
    const welcomeMessage = {display: '', raw: '', set: false}
    return {
      _teamID: teamID,
      canShowcase: TeamConstants.canShowcase(state, teamID),
      cannotWrite: cannotWrite,
      channelname,
      conversationIDKey,
      isBigTeam: TeamConstants.isBigTeam(state, teamID),
      teamname,
      welcomeMessage,
    }
  },
  dispatch => ({
    _onAddPeopleToTeam: (teamID: TeamTypes.TeamID) =>
      dispatch(TeamsGen.createStartAddMembersWizard({teamID})),
    _onAuthorClick: (teamID: TeamTypes.TeamID) =>
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [teamsTab, {props: {teamID}, selected: 'team'}],
        })
      ),
    _onCreateChannel: (teamID: string) =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {teamID}, selected: 'chatCreateChannel'}]})),
    _onDismiss: (
      conversationIDKey: ChatTypes.ConversationIDKey,
      cardType: RPCChatTypes.JourneycardType,
      ordinal: ChatTypes.Ordinal
    ) => dispatch(Chat2Gen.createDismissJourneycard({cardType, conversationIDKey, ordinal})),
    _onGoToChannel: (channelname: string, teamname: string) =>
      dispatch(Chat2Gen.createPreviewConversation({channelname, reason: 'journeyCardPopular', teamname})),
    _onManageChannels: (teamID: string) => dispatch(TeamsGen.createManageChatChannels({teamID})),
    _onPublishTeam: (teamID: string) => {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['profileShowcaseTeamOffer']}))
      dispatch(TeamsGen.createSetMemberPublicity({showcase: true, teamID}))
    },
    _onShowTeam: (teamID: TeamTypes.TeamID) =>
      dispatch(RouteTreeGen.createNavigateAppend({path: [teamsTab, {props: {teamID}, selected: 'team'}]})),
  }),
  (stateProps, dispatchProps, ownProps) => {
    const {
      canShowcase,
      cannotWrite,
      channelname,
      conversationIDKey,
      teamname,
      isBigTeam,
      welcomeMessage,
    } = stateProps

    return {
      canShowcase,
      cannotWrite,
      channelname,
      conversationIDKey,
      isBigTeam,
      message: ownProps.message,
      onAddPeopleToTeam: () => dispatchProps._onAddPeopleToTeam(stateProps._teamID),
      onAuthorClick: () => dispatchProps._onAuthorClick(stateProps._teamID),
      onBrowseChannels: () => dispatchProps._onManageChannels(stateProps._teamID),
      onCreateChatChannels: () => dispatchProps._onCreateChannel(stateProps._teamID),
      onDismiss: () =>
        dispatchProps._onDismiss(
          stateProps.conversationIDKey,
          ownProps.message.cardType,
          ownProps.message.ordinal
        ),
      onGoToChannel: (channelName: string) => dispatchProps._onGoToChannel(channelName, stateProps.teamname),
      onPublishTeam: () => dispatchProps._onPublishTeam(stateProps._teamID),
      onScrollBack: () => console.log('onScrollBack'),
      onShowTeam: () => dispatchProps._onShowTeam(stateProps._teamID),
      teamID: stateProps._teamID,
      teamname,
      welcomeMessage,
    }
  }
)(TeamJourneyContainer)

export default TeamJourneyConnected
