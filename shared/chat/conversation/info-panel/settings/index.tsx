import * as React from 'react'
import * as TeamConstants from '../../../../constants/teams'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Container from '../../../../util/container'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import flags from '../../../../util/feature-flags'
import RetentionPicker from '../../../../teams/team/settings-tab/retention/container'
import MinWriterRole from './min-writer-role'
import Notifications from './notifications'
import {CaptionedDangerIcon} from './channel-utils'

type EntityType = 'adhoc' | 'small team' | 'channel'
type SettingsPanelProps = {conversationIDKey: Types.ConversationIDKey; isPreview: boolean}

const SettingsPanel = (props: SettingsPanelProps) => {
  const {conversationIDKey, isPreview} = props
  const dispatch = Container.useDispatch()
  const username = Container.useSelector(state => state.config.username)
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {status, teamname, teamType, channelname, teamID} = meta
  const yourOperations = Container.useSelector(state =>
    teamname ? TeamConstants.getCanPerformByID(state, teamID) : undefined
  )
  const ignored = status === RPCChatTypes.ConversationStatus.ignored
  const smallTeam = teamType !== 'big'

  const spinnerForHide = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.waitingKeyConvStatusChange(conversationIDKey))
  )
  const spinnerForLeave = Container.useSelector(state =>
    Container.anyWaiting(state, Constants.waitingKeyLeaveConversation)
  )

  const canDeleteHistory =
    teamname && yourOperations ? yourOperations.deleteChatHistory && !meta.cannotWrite : true

  let entityType: EntityType
  if (teamname && channelname) {
    entityType = smallTeam ? 'small team' : 'channel'
  } else {
    entityType = 'adhoc'
  }

  const teamMembers = Container.useSelector(state => state.teams.teamIDToMembers.get(teamID))
  const participantInfo = Container.useSelector(state =>
    Constants.getParticipantInfo(state, conversationIDKey)
  )
  const membersForBlock = (teamMembers?.size ? [...teamMembers.keys()] : participantInfo.name).filter(
    u => u !== username && !Constants.isAssertion(u)
  )

  const onShowClearConversationDialog = () => {
    dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'misc'}))
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [{props: {conversationIDKey}, selected: 'chatDeleteHistoryWarning'}],
      })
    )
  }

  const onHideConv = () => dispatch(Chat2Gen.createHideConversation({conversationIDKey}))
  const onUnhideConv = () => dispatch(Chat2Gen.createUnhideConversation({conversationIDKey}))
  const onShowBlockConversationDialog = membersForBlock.length
    ? () => {
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              {
                props: {
                  blockUserByDefault: true,
                  convID: conversationIDKey,
                  others: membersForBlock,
                  team: teamname,
                },
                selected: 'chatBlockingModal',
              },
            ],
          })
        )
      }
    : onHideConv

  const onLeaveConversation = () => dispatch(Chat2Gen.createLeaveConversation({conversationIDKey}))

  if (flags.teamsRedesign) {
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        fullHeight={true}
        alignItems="flex-start"
        style={styles.settingsContainer}
      >
        <Kb.ScrollView>
          {isPreview ? (
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.settingsHeader}>
              <Kb.Text type="BodySmallSemibold">You are not in this channel.</Kb.Text>
              <Kb.Button type="Success" mode="Primary" label="Join channel" style={styles.buttonStyle} />
            </Kb.Box2>
          ) : (
            <Notifications conversationIDKey={conversationIDKey} />
          )}

          {entityType === 'channel' && channelname !== 'general' && !isPreview && (
            <Kb.Button
              type="Default"
              mode="Secondary"
              label="Leave channel"
              onClick={onLeaveConversation}
              style={styles.smallButton}
              waiting={spinnerForLeave}
              icon="iconfont-leave"
              iconColor={Styles.globalColors.blue}
            />
          )}

          <Kb.Text type="Header" style={styles.settingsHeader}>
            Conversation
          </Kb.Text>

          <RetentionPicker
            containerStyle={styles.retentionContainerStyle}
            conversationIDKey={['adhoc', 'channel'].includes(entityType) ? conversationIDKey : undefined}
            dropdownStyle={styles.retentionDropdownStyle}
            entityType={entityType}
            showSaveIndicator={true}
            teamID={teamID}
          />
          {(entityType === 'channel' || entityType === 'small team') && (
            <MinWriterRole conversationIDKey={conversationIDKey} />
          )}

          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.section} gap="small">
            <Kb.Text type="BodySmallSemibold">Danger zone</Kb.Text>

            {canDeleteHistory && (
              <Kb.Button
                type="Danger"
                mode="Secondary"
                label="Clear entire conversation"
                onClick={onShowClearConversationDialog}
              />
            )}
            {entityType === 'adhoc' && (
              <Kb.Button
                type="Danger"
                mode="Primary"
                label="Block"
                onClick={onShowBlockConversationDialog}
                icon="iconfont-remove"
                iconColor={Styles.globalColors.red}
              />
            )}
            {entityType !== 'channel' &&
              (ignored ? (
                <Kb.Button
                  type="Danger"
                  mode="Secondary"
                  label="Unhide this conversation"
                  onClick={onUnhideConv}
                  icon="iconfont-unhide"
                  iconColor={Styles.globalColors.red}
                />
              ) : (
                <Kb.Button
                  type="Danger"
                  mode="Secondary"
                  label="Hide this conversation"
                  onClick={onHideConv}
                  icon="iconfont-unhide"
                  iconColor={Styles.globalColors.red}
                />
              ))}
          </Kb.Box2>
        </Kb.ScrollView>
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.settingsContainer}>
      <Kb.ScrollView>
        <Notifications conversationIDKey={conversationIDKey} />
        <Kb.Divider style={styles.divider} />
        <RetentionPicker
          containerStyle={styles.retentionContainerStyle}
          conversationIDKey={['adhoc', 'channel'].includes(entityType) ? conversationIDKey : undefined}
          dropdownStyle={styles.retentionDropdownStyle}
          entityType={entityType}
          showSaveIndicator={true}
          teamID={teamID}
        />
        {(entityType === 'channel' || entityType === 'small team') && (
          <>
            <Kb.Divider style={styles.divider} />
            <MinWriterRole conversationIDKey={conversationIDKey} />
          </>
        )}
        <Kb.Divider style={styles.divider} />
        {canDeleteHistory && (
          <CaptionedDangerIcon
            caption="Clear entire conversation"
            onClick={onShowClearConversationDialog}
            icon="iconfont-fire"
          />
        )}
        {entityType === 'adhoc' && (
          <CaptionedDangerIcon
            caption="Block"
            onClick={onShowBlockConversationDialog}
            icon="iconfont-remove"
          />
        )}
        {entityType !== 'channel' &&
          (ignored ? (
            <CaptionedDangerIcon
              caption="Unhide this conversation"
              icon="iconfont-unhide"
              onClick={onUnhideConv}
              noDanger={true}
              spinner={spinnerForHide}
            />
          ) : (
            <CaptionedDangerIcon
              caption="Hide this conversation"
              onClick={onHideConv}
              noDanger={true}
              icon="iconfont-hide"
              spinner={spinnerForHide}
            />
          ))}
        {entityType === 'channel' && channelname !== 'general' && (
          <CaptionedDangerIcon
            onClick={onLeaveConversation}
            caption="Leave channel"
            icon="iconfont-leave"
            spinner={spinnerForLeave}
          />
        )}
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      buttonStyle: {
        alignSelf: 'flex-start',
        marginBottom: Styles.globalMargins.small,
        marginTop: Styles.globalMargins.small,
      },
      divider: {
        marginBottom: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
      membersContainer: {
        flex: 1,
        paddingTop: Styles.globalMargins.tiny,
      },
      retentionContainerStyle: Styles.platformStyles({
        common: {
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 8,
        },
        isMobile: {marginRight: 16},
      }),
      retentionDropdownStyle: Styles.platformStyles({
        isElectron: {
          marginRight: 45 - 16,
          width: 'auto',
        },
        isMobile: {width: '100%'},
      }),
      section: {
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      settingsContainer: Styles.platformStyles({
        common: {
          flex: 1,
          height: '100%',
          paddingBottom: Styles.globalMargins.small,
          paddingTop: Styles.globalMargins.small,
        },
        isTablet: {alignSelf: 'center', maxWidth: 600},
      }),
      settingsHeader: {
        display: 'flex',
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
      },
      smallButton: {
        marginBottom: Styles.globalMargins.medium,
        marginLeft: Styles.globalMargins.small,
        marginRight: Styles.globalMargins.small,
      },
    } as const)
)

type Props = {
  conversationIDKey: Types.ConversationIDKey
  isPreview: boolean
  renderTabs: () => React.ReactNode
  commonSections: Array<unknown>
}

const SettingsTab = (p: Props) => {
  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({section}: any) => section?.renderSectionHeader?.({section}) ?? null}
      sections={[
        ...p.commonSections,
        {
          data: [{key: 'tab'}],
          key: 'settings-panel',
          renderItem: () => (
            <SettingsPanel conversationIDKey={p.conversationIDKey} isPreview={p.isPreview} key="settings" />
          ),
          renderSectionHeader: p.renderTabs,
        },
      ]}
    />
  )
}
export default SettingsTab
