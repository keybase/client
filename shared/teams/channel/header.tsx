import * as T from '@/constants/types'
import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as React from 'react'
import * as Teams from '@/stores/teams'
import {useTeamsState} from '@/stores/teams'
import * as Kb from '@/common-adapters'
import {pluralize} from '@/util/string'
import {Activity, useChannelParticipants} from '../common'
import {useSafeNavigation} from '@/util/safe-navigation'

const useRecentJoins = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const [recentJoins, setRecentJoins] = React.useState<number | undefined>(undefined)
  const getRecentJoinsRPC = C.useRPC(T.RPCChat.localGetRecentJoinsLocalRpcPromise)
  React.useEffect(() => {
    setRecentJoins(undefined)
    getRecentJoinsRPC(
      [{convID: T.Chat.keyToConversationID(conversationIDKey)}],
      r => setRecentJoins(r),
      () => {}
    )
  }, [conversationIDKey, getRecentJoinsRPC, setRecentJoins])
  return recentJoins
}

type HeaderTitleProps = {
  teamID: T.Teams.TeamID
  conversationIDKey: T.Chat.ConversationIDKey
}

const HeaderTitle = (props: HeaderTitleProps) => {
  const {teamID, conversationIDKey} = props
  const teamname = useTeamsState(s => Teams.getTeamMeta(s, teamID).teamname)
  const channelInfo = useTeamsState(s => Teams.getTeamChannelInfo(s, teamID, conversationIDKey))
  const {channelname, description} = channelInfo
  const numParticipants = useChannelParticipants(teamID, conversationIDKey).length
  const yourOperations = useTeamsState(s => Teams.getCanPerformByID(s, teamID))
  const canDelete = yourOperations.deleteChannel && channelname !== 'general'

  const editChannelProps = {
    channelname: channelname,
    conversationIDKey,
    description: description,
    teamID,
  }
  const nav = useSafeNavigation()
  const onEditChannel = () => nav.safeNavigateAppend({props: editChannelProps, selected: 'teamEditChannel'})
  const onAddMembers = () =>
    nav.safeNavigateAppend({props: {conversationIDKey, teamID}, selected: 'chatAddToChannel'})
  const onNavToTeam = () => nav.safeNavigateAppend({props: {teamID}, selected: 'team'})
  const activityLevel = useTeamsState(s => s.activityLevels.channels.get(conversationIDKey) || 'none')
  const newMemberCount = useRecentJoins(conversationIDKey)

  const previewConversation = Chat.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => previewConversation({conversationIDKey, reason: 'channelHeader'})

  const topDescriptors = (
    <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xxtiny" style={styles.flexShrink}>
      <Kb.Box2 direction="horizontal" gap="xtiny" alignSelf="flex-start" style={styles.flexShrink}>
        <Kb.Avatar editable={false} teamname={teamname} size={16} style={styles.alignSelfFlexStart} />
        <Kb.Text className="hover-underline" type="BodySmallSemibold" onClick={onNavToTeam}>
          {teamname}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Text type="Header" lineClamp={1} style={styles.header}>
        {'#' + channelname}
      </Kb.Text>
    </Kb.Box2>
  )

  const deleteChannelConfirmed = useTeamsState(s => s.dispatch.deleteChannelConfirmed)

  const menuItems: Array<Kb.MenuItem> = React.useMemo(
    () => [
      // Not including settings here because there's already a settings tab below and plumbing the tab selection logic to here would be a real pain.
      // It's included in the other place this menu appears.
      ...(canDelete
        ? [
            {
              danger: true,
              onClick: () => {
                nav.safeNavigateUp()
                deleteChannelConfirmed(teamID, conversationIDKey)
              },
              title: 'Delete channel',
            },
          ]
        : []),
    ],
    [deleteChannelConfirmed, nav, teamID, conversationIDKey, canDelete]
  )

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          closeOnSelect={true}
          items={menuItems}
          onHidden={hidePopup}
          visible={true}
        />
      )
    },
    [menuItems]
  )

  const {showPopup, popupAnchor, popup} = Kb.usePopup2(makePopup)

  const bottomDescriptorsAndButtons = (
    <>
      <Kb.Box2 direction="vertical" alignSelf="flex-start" gap="xxtiny" gapStart={!Kb.Styles.isMobile}>
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
          {yourOperations.chat && <Kb.Button label="View" onClick={onChat} small={true} />}
          {yourOperations.editChannelDescription && (
            <Kb.Button label="Edit" onClick={onEditChannel} small={true} mode="Secondary" />
          )}
          {!Kb.Styles.isMobile && (
            <Kb.Button
              label="Add members"
              onClick={onAddMembers}
              small={true}
              mode="Secondary"
              style={styles.addMembersButton}
            />
          )}
          {!!menuItems.length && (
            <Kb.Button
              mode="Secondary"
              small={true}
              icon="iconfont-ellipsis"
              iconColor={Kb.Styles.globalColors.blue}
              ref={popupAnchor}
              onClick={showPopup}
            />
          )}
        </Kb.Box2>
      </Kb.Box2>
      {popup}
    </>
  )

  const tip = (
    <Kb.Box2 direction="horizontal" alignSelf="flex-start" gap="tiny" style={styles.tipBox}>
      <Kb.Icon color={Kb.Styles.globalColors.black_20} type="iconfont-info" sizeType="Small" />
      <Kb.Text type="BodySmall">Tip: Use @mentions to invite team members to channels from the chat.</Kb.Text>
    </Kb.Box2>
  )

  if (Kb.Styles.isMobile) {
    return (
      <Kb.Box2 alignItems="flex-start" direction="vertical" fullWidth={true} style={styles.backButton}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny" style={styles.outerBoxMobile}>
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
          <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.tipBox}>
            {tip}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}
export default HeaderTitle

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      addMembersButton: {
        flexGrow: 0,
      },
      alignSelfFlexStart: {
        alignSelf: 'flex-start',
      },
      backButton: {
        backgroundColor: Kb.Styles.globalColors.white,
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
        marginBottom: Kb.Styles.globalMargins.small,
      },
      outerBoxMobile: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
        backgroundColor: Kb.Styles.globalColors.white,
      },
      rightActionsContainer: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isElectron: Kb.Styles.desktopStyles.windowDraggingClickable,
      }),
      tipBox: Kb.Styles.platformStyles({
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.xlarge + Kb.Styles.globalMargins.large,
          marginRight: Kb.Styles.globalMargins.large,
          maxWidth: 460,
          paddingTop: Kb.Styles.globalMargins.xxtiny,
        },
        isMobile: {
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)
