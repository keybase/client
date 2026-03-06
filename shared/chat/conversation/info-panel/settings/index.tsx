import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as Teams from '@/stores/teams'
import * as T from '@/constants/types'
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
  const onShowClearConversationDialog = () => {
    navigateAppend(conversationIDKey => ({name: 'chatDeleteHistoryWarning', params: {conversationIDKey}}))
  }

  const hideConversation = Chat.useChatContext(s => s.dispatch.hideConversation)
  const onHideConv = () => hideConversation(true)
  const onUnhideConv = () => hideConversation(false)
  const onShowBlockConversationDialog = () => {
    if (membersForBlock.length) {
      navigateAppend(conversationIDKey => ({
        name: 'chatBlockingModal',
        params: {
          blockUserByDefault: true,
          conversationIDKey,
          others: membersForBlock,
          team: teamname,
        },
      }))
    } else {
      onHideConv()
    }
  }

  const leaveConversation = Chat.useChatContext(s => s.dispatch.leaveConversation)
  const onLeaveConversation = () => {
    leaveConversation()
  }

  const onArchive = () => {
    navigateAppend(conversationIDKey => ({
      name: 'archiveModal',
      params: {conversationIDKey, type: 'chatID' as const},
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
            <Kb.Button2 type="Success" mode="Primary" label="Join channel" style={styles.buttonStyle} />
          </Kb.Box2>
        ) : (
          <Notifications />
        )}
        {entityType === 'channel' && channelname !== 'general' && !isPreview && (
          <Kb.Button2
            type="Default"
            mode="Secondary"
            label="Leave channel"
            onClick={onLeaveConversation}
            style={styles.smallButton}
            waiting={spinnerForLeave}
          >
            <Kb.Icon2 type="iconfont-leave" sizeType="Small" color={Kb.Styles.globalColors.blue} />
          </Kb.Button2>
        )}
        <Kb.Text type="Header">Conversation</Kb.Text>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Button2
            type="Default"
            mode="Secondary"
            label="Backup channel"
            onClick={onArchive}
          >
            <Kb.Icon2 type="iconfont-folder-downloads" sizeType="Small" color={Kb.Styles.globalColors.black} />
          </Kb.Button2>
        </Kb.Box2>
        {entityType !== 'channel' &&
          (ignored ? (
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
              <Kb.Button2
                type="Default"
                mode="Secondary"
                label="Unhide this conversation"
                onClick={onUnhideConv}
              >
                <Kb.Icon2 type="iconfont-unhide" sizeType="Small" color={Kb.Styles.globalColors.red} />
              </Kb.Button2>
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
              <Kb.Button2
                type="Default"
                mode="Secondary"
                label="Hide this conversation"
                onClick={onHideConv}
              >
                <Kb.Icon2 type="iconfont-unhide" sizeType="Small" color={Kb.Styles.globalColors.red} />
              </Kb.Button2>
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
              <Kb.Button2
                type="Danger"
                mode="Secondary"
                label="Clear entire conversation"
                onClick={onShowClearConversationDialog}
              />
            )}
            {entityType === 'adhoc' && (
              <Kb.Button2
                type="Danger"
                mode="Primary"
                label="Block"
                onClick={onShowBlockConversationDialog}
              >
                <Kb.Icon2 type="iconfont-remove" sizeType="Small" color={Kb.Styles.globalColors.whiteOrWhite} />
              </Kb.Button2>
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
