import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as Chat2Gen from '../../actions/chat2-gen'
import {ConversationIDKey} from '../../constants/types/chat2'
import {TeamID} from '../../constants/types/teams'
import {pluralize} from '../../util/string'
import {Activity} from '../common'

type HeaderTitleProps = Kb.PropsWithOverlay<{
  teamID: TeamID
  conversationIDKey: ConversationIDKey
}>

const _HeaderTitle = (props: HeaderTitleProps) => {
  const {teamID, conversationIDKey} = props
  const {teamname} = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const {channelname, description, numParticipants} = Container.useSelector(
    s =>
      Constants.getChannelInfoFromConvID(s, teamID, conversationIDKey) ?? {
        channelname: '',
        description: '',
        numParticipants: 0,
      }
  )
  const yourOperations = Container.useSelector(s => Constants.getCanPerformByID(s, teamID))
  const activityLevel = 'active' // TODO plumbing
  const newMemberCount = 1 // TODO plumbing

  const callbacks = useHeaderCallbacks(teamID, conversationIDKey)

  const topDescriptors = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny" style={styles.flexShrink}>
      <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" style={styles.flexShrink}>
        <Kb.Avatar editable={false} teamname={teamname} size={16} style={styles.alignSelfFlexStart} />
        <Kb.Text type="BodySmallSemibold">{teamname}</Kb.Text>
      </Kb.Box2>
      <Kb.Text type="Header" lineClamp={1} style={styles.header}>
        {'#' + channelname}
      </Kb.Text>
    </Kb.Box2>
  )

  const bottomDescriptorsAndButtons = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="tiny">
      {!!description && (
        <Kb.Text type="Body" lineClamp={3}>
          {description}
        </Kb.Text>
      )}
      {numParticipants !== -1 && (
        <Kb.Text type="BodySmall">
          {numParticipants.toLocaleString()} {pluralize('member', numParticipants)}
          {!!newMemberCount && ' · ' + newMemberCount.toLocaleString() + ' new this week'}
        </Kb.Text>
      )}
      <Kb.Box2 direction="horizontal" alignSelf="flex-start">
        <Activity level={activityLevel} />
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.rightActionsContainer}>
        {yourOperations.chat && (
          <Kb.Button label="View" onClick={callbacks.onChat} small={true} style={styles.button} />
        )}
        {yourOperations.editChannelDescription && (
          <Kb.Button
            label="Edit"
            onClick={undefined /* TODO */}
            small={true}
            mode="Secondary"
            style={styles.button}
          />
        )}
        <Kb.Button
          label="Add members"
          onClick={undefined /* TODO */}
          ref={props.setAttachmentRef}
          small={true}
          mode="Secondary"
          style={styles.addMembersButton}
        />
        <Kb.Button
          mode="Secondary"
          small={true}
          ref={props.setAttachmentRef}
          onClick={props.toggleShowingMenu}
        >
          <Kb.Icon type="iconfont-ellipsis" color={Styles.globalColors.blue} />
        </Kb.Button>
        {/* TODO: Channel Menu */}
      </Kb.Box2>
    </Kb.Box2>
  )

  if (Styles.isMobile) {
    return (
      <Kb.Box2 alignItems="flex-start" direction="vertical" fullWidth={true} style={styles.backButton}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.outerBoxMobile}>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny">
            {topDescriptors}
          </Kb.Box2>
          {bottomDescriptorsAndButtons}
          {yourOperations.manageMembers && <Kb.Box2 direction="horizontal" fullWidth={true}></Kb.Box2>}
        </Kb.Box2>
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2
      alignItems="center"
      direction="horizontal"
      gap="small"
      gapStart={true}
      fullWidth={true}
      className="headerTitle"
    >
      <Kb.Box2
        direction="vertical"
        alignItems="flex-start"
        alignSelf="flex-start"
        style={styles.outerBoxDesktop}
      >
        {topDescriptors}
        {bottomDescriptorsAndButtons}
      </Kb.Box2>
    </Kb.Box2>
  )
}
export default Kb.OverlayParentHOC(_HeaderTitle)

const nyi = () => console.warn('not yet implemented')
const useHeaderCallbacks = (_: TeamID, conversationIDKey: ConversationIDKey) => {
  const dispatch = Container.useDispatch()

  const onChat = () =>
    dispatch(Chat2Gen.createPreviewConversation({conversationIDKey, reason: 'channelHeader'}))
  const onEdit = nyi
  const onAddMembers = nyi

  return {onAddMembers, onChat, onEdit}
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      addMembersButton: {
        flexGrow: 0,
      },
      addSelfLink: {
        marginLeft: Styles.globalMargins.xtiny,
        textDecorationLine: 'underline',
      },
      alignSelfFlexStart: {
        alignSelf: 'flex-start',
      },
      backButton: {
        backgroundColor: Styles.globalColors.white,
      },
      banner: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall, 0),
      },
      clickable: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.windowDraggingClickable,
        },
      }),
      flexShrink: {
        flexShrink: 1,
      },
      greenText: {
        color: Styles.globalColors.greenDark,
      },
      header: {
        flexShrink: 1,
      },
      marginBottomRightTiny: {
        marginBottom: Styles.globalMargins.tiny,
        marginRight: Styles.globalMargins.tiny,
      },
      openMeta: Styles.platformStyles({
        isElectron: {
          alignSelf: 'center',
          marginLeft: Styles.globalMargins.xtiny,
        },
        isMobile: {alignSelf: 'flex-start'},
      }),
      outerBoxDesktop: {
        flexGrow: 1,
        flexShrink: 1,
        marginBottom: Styles.globalMargins.small,
      },
      outerBoxMobile: {
        ...Styles.padding(Styles.globalMargins.small),
        backgroundColor: Styles.globalColors.white,
      },
      rightActionsContainer: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          paddingTop: Styles.globalMargins.tiny,
        },
        isElectron: Styles.desktopStyles.windowDraggingClickable,
      }),
    } as const)
)
