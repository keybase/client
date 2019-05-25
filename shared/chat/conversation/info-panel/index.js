// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import type {Props as HeaderHocProps} from '../../../common-adapters/header-hoc/types'
import {AdhocHeader, TeamHeader} from './header'
import {MembersPanel, SettingsPanel} from './panels'
import AttachmentPanel from './attachments/container'
import {compose, withProps} from 'recompose'
import Participant from './participant'
import {AttachmentTypeSelector, DocView, LinkView, MediaView} from './attachments'

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

class _InfoPanel extends React.Component<InfoPanelProps, InfoPanelState> {
  componentDidMount() {
    this.props.onAttachmentViewChange(this.props.selectedAttachmentView)
  }

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
        <Kb.Box2 key="settings" style={styles.tabTextContainer} direction="horizontal">
          <TabText selected={this._isSelected('settings')} text="Settings" />
        </Kb.Box2>
      )
    }
    if (entityType !== 'adhoc') {
      res.push(
        <Kb.Box2 key="members" style={styles.tabTextContainer} direction="horizontal">
          <TabText selected={this._isSelected('members')} text="Members" />
        </Kb.Box2>
      )
    }
    res.push(
      <Kb.Box2 key="attachments" style={styles.tabTextContainer} direction="horizontal">
        <TabText selected={this._isSelected('attachments')} text="Attachments" />
      </Kb.Box2>
    )
    if (!Styles.isMobile && this.props.attachmentsLoading) {
      res.push(<Kb.ProgressIndicator style={styles.attachmentsLoading} />)
    }
    return res
  }

  _onSelectTab = tab => {
    this.props.onSelectTab(tab.key)
  }
  _renderHeader = () => {
    const entityType = this._getEntityType()
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
    return header
  }
  _headerSection = () => {
    return {
      data: ['header'],
      renderItem: this._renderHeader,
      renderSectionHeader: () => {
        return null
      },
    }
  }

  _renderAttachmentViewSelector = () => {
    return (
      <AttachmentTypeSelector
        selectedView={this.props.selectedAttachmentView}
        onSelectView={this.props.onAttachmentViewChange}
      />
    )
  }
  _attachmentViewSelectorSection = () => {
    return {
      data: ['avselector'],
      renderItem: this._renderAttachmentViewSelector,
      renderSectionHeader: () => {
        return null
      },
    }
  }

  _renderTabs = () => {
    const tabs = this._getTabs(this._getEntityType())
    const selected = tabs.find(tab => this._isSelected(tab.key)) || null
    return (
      <Kb.Box2 direction="horizontal" fullWidth={true}>
        <Kb.Tabs tabs={tabs} selected={selected} onSelect={this._onSelectTab} />
      </Kb.Box2>
    )
  }
  _tabsSection = () => {
    return {
      data: ['tabs'],
      renderItem: () => null,
      renderSectionHeader: this._renderTabs,
    }
  }

  _renderSectionHeader = ({section}) => {
    return section.renderSectionHeader({section})
  }

  render() {
    const entityType = this._getEntityType()
    let sections = []
    let tabsSection = this._tabsSection()
    sections.push(this._headerSection())

    if (this._isSelected('settings')) {
      tabsSection.renderItem = () => {
        return (
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
        )
      }
      sections.push(tabsSection)
    } else if (this._isSelected('members')) {
      tabsSection.data = tabsSection.data.concat(this.props.participants)
      tabsSection.renderItem = ({item}) => {
        if (!item.username) {
          return null
        }
        return (
          <Participant
            fullname={item.fullname}
            isAdmin={item.isAdmin}
            isOwner={item.isOwner}
            username={item.username}
            onShowProfile={this.props.onShowProfile}
          />
        )
      }
      sections.push(tabsSection)
    } else if (this._isSelected('attachments')) {
      let attachmentSections
      switch (this.props.selectedAttachmentView) {
        case RPCChatTypes.localGalleryItemTyp.media:
          attachmentSections = new MediaView().getSections(
            this.props.media.thumbs,
            this.props.media.onLoadMore
          )
          break
        case RPCChatTypes.localGalleryItemTyp.doc:
          attachmentSections = new DocView().getSections(this.props.docs.docs, this.props.docs.onLoadMore)
          break
        case RPCChatTypes.localGalleryItemTyp.link:
          attachmentSections = new LinkView().getSections(this.props.links.links, this.props.links.onLoadMore)
          break
      }
      sections.push(tabsSection)
      sections.push(this._attachmentViewSelectorSection())
      sections = sections.concat(attachmentSections)
    }
    return (
      <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
        <Kb.SectionList
          stickySectionHeadersEnabled={true}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={this._renderSectionHeader}
          sections={sections}
        />
      </Kb.Box2>
    )
  }
}

const border = `1px solid ${Styles.globalColors.black_10}`
const styles = Styles.styleSheetCreate({
  attachmentsLoading: {
    height: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
  container: Styles.platformStyles({
    common: {alignItems: 'stretch', flex: 1, paddingBottom: Styles.globalMargins.medium},
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      borderLeft: border,
    },
  }),
  tabTextContainer: {
    justifyContent: 'center',
  },
  tabTextSelected: {color: Styles.globalColors.black},
})

const InfoPanel = compose(
  withProps<any, any, any>((props: InfoPanelProps) => ({
    titleComponent:
      Styles.isMobile && props.attachmentsLoading ? (
        <Kb.ProgressIndicator style={styles.attachmentsLoading} />
      ) : null,
  })),
  Kb.HeaderOnMobile
)(_InfoPanel)

export type {InfoPanelProps}
export {InfoPanel}

/*
        <Kb.Box2 direction="vertical" gapStart={true} gap="xtiny" fullWidth={true}>
          {header}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          <Kb.Tabs tabs={tabs} selected={selected} onSelect={this._onSelectTab} />
        </Kb.Box2>
        {content}
        */
