import * as C from '../../../../../constants'
import * as T from '../../../../../constants/types'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as Kb from '../../../../../common-adapters'
import * as React from 'react'
import * as TeamConstants from '../../../../../constants/teams'
import {TeamJourney, type Action} from '.'
import {makeMessageJourneycard} from '../../../../../constants/chat2/message'
import {renderWelcomeMessage} from './util'
import {useAllChannelMetas} from '../../../../../teams/common/channel-hooks'

type OwnProps = {
  ordinal: T.Chat.Ordinal
}

type Props = {
  canShowcase: boolean
  cannotWrite: boolean
  channelname: string
  message: T.Chat.MessageJourneycard
  onAddPeopleToTeam: () => void
  onBrowseChannels: () => void
  onCreateChatChannels: () => void
  onDismiss: () => void
  onGoToChannel: (channelname: string) => void
  onPublishTeam: () => void
  onScrollBack: () => void
  onShowTeam: () => void
  onAuthorClick: () => void
  teamID: T.Teams.TeamID
  teamname: string
  isBigTeam: boolean
  welcomeMessage?: T.RPCChat.WelcomeMessageDisplay
}

const TeamJourneyContainer = (props: Props) => {
  let textComponent: React.ReactNode
  let image: Kb.IconType | undefined
  let actions: Array<Action> = []

  const dontCallRPC =
    props.message.cardType !== T.RPCChat.JourneycardType.popularChannels &&
    props.message.cardType !== T.RPCChat.JourneycardType.msgNoAnswer
  const {channelMetas} = useAllChannelMetas(props.teamID, dontCallRPC)
  // Take the top three channels with most recent activity.
  const joinableStatuses = new Set<T.Chat.ConversationMeta['membershipType']>([
    // keep in sync with journey_card_manager.go
    'notMember' as const,
    'youAreReset' as const,
  ])
  const otherChannelsBase = [...channelMetas.values()]
    .filter(info => info.channelname !== props.channelname)
    .sort((x, y) => y.timestamp - x.timestamp)

  switch (props.message.cardType) {
    case T.RPCChat.JourneycardType.welcome:
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
    case T.RPCChat.JourneycardType.popularChannels:
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
    case T.RPCChat.JourneycardType.addPeople:
      return null
    case T.RPCChat.JourneycardType.createChannels:
      return null
    case T.RPCChat.JourneycardType.msgAttention:
      return null
    case T.RPCChat.JourneycardType.channelInactive:
      return null
    case T.RPCChat.JourneycardType.msgNoAnswer:
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
      textComponent={textComponent}
      onDismiss={props.onDismiss}
      mode="chat"
    />
  ) : null
}

const emptyJourney = makeMessageJourneycard({})

const TeamJourneyConnected = (ownProps: OwnProps) => {
  const {ordinal} = ownProps
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'journeycard' ? m : emptyJourney
  const conv = C.useChatContext(s => s.meta)
  const {cannotWrite, channelname, teamname, teamID} = conv
  const welcomeMessage = {display: '', raw: '', set: false}
  const _teamID = teamID
  const canShowcase = C.useTeamsState(s => TeamConstants.canShowcase(s, teamID))
  const isBigTeam = C.useChatState(s => Constants.isBigTeam(s, teamID))
  const startAddMembersWizard = C.useTeamsState(s => s.dispatch.startAddMembersWizard)
  const _onAddPeopleToTeam = (teamID: T.Teams.TeamID) => startAddMembersWizard(teamID)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onAuthorClick = (teamID: T.Teams.TeamID) => navigateAppend({props: {teamID}, selected: 'team'})
  const _onCreateChannel = (teamID: string) =>
    navigateAppend({props: {teamID}, selected: 'chatCreateChannel'})
  const dismissJourneycard = C.useChatContext(s => s.dispatch.dismissJourneycard)
  const _onDismiss = (cardType: T.RPCChat.JourneycardType, ordinal: T.Chat.Ordinal) =>
    dismissJourneycard(cardType, ordinal)
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
  const _onShowTeam = (teamID: T.Teams.TeamID) => navigateAppend({props: {teamID}, selected: 'team'})
  const props = {
    canShowcase,
    cannotWrite,
    channelname,
    isBigTeam,
    message,
    onAddPeopleToTeam: () => _onAddPeopleToTeam(_teamID),
    onAuthorClick: () => _onAuthorClick(_teamID),
    onBrowseChannels: () => _onManageChannels(_teamID),
    onCreateChatChannels: () => _onCreateChannel(_teamID),
    onDismiss: () => _onDismiss(message.cardType, message.ordinal),
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
