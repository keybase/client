import * as C from '../../../../../constants'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as TeamConstants from '../../../../../constants/teams'
import type * as ChatTypes from '../../../../../constants/types/chat2'
import type * as MessageTypes from '../../../../../constants/types/chat2/message'
import type * as TeamTypes from '../../../../../constants/types/teams'
import {TeamJourney, type Action} from '.'
import {makeMessageJourneycard} from '../../../../../constants/chat2/message'
import {renderWelcomeMessage} from './util'
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
  welcomeMessage?: RPCChatTypes.WelcomeMessageDisplay
}

const TeamJourneyContainer = (props: Props) => {
  let textComponent: React.ReactNode
  let image: Kb.IconType | undefined
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

const TeamJourneyConnected = (ownProps: OwnProps) => {
  const {conversationIDKey, ordinal} = ownProps
  const m = Constants.useContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'journeycard' ? m : emptyJourney
  const conv = Constants.useContext(s => s.meta)
  const {cannotWrite, channelname, teamname, teamID} = conv
  const welcomeMessage = {display: '', raw: '', set: false}
  const _teamID = teamID
  const canShowcase = C.useTeamsState(s => TeamConstants.canShowcase(s, teamID))
  const isBigTeam = C.useChatState(s => Constants.isBigTeam(s, teamID))

  const dispatch = Container.useDispatch()

  const startAddMembersWizard = C.useTeamsState(s => s.dispatch.startAddMembersWizard)
  const _onAddPeopleToTeam = (teamID: TeamTypes.TeamID) => startAddMembersWizard(teamID)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onAuthorClick = (teamID: TeamTypes.TeamID) => navigateAppend({props: {teamID}, selected: 'team'})
  const _onCreateChannel = (teamID: string) =>
    navigateAppend({props: {teamID}, selected: 'chatCreateChannel'})
  const _onDismiss = (
    conversationIDKey: ChatTypes.ConversationIDKey,
    cardType: RPCChatTypes.JourneycardType,
    ordinal: ChatTypes.Ordinal
  ) => dispatch(Chat2Gen.createDismissJourneycard({cardType, conversationIDKey, ordinal}))
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const _onGoToChannel = (channelname: string, teamname: string) =>
    previewConversation({channelname, reason: 'journeyCardPopular', teamname})
  const manageChatChannels = C.useTeamsState(s => s.dispatch.manageChatChannels)
  const _onManageChannels = (teamID: string) => manageChatChannels(teamID)

  const setMemberPublicity = C.useTeamsState(s => s.dispatch.setMemberPublicity)
  const _onPublishTeam = (teamID: string) => {
    navigateAppend('profileShowcaseTeamOffer')
    setMemberPublicity(teamID, true)
  }
  const _onShowTeam = (teamID: TeamTypes.TeamID) => navigateAppend({props: {teamID}, selected: 'team'})
  const props = {
    canShowcase,
    cannotWrite,
    channelname,
    conversationIDKey,
    isBigTeam,
    message,
    onAddPeopleToTeam: () => _onAddPeopleToTeam(_teamID),
    onAuthorClick: () => _onAuthorClick(_teamID),
    onBrowseChannels: () => _onManageChannels(_teamID),
    onCreateChatChannels: () => _onCreateChannel(_teamID),
    onDismiss: () => _onDismiss(conversationIDKey, message.cardType, message.ordinal),
    onGoToChannel: (channelName: string) => _onGoToChannel(channelName, teamname),
    onPublishTeam: () => _onPublishTeam(_teamID),
    onScrollBack: () => console.log('onScrollBack'),
    onShowTeam: () => _onShowTeam(_teamID),
    teamID: _teamID,
    teamname,
    welcomeMessage,
  }
  return <TeamJourneyContainer {...props} />
}

export default TeamJourneyConnected
