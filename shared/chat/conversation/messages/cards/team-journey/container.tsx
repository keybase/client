import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as T from '@/constants/types'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import {renderWelcomeMessage} from './util'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'

type Action = {label: string; onClick: () => void} | 'wave'
type OwnProps = {ordinal: T.Chat.Ordinal}

const emptyJourney = Chat.makeMessageJourneycard({})

const TeamJourneyConnected = (ownProps: OwnProps) => {
  const {ordinal} = ownProps
  const m = Chat.useChatContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'journeycard' ? m : emptyJourney
  const conv = Chat.useChatContext(s => s.meta)
  const {cannotWrite, channelname, teamname, teamID} = conv
  const welcomeMessage = {display: '', raw: '', set: false}
  const canShowcase = Teams.useTeamsState(s => Teams.canShowcase(s, teamID))
  const isBigTeam = Chat.useChatState(s => Chat.isBigTeam(s, teamID))
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onAuthorClick = (teamID: T.Teams.TeamID) => navigateAppend({props: {teamID}, selected: 'team'})
  const dismissJourneycard = Chat.useChatContext(s => s.dispatch.dismissJourneycard)
  const _onDismiss = (cardType: T.RPCChat.JourneycardType, ordinal: T.Chat.Ordinal) =>
    dismissJourneycard(cardType, ordinal)
  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const _onGoToChannel = (channelname: string, teamname: string) =>
    previewConversation({channelname, reason: 'journeyCardPopular', teamname})
  const manageChatChannels = Teams.useTeamsState(s => s.dispatch.manageChatChannels)
  const _onManageChannels = (teamID: string) => manageChatChannels(teamID)

  const setMemberPublicity = Teams.useTeamsState(s => s.dispatch.setMemberPublicity)
  const _onPublishTeam = (teamID: string) => {
    navigateAppend('profileShowcaseTeamOffer')
    setMemberPublicity(teamID, true)
  }
  const onAuthorClick = () => _onAuthorClick(teamID)
  const onBrowseChannels = () => _onManageChannels(teamID)
  const onDismiss = () => _onDismiss(message.cardType, message.ordinal)
  const onGoToChannel = (channelName: string) => _onGoToChannel(channelName, teamname)
  const onPublishTeam = () => _onPublishTeam(teamID)

  const conversationIDKey = Chat.useChatContext(s => s.id)
  const {cardType} = message
  let textComponent: React.ReactNode
  let image: Kb.IconType | undefined
  let actions: Array<Action> = []

  const dontCallRPC =
    cardType !== T.RPCChat.JourneycardType.popularChannels &&
    cardType !== T.RPCChat.JourneycardType.msgNoAnswer
  const {channelMetas} = useAllChannelMetas(teamID, dontCallRPC)
  // Take the top three channels with most recent activity.
  const joinableStatuses = new Set<T.Chat.ConversationMeta['membershipType']>([
    // keep in sync with journey_card_manager.go
    'notMember' as const,
    'youAreReset' as const,
  ])
  const otherChannelsBase = [...channelMetas.values()]
    .filter(info => info.channelname !== channelname)
    .sort((x, y) => y.timestamp - x.timestamp)

  switch (cardType) {
    case T.RPCChat.JourneycardType.welcome:
      image = 'icon-illustration-welcome-96'
      if (!cannotWrite) {
        actions.push('wave')
      }
      if (isBigTeam) {
        actions.push({label: 'Browse channels', onClick: onBrowseChannels})
      }
      if (canShowcase) {
        actions.push({label: 'Publish team on your profile', onClick: onPublishTeam})
      }
      textComponent = renderWelcomeMessage(welcomeMessage, cannotWrite)
      break
    case T.RPCChat.JourneycardType.popularChannels:
      {
        const otherChannelsForPopular = otherChannelsBase
          .filter(({membershipType}) => joinableStatuses.has(membershipType))
          .slice(0, C.isMobile ? 2 : 3)
          .map(info => info.channelname)
        actions = otherChannelsForPopular.map(chan => ({
          label: `#${chan}`,
          onClick: () => onGoToChannel(chan),
        }))
        textComponent = (
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodySmall">
              You are in <Kb.Text type="BodySmallBold">#{channelname}</Kb.Text>.
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
    case T.RPCChat.JourneycardType.addPeople: // fallthrough
    case T.RPCChat.JourneycardType.createChannels: // fallthrough
    case T.RPCChat.JourneycardType.msgAttention: // fallthrough
    case T.RPCChat.JourneycardType.channelInactive: // fallthrough
    case T.RPCChat.JourneycardType.msgNoAnswer: // fallthrough
      return null
    default:
      console.warn(`Unexpected journey card type: ${cardType}`)
      return null
  }

  if (!teamname) return null

  const deactivateButtons = false

  const contentHorizontalPadStyle = styles.contentHorizontalPadChat as Kb.Styles.StylesCrossPlatform

  return (
    <>
      <TeamJourneyHeader
        teamname={teamname}
        onAuthorClick={onAuthorClick}
        onDismiss={onDismiss}
        deactivateButtons={deactivateButtons}
      />
      <Kb.Box2
        key="content"
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([styles.content, image ? styles.contentWithImage : null])}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} style={contentHorizontalPadStyle}>
          <Kb.Box2 direction="horizontal" style={image ? styles.text : undefined} alignSelf="flex-start">
            {textComponent}
          </Kb.Box2>
          {!!image && <Kb.Icon style={styles.image} type={image} />}
        </Kb.Box2>
        <Kb.ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            alignItems={'flex-start'}
            gap="tiny"
            style={Kb.Styles.collapseStyles([styles.actionsBox, contentHorizontalPadStyle] as const)}
          >
            {actions.map(action =>
              action === 'wave' ? (
                <Kb.WaveButton
                  key="wave"
                  conversationIDKey={conversationIDKey}
                  small={true}
                  style={styles.buttonSpace}
                  disabled={!!deactivateButtons}
                />
              ) : (
                <Kb.Button
                  key={action.label}
                  small={true}
                  type="Default"
                  mode="Secondary"
                  label={action.label}
                  onClick={action.onClick}
                  disabled={!!deactivateButtons}
                  style={styles.buttonSpace}
                />
              )
            )}
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    </>
  )
}

