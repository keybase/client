import * as C from '@/constants'
import {isAssertion} from '@/constants/chat/helpers'
import * as Chat from '@/constants/chat'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import MinWriterRole from './min-writer-role'
import Notifications from './notifications'
import RetentionPicker from '@/teams/team/settings-tab/retention'
import {useCurrentUserState} from '@/stores/current-user'
import {useChatTeam, useChatTeamMembers} from '../../team-hooks'
import {hideConversation as setConversationHidden} from '../../status-actions'
import {useConversationMetadata} from '../../data-hooks'

type EntityType = 'adhoc' | 'small team' | 'channel'
type SettingsPanelProps = {
  conversationIDKey: T.Chat.ConversationIDKey
  isPreview: boolean
}

const SettingsPanel = (props: SettingsPanelProps) => {
  const {conversationIDKey, isPreview} = props
  const username = useCurrentUserState(s => s.username)
  const {meta, participants: participantInfo} = useConversationMetadata(conversationIDKey)
  const {status, teamname, teamType, channelname, teamID} = meta
  const {yourOperations} = useChatTeam(teamID, teamname)
  const ignored = status === T.RPCChat.ConversationStatus.ignored
  const smallTeam = teamType !== 'big'

  const spinnerForLeave = C.Waiting.useAnyWaiting(C.waitingKeyChatLeaveConversation)

  const canDeleteHistory = teamname ? yourOperations.deleteChatHistory && !meta.cannotWrite : true

  let entityType: EntityType
  if (teamname && channelname) {
    entityType = smallTeam ? 'small team' : 'channel'
  } else {
    entityType = 'adhoc'
  }

  const {members: teamMembers} = useChatTeamMembers(teamID)
  const membersForBlock = (teamMembers.size ? [...teamMembers.keys()] : participantInfo.name).filter(
    u => u !== username && !isAssertion(u)
  )

  const onShowClearConversationDialog = () => {
    C.Router2.navigateAppend({name: 'chatDeleteHistoryWarning', params: {conversationIDKey}})
  }

  const onHideConv = () => setConversationHidden(conversationIDKey, true)
  const onUnhideConv = () => setConversationHidden(conversationIDKey, false)
  const onShowBlockConversationDialog = () => {
    if (membersForBlock.length) {
      C.Router2.navigateAppend({
        name: 'chatBlockingModal',
        params: {
          blockUserByDefault: true,
          conversationIDKey,
          others: membersForBlock,
          team: teamname,
        },
      })
    } else {
      onHideConv()
    }
  }

  const onArchive = () => {
    C.Router2.navigateAppend({
      name: 'archiveModal',
      params: {conversationIDKey, type: 'chatID' as const},
    })
  }

  const showDangerZone = canDeleteHistory || entityType === 'adhoc' || entityType !== 'channel'
  return (
    <Kb.ScrollView>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        alignItems="flex-start"
        padding="small"
        gap="small"
      >
        {isPreview ? (
          <>
            <Kb.Text type="BodySmallSemibold">You are not in this channel.</Kb.Text>
            <Kb.Button type="Success" mode="Primary" label="Join channel" style={styles.button} />
          </>
        ) : (
          <Notifications conversationIDKey={conversationIDKey} />
        )}
        {entityType === 'channel' && channelname !== 'general' && !isPreview && (
          <Kb.Button
            type="Default"
            mode="Secondary"
            label="Leave channel"
            onClick={() => C.Router2.leaveConversation(conversationIDKey)}
            style={styles.button}
            waiting={spinnerForLeave}
          >
            <Kb.Icon type="iconfont-leave" sizeType="Small" color={Kb.Styles.globalColors.blue} />
          </Kb.Button>
        )}
        <Kb.Text type="Header">Conversation</Kb.Text>
        <Kb.Button
          type="Default"
          mode="Secondary"
          label="Backup channel"
          onClick={onArchive}
          style={styles.button}
        >
          <Kb.Icon type="iconfont-folder-downloads" sizeType="Small" color={Kb.Styles.globalColors.black} />
        </Kb.Button>
        {entityType !== 'channel' && (
          <Kb.Button
            type="Default"
            mode="Secondary"
            label={ignored ? 'Unhide this conversation' : 'Hide this conversation'}
            onClick={ignored ? onUnhideConv : onHideConv}
            style={styles.button}
          >
            <Kb.Icon type="iconfont-unhide" sizeType="Small" color={Kb.Styles.globalColors.red} />
          </Kb.Button>
        )}
        <RetentionPicker
          conversationIDKey={
            ['adhoc', 'channel'].includes(entityType) ? conversationIDKey : Chat.noConversationIDKey
          }
          dropdownStyle={styles.retentionDropdownStyle}
          entityType={entityType}
          showSaveIndicator={true}
          teamID={teamID}
        />
        {(entityType === 'channel' || entityType === 'small team') && (
          <MinWriterRole conversationIDKey={conversationIDKey} />
        )}
        {showDangerZone ? (
          <>
            <Kb.Text type="BodySmallSemibold">Danger zone</Kb.Text>
            {canDeleteHistory && (
              <Kb.Button
                type="Danger"
                mode="Secondary"
                label="Clear entire conversation"
                onClick={onShowClearConversationDialog}
                style={styles.button}
              />
            )}
            {entityType === 'adhoc' && (
              <Kb.Button
                type="Danger"
                mode="Primary"
                label="Block"
                onClick={onShowBlockConversationDialog}
                style={styles.button}
              >
                <Kb.Icon type="iconfont-remove" sizeType="Small" color={Kb.Styles.globalColors.whiteOrWhite} />
              </Kb.Button>
            )}
          </>
        ) : null}
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: {
        alignSelf: 'center',
      },
      retentionDropdownStyle: {
        marginBottom: 0,
        width: '100%',
      },
    }) as const
)

type Item = {type: 'settings-panel'} | {type: 'tabs'} | {type: 'header-item'}
type Section = Kb.SectionType<Item>

type Props = {
  isPreview: boolean
  commonSections: ReadonlyArray<Section>
  conversationIDKey: T.Chat.ConversationIDKey
}

const SettingsTab = (p: Props) => {
  const section = {
    data: [{type: 'settings-panel'}] as const,
    renderItem: () => (
      <SettingsPanel conversationIDKey={p.conversationIDKey} isPreview={p.isPreview} />
    ),
  } satisfies Section
  const sections: Array<Section> = [...p.commonSections, section]
  return (
    <Kb.SectionList
      stickySectionHeadersEnabled={true}
      keyboardShouldPersistTaps="handled"
      sections={sections}
    />
  )
}
export default SettingsTab
