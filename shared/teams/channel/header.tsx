import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as Constants from '../../constants/teams'
import * as ChatConstants from '../../constants/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import {ConversationIDKey} from '../../constants/types/chat2'
import {TeamID} from '../../constants/types/teams'
import {pluralize} from '../../util/string'
import {Activity} from '../common'
import * as TeamsGen from '../../actions/teams-gen'
import {useChannelMeta} from '../common/channel-hooks'

type HeaderTitleProps = {
  teamID: TeamID
  conversationIDKey: ConversationIDKey
}

const HeaderTitle = (props: HeaderTitleProps) => {
  const {teamID, conversationIDKey} = props
  const {teamname} = Container.useSelector(s => Constants.getTeamMeta(s, teamID))
  const channelMeta = useChannelMeta(teamID, conversationIDKey)
  const channelname = channelMeta?.channelname ?? ''
  const description = channelMeta?.description ?? ''
  const numParticipants = Container.useSelector(
    s => ChatConstants.getParticipantInfo(s, conversationIDKey).all.length
  )
  const yourOperations = Container.useSelector(s => Constants.getCanPerformByID(s, teamID))
  const canDelete = yourOperations.deleteChannel

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onEditChannel = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [{props: {conversationIDKey, teamID}, selected: 'chatEditChannel'}],
      })
    )
  const onAddMembers = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        // TODO: this route does not exist yet
        path: [{props: {conversationIDKey, teamID}, selected: 'teamAddToChannel'}],
      })
    )
  const onNavToTeam = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [{props: {teamID}, selected: 'team'}],
      })
    )
  const activityLevel = 'active' // TODO plumbing
  const newMemberCount = 1 // TODO plumbing

  const callbacks = useHeaderCallbacks(teamID, conversationIDKey)

  const topDescriptors = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xtiny" style={styles.flexShrink}>
      <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" style={styles.flexShrink}>
        <Kb.Avatar editable={false} teamname={teamname} size={16} style={styles.alignSelfFlexStart} />
        <Kb.Text type="BodySmallSemibold" onClick={onNavToTeam}>
          {teamname}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Text type="Header" lineClamp={1} style={styles.header}>
        {'#' + channelname}
      </Kb.Text>
    </Kb.Box2>
  )

  const onDeleteChannel = () => {
    dispatch(nav.safeNavigateUpPayload())
    dispatch(TeamsGen.createDeleteChannelConfirmed({conversationIDKey, teamID}))
  }

  const menuItems: Array<Kb.MenuItem> = [
    {onClick: () => {}, title: 'Audience stats'},
    // Not including settings here because there's already a settings tab below and plumbing the tab selection logic to here would be a real pain.
    // It's included in the other place this menu appears.
    ...(canDelete ? [{danger: true, onClick: onDeleteChannel, title: 'Delete channel'}] : []),
  ]
  const {showingPopup, toggleShowingPopup, popupAnchor, popup} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={menuItems}
      onHidden={toggleShowingPopup}
      visible={showingPopup}
    />
  ))

  const bottomDescriptorsAndButtons = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="tiny" gapStart={!Styles.isMobile}>
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
        {yourOperations.chat && <Kb.Button label="View" onClick={callbacks.onChat} small={true} />}
        {yourOperations.editChannelDescription && (
          <Kb.Button label="Edit" onClick={onEditChannel} small={true} mode="Secondary" />
        )}
        {!Styles.isMobile && (
          <Kb.Button
            label="Add members"
            onClick={onAddMembers}
            small={true}
            mode="Secondary"
            style={styles.addMembersButton}
          />
        )}
        <Kb.Button
          mode="Secondary"
          small={true}
          icon="iconfont-ellipsis"
          iconColor={Styles.globalColors.blue}
          ref={popupAnchor}
          onClick={toggleShowingPopup}
        />
        {/*TODO: why does the popup take up space and move the info icon over to the right?*/}
        {popup}
      </Kb.Box2>
    </Kb.Box2>
  )

  const tip = (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start" gap="tiny">
      <Kb.Icon color={Styles.globalColors.black_20} fontSize={12} type="iconfont-info" />
      <Kb.Text type="BodySmall" lineClamp={3}>
        Tip: Use @mentions to invite team members to channels from the chat.
      </Kb.Text>
    </Kb.Box2>
  )

  if (Styles.isMobile) {
    return (
      <Kb.Box2 alignItems="flex-start" direction="vertical" fullWidth={true} style={styles.backButton}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.outerBoxMobile}>
          {topDescriptors}
          {bottomDescriptorsAndButtons}
          {tip}
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
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          {bottomDescriptorsAndButtons}
          <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.tipBoxDesktop}>
            {tip}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}
export default HeaderTitle

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
      alignSelfFlexStart: {
        alignSelf: 'flex-start',
      },
      backButton: {
        backgroundColor: Styles.globalColors.white,
      },
      flexShrink: {
        flexShrink: 1,
      },
      header: {
        flexShrink: 1,
      },
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
      tipBoxDesktop: {
        marginLeft: Styles.globalMargins.xlarge + Styles.globalMargins.large,
        width: 200,
      },
    } as const)
)
