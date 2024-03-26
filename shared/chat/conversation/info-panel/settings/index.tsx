import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as React from 'react'
import type {Section} from '@/common-adapters/section-list'
import MinWriterRole from './min-writer-role'
import Notifications from './notifications'
import RetentionPicker from '@/teams/team/settings-tab/retention/container'

type EntityType = 'adhoc' | 'small team' | 'channel'
type SettingsPanelProps = {isPreview: boolean}

const SettingsPanel = (props: SettingsPanelProps) => {
  const {isPreview} = props
  const username = C.useCurrentUserState(s => s.username)
  const meta = C.useChatContext(s => s.meta)
  const {status, teamname, teamType, channelname, teamID} = meta
  const yourOperations = C.useTeamsState(s => (teamname ? C.Teams.getCanPerformByID(s, teamID) : undefined))
  const ignored = status === T.RPCChat.ConversationStatus.ignored
  const smallTeam = teamType !== 'big'

  const spinnerForLeave = C.Waiting.useAnyWaiting(C.Chat.waitingKeyLeaveConversation)

  const canDeleteHistory =
    teamname && yourOperations ? yourOperations.deleteChatHistory && !meta.cannotWrite : true

  let entityType: EntityType
  if (teamname && channelname) {
    entityType = smallTeam ? 'small team' : 'channel'
  } else {
    entityType = 'adhoc'
  }

  const teamMembers = C.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const participantInfo = C.useChatContext(s => s.participants)
  const membersForBlock = (teamMembers?.size ? [...teamMembers.keys()] : participantInfo.name).filter(
    u => u !== username && !C.Chat.isAssertion(u)
  )

  const navigateAppend = C.Chat.useChatNavigateAppend()
  const onShowClearConversationDialog = () => {
    navigateAppend(conversationIDKey => ({props: {conversationIDKey}, selected: 'chatDeleteHistoryWarning'}))
  }

  const hideConversation = C.useChatContext(s => s.dispatch.hideConversation)
  const onHideConv = () => hideConversation(true)
  const onUnhideConv = () => hideConversation(false)
  const onShowBlockConversationDialog = membersForBlock.length
    ? () => {
        navigateAppend(conversationIDKey => ({
          props: {
            blockUserByDefault: true,
            conversationIDKey,
            others: membersForBlock,
            team: teamname,
          },
          selected: 'chatBlockingModal',
        }))
      }
    : onHideConv

  const leaveConversation = C.useChatContext(s => s.dispatch.leaveConversation)
  const onLeaveConversation = () => {
    leaveConversation()
  }

  const onArchive = () => {
    C.featureFlags.archive &&
      navigateAppend(conversationIDKey => ({
        props: {conversationIDKey, type: 'chatID'} as const,
        selected: 'archiveModal',
      }))
  }

  const showDangerZone = canDeleteHistory || entityType === 'adhoc' || entityType !== 'channel'
  const conversationIDKey = C.useChatContext(s => s.id)
  return (
    <Kb.ScrollView>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        alignItems="flex-start"
        style={styles.container}
        gap="tiny"
      >
        {isPreview ? (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySmallSemibold">You are not in this channel.</Kb.Text>
            <Kb.Button type="Success" mode="Primary" label="Join channel" style={styles.buttonStyle} />
          </Kb.Box2>
        ) : (
          <Notifications />
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
            iconColor={Kb.Styles.globalColors.blue}
          />
        )}
        <Kb.Text type="Header">Conversation</Kb.Text>
        {C.featureFlags.archive ? (
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
            <Kb.Button
              type="Default"
              mode="Secondary"
              label="Archive channel"
              onClick={onArchive}
              icon="iconfont-folder-downloads"
              iconColor={Kb.Styles.globalColors.black}
            />
          </Kb.Box2>
        ) : null}
        <RetentionPicker
          conversationIDKey={
            ['adhoc', 'channel'].includes(entityType) ? conversationIDKey : C.Chat.noConversationIDKey
          }
          dropdownStyle={styles.retentionDropdownStyle}
          entityType={entityType}
          showSaveIndicator={true}
          teamID={teamID}
        />
        {(entityType === 'channel' || entityType === 'small team') && <MinWriterRole />}
        {showDangerZone ? (
          <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
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
                iconColor={Kb.Styles.globalColors.red}
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
                  iconColor={Kb.Styles.globalColors.red}
                />
              ) : (
                <Kb.Button
                  type="Danger"
                  mode="Secondary"
                  label="Hide this conversation"
                  onClick={onHideConv}
                  icon="iconfont-unhide"
                  iconColor={Kb.Styles.globalColors.red}
                />
              ))}
          </Kb.Box2>
        ) : null}
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      buttonStyle: {
        alignSelf: 'flex-start',
        marginBottom: Kb.Styles.globalMargins.small,
        marginTop: Kb.Styles.globalMargins.small,
      },
      container: {padding: Kb.Styles.globalMargins.small},
      retentionDropdownStyle: Kb.Styles.platformStyles({
        isElectron: {
          marginRight: 45 - 16,
          width: 'auto',
        },
        isMobile: {width: '100%'},
      }),
      smallButton: {
        alignSelf: 'center',
      },
    }) as const
)

type Props = {
  isPreview: boolean
  renderTabs: () => React.ReactElement | null
  commonSections: Array<Section<unknown, {type: 'header-section'}>>
}

const SettingsTab = (p: Props) => {
  const section: Section<unknown, {type: 'settings-panel'}> = {
    data: [{key: 'tab'}],
    key: 'settings-panel',
    renderItem: () => <SettingsPanel isPreview={p.isPreview} key="settings" />,
    type: 'settings-panel',
  } as const
  const sections = [...p.commonSections, section]
  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({section}) => (section.type === 'settings-panel' ? p.renderTabs() : null)}
      sections={sections}
    />
  )
}
export default SettingsTab
