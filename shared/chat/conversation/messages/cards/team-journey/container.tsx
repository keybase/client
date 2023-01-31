import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as RouteTreeGen from '../../../../../actions/route-tree-gen'
import * as TeamConstants from '../../../../../constants/teams'
import * as TeamsGen from '../../../../../actions/teams-gen'
import type * as ChatTypes from '../../../../../constants/types/chat2'
import type * as MessageTypes from '../../../../../constants/types/chat2/message'
import type * as TeamTypes from '../../../../../constants/types/teams'
import {TeamJourney, type Action} from '.'
import {makeMessageJourneycard} from '../../../../../constants/chat2/message'
import {renderWelcomeMessage} from './util'
import {teamsTab} from '../../../../../constants/tabs'
import {useAllChannelMetas} from '../../../../../teams/common/channel-hooks'

type OwnProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  ordinal: ChatTypes.Ordinal
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
      return null
    case RPCChatTypes.JourneycardType.createChannels:
      return null
    case RPCChatTypes.JourneycardType.msgAttention:
      return null
    case RPCChatTypes.JourneycardType.channelInactive:
      return null
    case RPCChatTypes.JourneycardType.msgNoAnswer:
      return null
    default:
      console.warn(`Unexpected journey card type: ${props.message.cardType}`)
      return null
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

const emptyJourney = makeMessageJourneycard({})

const TeamJourneyConnected = Container.connect(
  (state, ownProps: OwnProps) => {
    const {conversationIDKey, ordinal} = ownProps
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const message = m?.type === 'journeycard' ? m : emptyJourney
    const conv = Constants.getMeta(state, conversationIDKey)
    const {cannotWrite, channelname, teamname, teamID} = conv
    const welcomeMessage = {display: '', raw: '', set: false}
    return {
      _teamID: teamID,
      canShowcase: TeamConstants.canShowcase(state, teamID),
      cannotWrite: cannotWrite,
      channelname,
      conversationIDKey,
      isBigTeam: TeamConstants.isBigTeam(state, teamID),
      message,
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
  (stateProps, dispatchProps) => {
    const {
      canShowcase,
      cannotWrite,
      channelname,
      conversationIDKey,
      teamname,
      isBigTeam,
      welcomeMessage,
      message,
    } = stateProps

    return {
      canShowcase,
      cannotWrite,
      channelname,
      conversationIDKey,
      isBigTeam,
      message,
      onAddPeopleToTeam: () => dispatchProps._onAddPeopleToTeam(stateProps._teamID),
      onAuthorClick: () => dispatchProps._onAuthorClick(stateProps._teamID),
      onBrowseChannels: () => dispatchProps._onManageChannels(stateProps._teamID),
      onCreateChatChannels: () => dispatchProps._onCreateChannel(stateProps._teamID),
      onDismiss: () =>
        dispatchProps._onDismiss(stateProps.conversationIDKey, message.cardType, message.ordinal),
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
