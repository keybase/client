// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import type {Props as HeaderHocProps} from '../../../common-adapters/header-hoc/types'
import {AdhocHeader, TeamHeader} from './header'
import {MembersPanel, SettingsPanel} from './panels'
import AttachmentPanel from './attachments/container'

export type Panel = 'settings' | 'members' | 'attachments'

type InfoPanelProps = {|
  selectedConversationIDKey: Types.ConversationIDKey,
  participants: Array<{
    username: string,
    fullname: string,
    isAdmin: boolean,
    isOwner: boolean,
  }>,
  isPreview: boolean,
  teamname: ?string,
  channelname: ?string,
  smallTeam: boolean,
  admin: boolean,
  ignored: boolean,
  spinnerForHide: boolean,

  // Used by HeaderHoc.
  onBack: () => void,

  // Used by Participant.
  onShowProfile: (username: string) => void,

  // Used for conversations.
  onShowBlockConversationDialog: () => void,
  onShowClearConversationDialog: () => void,
  onShowNewTeamDialog: () => void,
  onHideConv: () => void,
  onUnhideConv: () => void,

  onSelectTab: Panel => void,
  selectedTab: Panel,

  // Used for small and big teams.
  canSetMinWriterRole: boolean,
  canSetRetention: boolean,

  // Used for big teams.
  canEditChannel: boolean,
  canDeleteHistory: boolean,
  description: ?string,
  onEditChannel: () => void,
  onLeaveConversation: () => void,
  onJoinChannel: () => void,
  ...$Exact<HeaderHocProps>,
|}

const TabText = ({selected, text}: {selected: boolean, text: string}) => (
  <Kb.Text type="BodySmallSemibold" style={selected ? styles.tabTextSelected : styles.tabText}>
    {text}
  </Kb.Text>
)

class _InfoPanel extends React.Component<InfoPanelProps> {
  _getEntityType = () => {
    if (this.props.teamname && this.props.channelname) {
      return this.props.smallTeam ? 'small team' : 'channel'
    }
    return 'adhoc'
  }

  _isSelected = s => {
    return s === this.props.selectedTab
  }

  _getTabs = entityType => {
    const res = []
    if (!this.props.isPreview) {
      res.push(
        <Kb.Box key="settings" style={styles.tabTextContainer}>
          <TabText selected={this._isSelected('settings')} text="Settings" />
        </Kb.Box>
      )
    }
    if (entityType !== 'adhoc') {
      res.push(
        <Kb.Box key="members" style={styles.tabTextContainer}>
          <TabText selected={this._isSelected('members')} text="Members" />
        </Kb.Box>
      )
    }
    res.push(
      <Kb.Box key="attachments" style={styles.tabTextContainer}>
        <TabText selected={this._isSelected('attachments')} text="Attachments" />
      </Kb.Box>
    )
    return res
  }

  _onSelectTab = tab => {
    this.props.onSelectTab(tab.key)
  }

  render() {
    const entityType = this._getEntityType()
    const tabs = this._getTabs(entityType)
    const selected = tabs.find(tab => this._isSelected(tab.key)) || null
    const header = (
      <>
        {entityType === 'small team' || entityType === 'channel' ? (
          <TeamHeader
            admin={this.props.admin}
            teamname={this.props.teamname}
            channelname={this.props.channelname}
            conversationIDKey={this.props.selectedConversationIDKey}
            isSmallTeam={entityType === 'small team'}
            isPreview={this.props.isPreview}
            participantCount={this.props.participants.length}
            onJoinChannel={this.props.onJoinChannel}
          />
        ) : (
          <AdhocHeader
            onShowNewTeamDialog={this.props.onShowNewTeamDialog}
            participants={this.props.participants}
          />
        )}
      </>
    )
    const content = (
      <>
        {this._isSelected('settings') && (
          <SettingsPanel
            canDeleteHistory={this.props.canDeleteHistory}
            conversationIDKey={this.props.selectedConversationIDKey}
            entityType={entityType}
            key="settings"
            onHideConv={this.props.onHideConv}
            onUnhideConv={this.props.onUnhideConv}
            onLeaveConversation={this.props.onLeaveConversation}
            onShowBlockConversationDialog={this.props.onShowBlockConversationDialog}
            onShowClearConversationDialog={this.props.onShowClearConversationDialog}
            spinnerForHide={this.props.spinnerForHide}
            teamname={this.props.teamname}
            channelname={this.props.channelname}
          />
        )}
        {this._isSelected('members') && (
          <MembersPanel onShowProfile={this.props.onShowProfile} participants={this.props.participants} />
        )}
        {this._isSelected('attachments') && (
          <AttachmentPanel conversationIDKey={this.props.selectedConversationIDKey} />
        )}
      </>
    )
    return (
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
        {header}
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Tabs tabs={tabs} selected={selected} onSelect={this._onSelectTab} />
        </Kb.Box2>
        {content}
      </Kb.Box2>
    )
  }
}

const border = `1px solid ${Styles.globalColors.black_10}`
const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {alignItems: 'stretch', flex: 1, paddingBottom: Styles.globalMargins.medium},
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      borderLeft: border,
    },
  }),
  tabTextContainer: {
    ...Styles.globalStyles.flexBoxRow,
    justifyContent: 'center',
  },
  tabTextSelected: {color: Styles.globalColors.black},
})

const InfoPanel = Kb.HeaderOnMobile(_InfoPanel)

export type {InfoPanelProps}
export {InfoPanel}
