import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import RetentionPicker from '../../../teams/team/settings-tab/retention/container'
import MinWriterRole from './min-writer-role/container'
import Notifications from './notifications/container'
import {CaptionedDangerIcon} from './channel-utils'
import {EntityType} from '.'

type SettingsPanelProps = {
  canDeleteHistory: boolean
  conversationIDKey: Types.ConversationIDKey
  entityType: EntityType
  ignored: boolean
  onHideConv: () => void
  onUnhideConv: () => void
  onLeaveConversation: () => void
  onShowBlockConversationDialog: () => void
  onShowClearConversationDialog: () => void
  spinnerForHide: boolean
  teamname?: string
  channelname?: string
}

export const SettingsPanel = (props: SettingsPanelProps) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.settingsContainer}>
      <Kb.ScrollView>
        <Notifications conversationIDKey={props.conversationIDKey} />
        <Kb.Divider style={styles.divider} />
        <RetentionPicker
          containerStyle={styles.retentionContainerStyle}
          conversationIDKey={
            ['adhoc', 'channel'].includes(props.entityType) ? props.conversationIDKey : undefined
          }
          dropdownStyle={styles.retentionDropdownStyle}
          entityType={props.entityType}
          showSaveIndicator={true}
          teamname={props.teamname}
          type="auto"
        />
        {(props.entityType === 'channel' || props.entityType === 'small team') && (
          <>
            <Kb.Divider style={styles.divider} />
            <MinWriterRole
              conversationIDKey={props.conversationIDKey}
              isSmallTeam={props.entityType === 'small team'}
            />
          </>
        )}
        <Kb.Divider style={styles.divider} />
        {props.canDeleteHistory && (
          <CaptionedDangerIcon
            caption="Clear entire conversation"
            onClick={props.onShowClearConversationDialog}
            icon="iconfont-fire"
          />
        )}
        {props.entityType === 'adhoc' && (
          <CaptionedDangerIcon
            caption="Block this conversation"
            onClick={props.onShowBlockConversationDialog}
            icon="iconfont-remove"
          />
        )}
        {props.entityType !== 'channel' &&
          (props.ignored ? (
            <CaptionedDangerIcon
              caption="Unhide this conversation"
              onClick={props.onUnhideConv}
              noDanger={true}
              spinner={props.spinnerForHide}
            />
          ) : (
            <CaptionedDangerIcon
              caption="Hide this conversation"
              onClick={props.onHideConv}
              noDanger={true}
              icon="iconfont-hide"
              spinner={props.spinnerForHide}
            />
          ))}
        {props.entityType === 'channel' && props.channelname !== 'general' && (
          <CaptionedDangerIcon
            onClick={props.onLeaveConversation}
            caption="Leave channel"
            icon="iconfont-leave"
          />
        )}
      </Kb.ScrollView>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
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
    },
    isMobile: {
      marginRight: 16,
    },
  }),
  retentionDropdownStyle: Styles.platformStyles({
    isElectron: {
      marginRight: 45 - 16,
      width: 'auto',
    },
    isMobile: {
      width: '100%',
    },
  }),
  settingsContainer: {
    flex: 1,
    height: '100%',
    paddingTop: Styles.globalMargins.small,
  },
})
