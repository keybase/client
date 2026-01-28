import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as Teams from '@/stores/teams'
import * as T from '@/constants/types'
import * as React from 'react'
import MinWriterRole from './min-writer-role'
import Notifications from './notifications'
import RetentionPicker from '@/teams/team/settings-tab/retention'
import {useCurrentUserState} from '@/stores/current-user'

type EntityType = 'adhoc' | 'small team' | 'channel'
type SettingsPanelProps = {isPreview: boolean}

const SettingsPanel = (props: SettingsPanelProps) => {
  const {isPreview} = props
  const username = useCurrentUserState(s => s.username)
  const meta = Chat.useChatContext(s => s.meta)
  const {status, teamname, teamType, channelname, teamID} = meta
  const yourOperations = Teams.useTeamsState(s => (teamname ? Teams.getCanPerformByID(s, teamID) : undefined))
  const ignored = status === T.RPCChat.ConversationStatus.ignored
  const smallTeam = teamType !== 'big'

  const spinnerForLeave = C.Waiting.useAnyWaiting(C.waitingKeyChatLeaveConversation)

  const canDeleteHistory =
    teamname && yourOperations ? yourOperations.deleteChatHistory && !meta.cannotWrite : true

  let entityType: EntityType
  if (teamname && channelname) {
    entityType = smallTeam ? 'small team' : 'channel'
  } else {
    entityType = 'adhoc'
  }

  const teamMembers = Teams.useTeamsState(s => s.teamIDToMembers.get(teamID))
  const participantInfo = Chat.useChatContext(s => s.participants)
  const membersForBlock = (teamMembers?.size ? [...teamMembers.keys()] : participantInfo.name).filter(
    u => u !== username && !Chat.isAssertion(u)
  )

  const navigateAppend = Chat.useChatNavigateAppend()
  const onShowClearConversationDialog = React.useCallback(() => {
    navigateAppend(conversationIDKey => ({props: {conversationIDKey}, selected: 'chatDeleteHistoryWarning'}))
  }, [navigateAppend])

  const hideConversation = Chat.useChatContext(s => s.dispatch.hideConversation)
  const onHideConv = React.useCallback(() => hideConversation(true), [hideConversation])
  const onUnhideConv = React.useCallback(() => hideConversation(false), [hideConversation])
  const onShowBlockConversationDialog = React.useCallback(() => {
    if (membersForBlock.length) {
      navigateAppend(conversationIDKey => ({
        props: {
          blockUserByDefault: true,
          conversationIDKey,
          others: membersForBlock,
          team: teamname,
        },
        selected: 'chatBlockingModal',
      }))
    } else {
      onHideConv()
    }
  }, [membersForBlock, onHideConv, teamname, navigateAppend])

  const leaveConversation = Chat.useChatContext(s => s.dispatch.leaveConversation)
  const onLeaveConversation = React.useCallback(() => {
    leaveConversation()
  }, [leaveConversation])

  const onArchive = () => {
    navigateAppend(conversationIDKey => ({
      props: {conversationIDKey, type: 'chatID' as const},
      selected: 'archiveModal',
    }))
  }

  const showDangerZone = canDeleteHistory || entityType === 'adhoc' || entityType !== 'channel'
  const conversationIDKey = Chat.useChatContext(s => s.id)
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
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Button
            type="Default"
            mode="Secondary"
            label="Backup channel"
            onClick={onArchive}
            icon="iconfont-folder-downloads"
            iconColor={Kb.Styles.globalColors.black}
          />
        </Kb.Box2>
        {entityType !== 'channel' &&
          (ignored ? (
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
              <Kb.Button
                type="Default"
                mode="Secondary"
                label="Unhide this conversation"
                onClick={onUnhideConv}
                icon="iconfont-unhide"
                iconColor={Kb.Styles.globalColors.red}
              />
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
              <Kb.Button
                type="Default"
                mode="Secondary"
                label="Hide this conversation"
                onClick={onHideConv}
                icon="iconfont-unhide"
                iconColor={Kb.Styles.globalColors.red}
              />
            </Kb.Box2>
          ))}
        <RetentionPicker
          conversationIDKey={
            ['adhoc', 'channel'].includes(entityType) ? conversationIDKey : Chat.noConversationIDKey
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

type Item = {type: 'settings-panel'} | {type: 'tabs'} | {type: 'header-item'}
type Section = Kb.SectionType<Item>

type Props = {
  isPreview: boolean
  commonSections: ReadonlyArray<Section>
}

const SettingsTab = (p: Props) => {
  const section = {
    data: [{type: 'settings-panel'}] as const,
    renderItem: () => <SettingsPanel isPreview={p.isPreview} />,
  } satisfies Section
  const sections: Array<Section> = [...p.commonSections, section]
  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({section}) => section.renderSectionHeader?.({section}) ?? null}
      sections={sections}
    />
  )
}
export default SettingsTab