type HeaderProps = {
  teamname: string
  onAuthorClick: () => void
  onDismiss: () => void
  deactivateButtons?: boolean
}
const TeamJourneyHeader = (props: HeaderProps) => {
  const {teamname, onAuthorClick, deactivateButtons, onDismiss} = props
  const avatarStyle = styles.avatarChat
  return (
    <Kb.Box2 key="author" direction="horizontal" fullWidth={true} style={styles.authorContainer} gap="tiny">
      <Kb.Avatar
        size={32}
        isTeam={true}
        teamname={teamname}
        skipBackground={true}
        style={avatarStyle}
        onClick={deactivateButtons ? undefined : onAuthorClick}
      />
      <Kb.Box2
        direction="horizontal"
        gap="xtiny"
        fullWidth={false}
        alignSelf="flex-start"
        style={styles.bottomLine}
      >
        <Kb.Text
          style={styles.teamnameText}
          type="BodySmallBold"
          onClick={deactivateButtons ? undefined : onAuthorClick}
          className={deactivateButtons ? '' : 'hover-underline'}
        >
          {teamname}
        </Kb.Text>
        <Kb.Text type="BodyTiny">• System message</Kb.Text>
      </Kb.Box2>
      {!Kb.Styles.isMobile && !deactivateButtons && (
        <Kb.Icon type="iconfont-close" onClick={onDismiss} fontSize={12} />
      )}
    </Kb.Box2>
  )
}

const buttonSpace = 6

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      actionsBox: Kb.Styles.platformStyles({
        common: {marginTop: Kb.Styles.globalMargins.tiny - buttonSpace},
        isElectron: {flexWrap: 'wrap'},
      }),
      authorContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          height: Kb.Styles.globalMargins.mediumLarge,
        },
        isMobile: {marginTop: 8},
      }),
      avatarChat: Kb.Styles.platformStyles({
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.small,
          marginTop: Kb.Styles.globalMargins.xtiny,
        },
        isMobile: {marginLeft: Kb.Styles.globalMargins.tiny},
      }),
      avatarTeamSettings: Kb.Styles.platformStyles({
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.tiny,
          marginTop: 0,
        },
        isMobile: {marginLeft: Kb.Styles.globalMargins.xtiny},
      }),
      bottomLine: {
        ...Kb.Styles.globalStyles.flexGrow,
        alignItems: 'baseline',
      },
      buttonSpace: {marginTop: buttonSpace},
      content: Kb.Styles.platformStyles({
        isElectron: {},
        isMobile: {paddingBottom: 3},
      }),
      contentHorizontalPadChat: Kb.Styles.platformStyles({
        isElectron: {
          paddingLeft:
            // Space for below the avatar
            Kb.Styles.globalMargins.tiny + // right margin
            Kb.Styles.globalMargins.small + // left margin
            Kb.Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingLeft:
            // Space for below the avatar
            Kb.Styles.globalMargins.tiny + // right margin
            Kb.Styles.globalMargins.tiny + // left margin
            Kb.Styles.globalMargins.mediumLarge, // avatar
        },
      }),
      contentHorizontalPadTeamSettings: Kb.Styles.platformStyles({
        isElectron: {
          paddingLeft:
            // Space for below the avatar
            Kb.Styles.globalMargins.tiny + // right margin
            Kb.Styles.globalMargins.tiny + // left margin
            Kb.Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
        isMobile: {
          paddingLeft:
            // Space for below the avatar
            Kb.Styles.globalMargins.tiny + // right margin
            Kb.Styles.globalMargins.tiny + // left margin
            Kb.Styles.globalMargins.mediumLarge, // avatar
        },
      }),
      contentWithImage: {minHeight: 70},
      image: Kb.Styles.platformStyles({
        isElectron: {marginTop: -33},
      }),
      imageSettingsTab: Kb.Styles.platformStyles({
        common: {
          position: 'absolute',
          top: 0,
        },
        isElectron: {
          left: '50%',
          marginLeft: 15,
        },
        isMobile: {right: 25},
      }),
      teamnameText: {color: Kb.Styles.globalColors.black},
      text: {maxWidth: Kb.Styles.isMobile ? '70%' : 320},
    }) as const
)

export default TeamJourneyConnected
