import * as C from '@/constants'
import {isBigTeam as getIsBigTeam} from '@/constants/chat/helpers'
import * as Teams from '@/constants/teams'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {renderWelcomeMessage} from './util'
import {useAllChannelMetas} from '@/teams/common/channel-hooks'
import {setMemberPublicity} from '@/teams/actions'
import {useTeamsListMap} from '@/teams/use-teams-list'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {
  useConversationThreadDismissJourneycard,
  useConversationThreadID,
  useConversationThreadMessage,
  useConversationThreadSelector,
} from '../../../thread-context'

type Action = {label: string; onClick: () => void} | 'wave'
type OwnProps = {ordinal: T.Chat.Ordinal}

const emptyJourney = Chat.makeMessageJourneycard({})

const TeamJourneyConnected = (ownProps: OwnProps) => {
  const {ordinal} = ownProps
  const m = useConversationThreadMessage(ordinal)
  const message = m?.type === 'journeycard' ? m : emptyJourney
  const conv = useConversationThreadSelector(s => s.meta)
  const {cannotWrite, channelname, teamname, teamID} = conv
  const welcomeMessage = {display: '', raw: '', set: false}
  const teamMetaByID = useTeamsListMap()
  const teamMeta = teamMetaByID.get(teamID) ?? Teams.makeTeamMeta({id: teamID})
  const canShowcase = teamMeta.allowPromote || teamMeta.role === 'admin' || teamMeta.role === 'owner'
  const isBigTeam = useInboxLayoutState(s => getIsBigTeam(s.layout, teamID))
  const navigateAppend = C.Router2.navigateAppend
  const dismissJourneycard = useConversationThreadDismissJourneycard()
  const onAuthorClick = () => navigateAppend({name: 'team', params: {teamID}})
  const onBrowseChannels = () => navigateAppend({name: 'teamAddToChannels', params: {teamID}})
  const onDismiss = () => dismissJourneycard(message.cardType, message.ordinal)
  const onGoToChannel = (channelName: string) =>
    C.Router2.previewConversation({channelname: channelName, reason: 'journeyCardPopular', teamname})
  const onPublishTeam = () => {
    navigateAppend({name: 'profileShowcaseTeamOffer', params: {}})
    setMemberPublicity(teamID, true)
  }

  const conversationIDKey = useConversationThreadID()
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
          .slice(0, isMobile ? 2 : 3)
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
          {!!image && <Kb.ImageIcon style={styles.image} type={image} />}
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
                  tlfName={conv.tlfname}
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
      {!isMobile && !deactivateButtons && (
        <Kb.Icon type="iconfont-close" color={Kb.Styles.globalColors.black_20} onClick={onDismiss} fontSize={12} />
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
      contentWithImage: {minHeight: 70},
      image: Kb.Styles.platformStyles({
        isElectron: {marginTop: -33},
      }),
      teamnameText: {color: Kb.Styles.globalColors.black},
      text: {maxWidth: isMobile ? '70%' : 320},
    }) as const
)

export default TeamJourneyConnected
